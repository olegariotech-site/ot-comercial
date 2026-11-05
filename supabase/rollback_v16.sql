-- Reversão conservadora: manter histórico, impedir novas escritas V1.6.
-- Só executar em QA autorizado; nenhum comando em produção nesta entrega.
BEGIN;
DO $$ BEGIN IF current_setting('ot.v16_target',true) IS DISTINCT FROM 'efscgxwvaixwqhffwdqu' THEN RAISE EXCEPTION 'QA obrigatório';END IF;END $$;
REVOKE INSERT ON public.ot_comercial_eventos FROM authenticated;
COMMIT;
-- Reativação: GRANT INSERT ON public.ot_comercial_eventos TO authenticated;
-- Não DROP com dados. Exportar backup cifrado/backup administrativo e validar recuperação primeiro.
