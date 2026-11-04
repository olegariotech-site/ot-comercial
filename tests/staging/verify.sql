-- OT Comercial Gate D: verificações somente leitura em uma única consulta.
-- Destino: projeto de homologação efscgxwvaixwqhffwdqu. Nunca produção.
with
  rls as (select count(*)::int n from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname in ('ot_empresas','ot_visitas','ot_fotos') and c.relrowsecurity),
  policies as (select count(*)::int n from pg_policies where schemaname='public' and tablename in ('ot_empresas','ot_visitas','ot_fotos')),
  owner_policies as (select count(*)::int n from pg_policies where schemaname='public' and tablename in ('ot_empresas','ot_visitas','ot_fotos') 
    and (coalesce(qual,'') like '%auth.uid()%' or coalesce(with_check,'') like '%auth.uid()%')),
  storage_policies as (select count(*)::int n from pg_policies where schemaname='storage' and tablename='objects' and policyname in ('ot_storage_read','ot_storage_insert','ot_storage_delete')),
  bucket as (select count(*)::int n from storage.buckets where id='ot-clientes-privado' and not public and file_size_limit=6291456
    and allowed_mime_types @> array['image/jpeg','image/png','image/webp']::text[]),
  fks as (select count(*)::int n from pg_constraint where conrelid in ('public.ot_visitas'::regclass,'public.ot_fotos'::regclass)
    and contype='f' and confrelid='public.ot_empresas'::regclass and array_length(conkey,1)=2)
select
 (select n from rls)=3 as rls_tres_tabelas,
 (select n from policies)=12 as doze_politicas_crm,
 (select n from owner_policies)=12 as ownership_em_todas_politicas,
 (select n from storage_policies)=3 as storage_com_tres_politicas,
 (select n from bucket)=1 as bucket_privado_6mb,
 (select n from fks)=2 as fks_compostas,
 not has_table_privilege('anon','public.ot_empresas','select') as anon_sem_leitura_empresas,
 not has_table_privilege('anon','public.ot_visitas','select') as anon_sem_leitura_visitas,
 not has_table_privilege('anon','public.ot_fotos','select') as anon_sem_leitura_fotos,
 has_table_privilege('authenticated','public.ot_empresas','select') as autenticado_tem_acesso_sujeito_rls,
 (select count(*)=0 from public.ot_empresas) as empresas_vazias,
 (select count(*)=0 from public.ot_visitas) as visitas_vazias,
 (select count(*)=0 from public.ot_fotos) as fotos_vazias;
-- A permissão SQL não substitui os testes HTTP com dois usuários distintos.
