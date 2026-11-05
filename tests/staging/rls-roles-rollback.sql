-- OT Comercial Gate D | isolamento de dois titulares simulados pelo contexto JWT
-- Aplicar somente no projeto efscgxwvaixwqhffwdqu (STAGING).
-- Teste SQL da lógica RLS. NÃO equivale a testar Auth/JWT reais por HTTP.
-- Usa o ID de um usuário de testes já existente e outro UUID fictício.
-- Uma única transação + ROLLBACK no fim; nada persiste.

BEGIN;
SELECT set_config('request.ot_test_owner',
  (SELECT id::text FROM auth.users ORDER BY created_at LIMIT 1), true);
DO $$
BEGIN
 IF nullif(current_setting('request.ot_test_owner',true),'') IS NULL
 THEN RAISE EXCEPTION 'Não há usuário fictício de teste no Auth do staging'; END IF;
END $$;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',current_setting('request.ot_test_owner',true),true);
INSERT INTO public.ot_empresas(id,nome,briefing)
VALUES ('12345678-1111-4111-8111-123456789001','Empresa fictícia RLS OT','Teste revertido, sem clientes');
INSERT INTO public.ot_visitas(id,empresa_id,nota)
VALUES ('12345678-1111-4111-8111-123456789002','12345678-1111-4111-8111-123456789001','Visita fictícia');
INSERT INTO public.ot_fotos(id,empresa_id,storage_path,arquivo_nome,categoria,bytes)
VALUES ('12345678-1111-4111-8111-123456789003','12345678-1111-4111-8111-123456789001',
 current_setting('request.ot_test_owner',true)||'/12345678-1111-4111-8111-123456789001/teste.png',
 'teste.png','Fachada',8);
DO $$
BEGIN
 IF (SELECT count(*) FROM public.ot_empresas WHERE id='12345678-1111-4111-8111-123456789001')<>1
 OR (SELECT count(*) FROM public.ot_visitas WHERE id='12345678-1111-4111-8111-123456789002')<>1
 OR (SELECT count(*) FROM public.ot_fotos WHERE id='12345678-1111-4111-8111-123456789003')<>1
 THEN RAISE EXCEPTION 'Titular A não lê os próprios registros'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','88888888-8888-4888-8888-888888888888',true);
DO $$
DECLARE updated integer; deleted integer; denied boolean:=false;
BEGIN
 IF EXISTS(SELECT 1 FROM public.ot_empresas WHERE id='12345678-1111-4111-8111-123456789001')
 OR EXISTS(SELECT 1 FROM public.ot_visitas WHERE id='12345678-1111-4111-8111-123456789002')
 OR EXISTS(SELECT 1 FROM public.ot_fotos WHERE id='12345678-1111-4111-8111-123456789003')
 THEN RAISE EXCEPTION 'Vazamento de leitura entre titulares A e B'; END IF;
 UPDATE public.ot_empresas SET nome='ALTERADO POR B'
 WHERE id='12345678-1111-4111-8111-123456789001';
 GET DIAGNOSTICS updated=ROW_COUNT;
 IF updated<>0 THEN RAISE EXCEPTION 'Titular B conseguiu alterar empresa de A'; END IF;
 DELETE FROM public.ot_fotos WHERE id='12345678-1111-4111-8111-123456789003';
 GET DIAGNOSTICS deleted=ROW_COUNT;
 IF deleted<>0 THEN RAISE EXCEPTION 'Titular B conseguiu excluir foto de A'; END IF;
 BEGIN
  INSERT INTO public.ot_empresas(id,owner_id,nome,briefing)
  VALUES ('12345678-1111-4111-8111-123456789009',
   current_setting('request.ot_test_owner',true)::uuid,'Falsificação','Acesso indevido');
 EXCEPTION WHEN insufficient_privilege THEN denied:=true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'Titular B conseguiu falsificar owner_id de A'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub',current_setting('request.ot_test_owner',true),true);
DO $$
BEGIN
 IF (SELECT nome FROM public.ot_empresas WHERE id='12345678-1111-4111-8111-123456789001')<>'Empresa fictícia RLS OT'
 THEN RAISE EXCEPTION 'Dados do titular A foram alterados'; END IF;
END $$;
ROLLBACK;
SELECT 'PASSOU: titular A/B simulado, CRUD isolado, rollback concluído' AS resultado;
