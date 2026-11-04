-- OT Gate D | executar somente no Supabase de HOMOLOGAÇÃO.
-- Somente consultas de verificação, nenhuma mutação de dados.

select 'rls_tabelas' as teste,
       count(*)=3 as aprovado,
       string_agg(tablename, ', ' order by tablename) as detalhes
from pg_tables t
join pg_class c on c.relname=t.tablename
join pg_namespace n on n.oid=c.relnamespace and n.nspname='public'
where t.schemaname='public'
  and t.tablename in ('ot_empresas','ot_visitas','ot_fotos')
  and c.relrowsecurity;

select 'politicas_crm' as teste,
       count(*)=12 as aprovado,
       count(*)::text as detalhes
from pg_policies
where schemaname='public'
  and tablename in ('ot_empresas','ot_visitas','ot_fotos')
  and roles::text like '%authenticated%';

select 'bucket_privado_6mb' as teste,
       count(*)=1 as aprovado,
       coalesce(max(name),'não encontrado') as detalhes
from storage.buckets
where id='ot-clientes-privado'
  and public=false
  and file_size_limit=6291456
  and allowed_mime_types @> array['image/jpeg','image/png','image/webp']::text[];

select 'storage_3_politicas' as teste,
       count(*)=3 as aprovado,
       string_agg(policyname, ', ' order by policyname) as detalhes
from pg_policies
where schemaname='storage'
 and tablename='objects'
 and policyname in ('ot_storage_read','ot_storage_insert','ot_storage_delete');

select 'staging_vazio' as teste,
  ((select count(*) from public.ot_empresas)=0
  and (select count(*) from public.ot_visitas)=0
  and (select count(*) from public.ot_fotos)=0) as aprovado,
  'Não importar dados, fotos nem usuários da produção' as detalhes;

select 'FK_composta' as teste,
  count(*)=2 as aprovado,
  string_agg(conrelid::regclass::text, ', ') as detalhes
from pg_constraint
where conrelid in ('public.ot_visitas'::regclass,'public.ot_fotos'::regclass)
  and contype='f' and confrelid='public.ot_empresas'::regclass
  and array_length(conkey,1)=2;

-- A verificação RLS de acesso entre dois usuários deve ser feita pela API
-- com dois JWTs de TESTE autenticados. Testes SQL via postgres não provam RLS.
