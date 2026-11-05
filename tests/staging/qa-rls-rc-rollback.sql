-- QA SOMENTE: efscgxwvaixwqhffwdqu. Não executa DDL nem altera Auth/Storage.
-- Contextos JWT simulados no PostgreSQL; NÃO equivale a JWT real por HTTP.
-- Fixtures sintéticas transitórias, ROLLBACK obrigatório. Nunca apaga registros existentes.
BEGIN;
SELECT set_config('ot.qa_owner_a',(SELECT owner_id::text FROM public.ot_empresas LIMIT 1),true);
SELECT set_config('ot.qa_owner_b',(SELECT id::text FROM auth.users WHERE id::text<>current_setting('ot.qa_owner_a') LIMIT 1),true);
SELECT set_config('ot.qa_object',(SELECT id::text FROM storage.objects WHERE bucket_id='ot-clientes-privado' AND (storage.foldername(name))[1]=current_setting('ot.qa_owner_a') LIMIT 1),true);
SELECT set_config('ot.qa_company',gen_random_uuid()::text,true);
SELECT set_config('ot.qa_visit',gen_random_uuid()::text,true);
SELECT set_config('ot.qa_photo',gen_random_uuid()::text,true);
DO $$ BEGIN
 IF nullif(current_setting('ot.qa_owner_a'),'') IS NULL OR nullif(current_setting('ot.qa_owner_b'),'') IS NULL
 THEN RAISE EXCEPTION 'São necessárias duas contas existentes de QA'; END IF;
END $$;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',current_setting('ot.qa_owner_a'),true);
INSERT INTO public.ot_empresas(id,nome,briefing) VALUES(current_setting('ot.qa_company')::uuid,'QA RC REVERTIDA','Fixture sintética');
INSERT INTO public.ot_visitas(id,empresa_id,nota) VALUES(current_setting('ot.qa_visit')::uuid,current_setting('ot.qa_company')::uuid,'QA revertida');
INSERT INTO public.ot_fotos(id,empresa_id,storage_path,arquivo_nome,bytes)
 VALUES(current_setting('ot.qa_photo')::uuid,current_setting('ot.qa_company')::uuid,
 current_setting('ot.qa_owner_a')||'/'||current_setting('ot.qa_company')||'/qa.png','qa.png',8);
DO $$ DECLARE found integer; BEGIN
 SELECT count(*) INTO found FROM storage.objects WHERE id=current_setting('ot.qa_object')::uuid;
 IF found<>1 THEN RAISE EXCEPTION 'Titular não lê objeto próprio'; END IF;
 BEGIN
  UPDATE public.ot_empresas SET owner_id=current_setting('ot.qa_owner_b')::uuid WHERE id=current_setting('ot.qa_company')::uuid;
  RAISE EXCEPTION 'WITH CHECK permitiu reassinar proprietário';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SELECT set_config('request.jwt.claim.sub',current_setting('ot.qa_owner_b'),true);
DO $$ DECLARE t text; key text; found integer; changed integer; BEGIN
 FOR t,key IN SELECT * FROM (VALUES ('ot_empresas','ot.qa_company'),('ot_visitas','ot.qa_visit'),('ot_fotos','ot.qa_photo')) x(t,key) LOOP
  EXECUTE format('SELECT count(*) FROM public.%I WHERE id=$1',t) INTO found USING current_setting(key)::uuid;
  IF found<>0 THEN RAISE EXCEPTION 'Leitura cross-user em %',t; END IF;
  EXECUTE format('UPDATE public.%I SET owner_id=owner_id WHERE id=$1',t) USING current_setting(key)::uuid;
  GET DIAGNOSTICS changed=ROW_COUNT;
  IF changed<>0 THEN RAISE EXCEPTION 'UPDATE cross-user em %',t; END IF;
  EXECUTE format('DELETE FROM public.%I WHERE id=$1',t) USING current_setting(key)::uuid;
  GET DIAGNOSTICS changed=ROW_COUNT;
  IF changed<>0 THEN RAISE EXCEPTION 'DELETE cross-user em %',t; END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM storage.objects WHERE id=current_setting('ot.qa_object')::uuid)
 THEN RAISE EXCEPTION 'Storage SELECT cross-user'; END IF;
 BEGIN
  INSERT INTO public.ot_empresas(owner_id,nome) VALUES(current_setting('ot.qa_owner_a')::uuid,'OWNER FORJADO');
  RAISE EXCEPTION 'INSERT owner forjado aceito';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  INSERT INTO public.ot_visitas(empresa_id,nota) VALUES(current_setting('ot.qa_company')::uuid,'FK cross-user');
  RAISE EXCEPTION 'FK cross-user aceita';
 EXCEPTION WHEN foreign_key_violation THEN NULL; END;
END $$;
SET LOCAL ROLE anon;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['ot_empresas','ot_visitas','ot_fotos'] LOOP
  BEGIN
   EXECUTE format('SELECT 1 FROM public.%I LIMIT 1',t);
   RAISE EXCEPTION 'Anon SELECT permitido em %',t;
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 END LOOP;
END $$;
ROLLBACK;
SELECT 'PASS: RLS SQL A/B SELECT UPDATE DELETE, owner forjado, WITH CHECK, FK composta, anon; Storage SELECT A/B. Fixtures revertidas. HTTP JWT real pendente.' AS resultado;
