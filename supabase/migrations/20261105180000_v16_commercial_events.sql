-- V1.6: ADITIVA. Aplicar somente em banco isolado de testes ou QA efscgxwvaixwqhffwdqu.
-- Nenhuma tabela/linha/policy da RC1 é alterada. Este arquivo não foi aplicado em produção.
BEGIN;
DO $$ BEGIN
 IF coalesce(current_setting('ot.v16_target',true),'') NOT IN ('isolated-test','efscgxwvaixwqhffwdqu')
 THEN RAISE EXCEPTION 'Destino V1.6 não autorizado; defina ot.v16_target explicitamente'; END IF;
END $$;
CREATE TABLE public.ot_comercial_eventos (
 id uuid PRIMARY KEY,
 owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
 empresa_id uuid NOT NULL,
 entity_id uuid NOT NULL,
 entity_type text NOT NULL CHECK(entity_type IN ('opportunity','action')),
 parent_id uuid,
 occurred_at timestamptz NOT NULL,
 data jsonb NOT NULL CHECK(jsonb_typeof(data)='object' AND octet_length(data::text)<=32768),
 created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT ot_v16_company_owner_fk FOREIGN KEY(empresa_id,owner_id) REFERENCES public.ot_empresas(id,owner_id) ON DELETE CASCADE,
 CONSTRAINT ot_v16_parent_target UNIQUE(id,entity_id,entity_type,empresa_id,owner_id),
 CONSTRAINT ot_v16_parent_fk FOREIGN KEY(parent_id,entity_id,entity_type,empresa_id,owner_id) REFERENCES public.ot_comercial_eventos(id,entity_id,entity_type,empresa_id,owner_id) ON DELETE CASCADE,
 CONSTRAINT ot_v16_not_self CHECK(parent_id IS NULL OR parent_id<>id),
 CONSTRAINT ot_v16_data_kind CHECK(coalesce(
  CASE WHEN entity_type='opportunity' THEN length(btrim(data->>'titulo')) BETWEEN 1 AND 150 AND data->>'estagio' IN ('diagnostico','proposta','negociacao','ganho','perdido') AND data->>'recorrencia_status' IN ('nao_contratada','ativa','encerrada')
  ELSE length(btrim(data->>'descricao')) BETWEEN 1 AND 500 AND data->>'estado' IN ('aberta','concluida','cancelada') AND data->>'tipo' IN ('retorno','apresentacao','proposta','pos_venda','outro') END,false)),
 CONSTRAINT ot_v16_money CHECK(entity_type<>'opportunity' OR (
  (data->>'implantacao_proposta' IS NULL OR data->>'implantacao_proposta' ~ '^\d{1,12}$') AND
  (data->>'mensalidade_proposta' IS NULL OR data->>'mensalidade_proposta' ~ '^\d{1,12}$') AND
  (data->>'valor_fechado' IS NULL OR data->>'valor_fechado' ~ '^\d{1,12}$') AND
  (data->>'recorrencia_contratada' IS NULL OR data->>'recorrencia_contratada' ~ '^\d{1,12}$'))),
 CONSTRAINT ot_v16_won_value CHECK(entity_type<>'opportunity' OR data->>'estagio'<>'ganho' OR data->>'valor_fechado' IS NOT NULL),
 CONSTRAINT ot_v16_recurring_agreement CHECK(entity_type<>'opportunity' OR data->>'recorrencia_status'<>'ativa' OR coalesce(
  data->>'estagio'='ganho' AND (data->>'recorrencia_contratada')::numeric>0 AND length(btrim(data->>'escopo_mensal'))>0 AND length(btrim(data->>'entregas_mensais'))>0 AND length(btrim(data->>'frequencia'))>0 AND data->>'contratado_em' ~ '^\d{4}-\d{2}-\d{2}$',false)),
 CONSTRAINT ot_v16_lost_reason CHECK(entity_type<>'opportunity' OR data->>'estagio'<>'perdido' OR coalesce(length(btrim(data->>'motivo_perda'))>0,false)),
 CONSTRAINT ot_v16_outcome CHECK(entity_type<>'action' OR data->>'estado'='aberta' OR coalesce(length(btrim(data->>'resultado'))>0 AND data->>'concluida_em' IS NOT NULL,false)),
 CONSTRAINT ot_v16_continuity CHECK(entity_type<>'action' OR data->>'estado'<>'concluida' OR coalesce(data->>'encerramento'='true' OR data->>'proxima_acao_id' IS NOT NULL,false))
);
CREATE UNIQUE INDEX ot_v16_one_creation ON public.ot_comercial_eventos(owner_id,entity_type,entity_id) WHERE parent_id IS NULL;
CREATE UNIQUE INDEX ot_v16_one_successor ON public.ot_comercial_eventos(parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX ot_v16_owner_id ON public.ot_comercial_eventos(owner_id,id);
CREATE INDEX ot_v16_company_owner ON public.ot_comercial_eventos(empresa_id,owner_id);
ALTER TABLE public.ot_comercial_eventos ENABLE ROW LEVEL SECURITY;
CREATE POLICY ot_v16_read ON public.ot_comercial_eventos FOR SELECT TO authenticated USING(owner_id=(SELECT auth.uid()));
CREATE POLICY ot_v16_append ON public.ot_comercial_eventos FOR INSERT TO authenticated WITH CHECK(owner_id=(SELECT auth.uid()) AND (entity_type<>'action' OR data->>'oportunidade_id' IS NULL OR EXISTS(
 SELECT 1 FROM public.ot_comercial_eventos o WHERE o.owner_id=(SELECT auth.uid()) AND o.empresa_id=ot_comercial_eventos.empresa_id AND o.entity_type='opportunity' AND o.entity_id::text=ot_comercial_eventos.data->>'oportunidade_id'
)));
REVOKE ALL ON public.ot_comercial_eventos FROM anon,authenticated;
GRANT SELECT,INSERT ON public.ot_comercial_eventos TO authenticated;
COMMENT ON TABLE public.ot_comercial_eventos IS 'Histórico V1.6 append-only. IDs fixos, parent único para conflito explícito, empresa/titular preservados. Sem UPDATE/DELETE de eventos pelo cliente.';
COMMIT;
