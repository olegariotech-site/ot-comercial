-- OT Comercial — Gate D | Teste RLS transacional com dois usuários sintéticos.
-- EXCLUSIVAMENTE NO STAGING efscgxwvaixwqhffwdqu.
-- Cria usuários transitórios dentro de UMA TRANSAÇÃO, faz verificações
-- como role authenticated, e ROLLBACK final. Não deixa dados no projeto.
-- NÃO é criação de contas válidas para login HTTP. Não executar em produção.

BEGIN;

INSERT INTO auth.users(id,instance_id,aud,role,email,encrypted_password,created_at,updated_at)
VALUES
 ('c5111111-1111-4111-8111-111111111111','00000000-0000-0000-0000-000000000000','authenticated','authenticated','ot-rls-a@invalid.example',null,now(),now()),
 ('d6222222-2222-4222-8222-222222222222','00000000-0000-0000-0000-000000000000','authenticated','authenticated','ot-rls-b@invalid.example',null,now(),now());

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','c5111111-1111-4111-8111-111111111111',true);
SELECT set_config('request.jwt.claim.role','authenticated',true);

INSERT INTO public.ot_empresas(id,nome,briefing)
VALUES ('e7333333-3333-4333-8333-333333333333','COMERCIO TESTE RLS A','Sem dados reais');
INSERT INTO public.ot_visitas(id,empresa_id,nota)
VALUES ('f8444444-4444-4444-8444-444444444444','e7333333-3333-4333-8333-333333333333','Visita RLS sintética');

DO $$
BEGIN
 IF (SELECT count(*) FROM public.ot_empresas WHERE id='e7333333-3333-4333-8333-333333333333')<>1 THEN
   RAISE EXCEPTION 'Falha: proprietário não lê própria empresa';
 END IF;
 IF (SELECT count(*) FROM public.ot_visitas WHERE id='f8444444-4444-4444-8444-444444444444')<>1 THEN
   RAISE EXCEPTION 'Falha: proprietário não lê própria visita';
 END IF;
END$$;

SELECT set_config('request.jwt.claim.sub','d6222222-2222-4222-8222-222222222222',true);

DO $$
DECLARE rows_changed int;
        denied boolean:=false;
BEGIN
 IF EXISTS (SELECT 1 FROM public.ot_empresas WHERE id='e7333333-3333-4333-8333-333333333333') THEN
   RAISE EXCEPTION 'RLS VAZAMENTO: segundo usuário leu empresa do primeiro';
 END IF;
 IF EXISTS (SELECT 1 FROM public.ot_visitas WHERE id='f8444444-4444-4444-8444-444444444444') THEN
   RAISE EXCEPTION 'RLS VAZAMENTO: segundo usuário leu visita do primeiro';
 END IF;

 UPDATE public.ot_empresas SET nome='ALTERADO INDEVIDAMENTE'
 WHERE id='e7333333-3333-4333-8333-333333333333';
 GET DIAGNOSTICS rows_changed = ROW_COUNT;
 IF rows_changed<>0 THEN
   RAISE EXCEPTION 'RLS VAZAMENTO: segundo usuário alterou empresa do primeiro';
 END IF;

 BEGIN
   INSERT INTO public.ot_visitas(id,empresa_id,owner_id,nota)
   VALUES ('a9555555-5555-4555-8555-555555555555',
      'e7333333-3333-4333-8333-333333333333',
      'c5111111-1111-4111-8111-111111111111',
      'Tentativa de forjar dono');
 EXCEPTION WHEN insufficient_privilege OR check_violation OR foreign_key_violation THEN
   denied:=true;
 END;
 IF NOT denied THEN
   RAISE EXCEPTION 'RLS VAZAMENTO: segundo usuário forjou owner_id do primeiro';
 END IF;
END$$;

-- Se chegar aqui, tudo passou; nenhum dado sobrevive ao rollback.
RESET ROLE;
ROLLBACK;

SELECT 'RLS staging dois usuários: transação revertida'::text as resultado;
