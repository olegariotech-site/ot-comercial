\set ON_ERROR_STOP on
-- Apenas PostgreSQL efêmero do CI. Nunca enviar este bootstrap a Supabase compartilhado.
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE anon NOLOGIN;
CREATE SCHEMA auth;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
GRANT USAGE ON SCHEMA public,auth TO authenticated,anon;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated,anon;
INSERT INTO auth.users VALUES('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222');
CREATE TABLE public.ot_empresas(id uuid PRIMARY KEY,owner_id uuid NOT NULL REFERENCES auth.users(id),nome text,UNIQUE(id,owner_id));
INSERT INTO public.ot_empresas VALUES('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111','Fixture A'),('44444444-4444-4444-8444-444444444444','22222222-2222-4222-8222-222222222222','Fixture B');
SELECT set_config('ot.v16_target','isolated-test',false);
\ir ../../supabase/migrations/20261105180000_v16_commercial_events.sql
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
INSERT INTO public.ot_comercial_eventos(id,empresa_id,entity_id,entity_type,occurred_at,data) VALUES('55555555-5555-4555-8555-555555555555','33333333-3333-4333-8333-333333333333','66666666-6666-4666-8666-666666666666','opportunity',now(),'{"titulo":"QA","estagio":"diagnostico","recorrencia_status":"nao_contratada"}');
INSERT INTO public.ot_comercial_eventos(id,empresa_id,entity_id,entity_type,parent_id,occurred_at,data) VALUES('77777777-7777-4777-8777-777777777777','33333333-3333-4333-8333-333333333333','66666666-6666-4666-8666-666666666666','opportunity','55555555-5555-4555-8555-555555555555',now(),'{"titulo":"QA","estagio":"proposta","recorrencia_status":"nao_contratada"}');
DO $$ BEGIN
 BEGIN
  INSERT INTO public.ot_comercial_eventos(id,empresa_id,entity_id,entity_type,parent_id,occurred_at,data) VALUES(gen_random_uuid(),'33333333-3333-4333-8333-333333333333','66666666-6666-4666-8666-666666666666','opportunity','55555555-5555-4555-8555-555555555555',now(),'{"titulo":"Fork","estagio":"proposta","recorrencia_status":"nao_contratada"}');
  RAISE EXCEPTION 'Fork aceito';
 EXCEPTION WHEN unique_violation THEN NULL;END;
 BEGIN UPDATE public.ot_comercial_eventos SET data='{}';RAISE EXCEPTION 'UPDATE permitido';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 BEGIN DELETE FROM public.ot_comercial_eventos;RAISE EXCEPTION 'DELETE permitido';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
END $$;
SELECT set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.ot_comercial_eventos) THEN RAISE EXCEPTION 'B leu A';END IF;
 BEGIN
 INSERT INTO public.ot_comercial_eventos(id,owner_id,empresa_id,entity_id,entity_type,occurred_at,data) VALUES(gen_random_uuid(),'11111111-1111-4111-8111-111111111111','33333333-3333-4333-8333-333333333333',gen_random_uuid(),'opportunity',now(),'{"titulo":"Fake","estagio":"diagnostico","recorrencia_status":"nao_contratada"}');RAISE EXCEPTION 'Owner forjado aceito';
 EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 BEGIN
 INSERT INTO public.ot_comercial_eventos(id,empresa_id,entity_id,entity_type,occurred_at,data) VALUES(gen_random_uuid(),'33333333-3333-4333-8333-333333333333',gen_random_uuid(),'opportunity',now(),'{"titulo":"FK","estagio":"diagnostico","recorrencia_status":"nao_contratada"}');RAISE EXCEPTION 'Empresa alheia aceita';
 EXCEPTION WHEN foreign_key_violation THEN NULL;END;
 BEGIN
 INSERT INTO public.ot_comercial_eventos(id,empresa_id,entity_id,entity_type,occurred_at,data) VALUES(gen_random_uuid(),'44444444-4444-4444-8444-444444444444',gen_random_uuid(),'opportunity',now(),'{"titulo":"MRR falso","estagio":"proposta","recorrencia_status":"ativa","recorrencia_contratada":40000}');RAISE EXCEPTION 'MRR falso aceito';
 EXCEPTION WHEN check_violation THEN NULL;END;
END $$;
SET LOCAL ROLE anon;
DO $$ BEGIN BEGIN PERFORM 1 FROM public.ot_comercial_eventos;RAISE EXCEPTION 'Anon permitido';EXCEPTION WHEN insufficient_privilege THEN NULL;END;END $$;
ROLLBACK;
SELECT 'PASS: migração aditiva isolada, A/B, anon, FK, imutabilidade, fork, MRR, rollback de fixtures' AS resultado;
