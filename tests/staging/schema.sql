-- OLEGARIO TECH | Gate D — somente PROJETO DE HOMOLOGAÇÃO NOVO e VAZIO.
-- Fonte: estrutura/policies inspecionadas no projeto OT Comercial em 04/11/2026,
-- SEM copiar usuários, contatos, visitas, imagens, tokens nem outros dados.
-- NUNCA rodar no projeto produtivo agvjqxmrzffkksrgdndn.
-- Executar somente após aprovar o Supabase staging separado de custo R$ 0.

begin;

create table public.ot_empresas (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id),
  nome text not null check (length(btrim(nome)) between 2 and 120),
  segmento text not null default 'Outro',
  bairro text not null default '',
  cidade text not null default 'Valinhos',
  endereco text not null default '',
  responsavel text not null default '',
  whatsapp text not null default '',
  presenca_digital text not null default '',
  briefing text not null default '' check (length(briefing) <= 5000),
  observacoes text not null default '' check (length(observacoes) <= 3000),
  status text not null default 'Primeira visita'
    check(status in ('Primeira visita','Interessado','Retornar ao decisor',
      'Proposta solicitada','Em negociação','Cliente fechado','Sem interesse')),
  retorno_em date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ot_empresas_id_owner_id_key unique(id,owner_id)
);

create table public.ot_visitas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  owner_id uuid not null default auth.uid() references auth.users(id),
  realizado_em timestamptz not null default now(),
  nota text not null default '' check(length(nota) <= 3000),
  proximo_passo text not null default '' check(length(proximo_passo) <= 1000),
  retorno_em date,
  constraint ot_visitas_empresa_id_owner_id_fkey
    foreign key (empresa_id,owner_id) references public.ot_empresas(id,owner_id)
      on delete cascade
);

create table public.ot_fotos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  owner_id uuid not null default auth.uid() references auth.users(id),
  storage_path text not null unique
    check(storage_path like owner_id::text || '/' || empresa_id::text || '/%'),
  arquivo_nome text not null,
  categoria text not null default 'Outro',
  descricao text not null default '' check(length(descricao) <= 300),
  publicacao_autorizada boolean not null default false,
  bytes bigint not null default 0,
  created_at timestamptz not null default now(),
  constraint ot_fotos_empresa_id_owner_id_fkey
    foreign key (empresa_id,owner_id) references public.ot_empresas(id,owner_id)
      on delete cascade
);

create index ot_empresas_owner_bairro on public.ot_empresas(owner_id,bairro);
create index ot_empresas_owner_retorno on public.ot_empresas(owner_id,retorno_em);
create index ot_visitas_empresa on public.ot_visitas(owner_id,empresa_id,realizado_em desc);
create index ot_visitas_empresa_fk on public.ot_visitas(empresa_id,owner_id);
create index ot_fotos_empresa on public.ot_fotos(owner_id,empresa_id);
create index ot_fotos_empresa_fk on public.ot_fotos(empresa_id,owner_id);

alter table public.ot_empresas enable row level security;
alter table public.ot_visitas enable row level security;
alter table public.ot_fotos enable row level security;

-- Estritamente por usuário autenticado: não aceitar ownership passado pelo cliente.
create policy ot_empresas_select on public.ot_empresas for select to authenticated
 using (owner_id=(select auth.uid()));
create policy ot_empresas_insert on public.ot_empresas for insert to authenticated
 with check (owner_id=(select auth.uid()));
create policy ot_empresas_update on public.ot_empresas for update to authenticated
 using (owner_id=(select auth.uid())) with check (owner_id=(select auth.uid()));
create policy ot_empresas_delete on public.ot_empresas for delete to authenticated
 using (owner_id=(select auth.uid()));

create policy ot_visitas_select on public.ot_visitas for select to authenticated
 using (owner_id=(select auth.uid()));
create policy ot_visitas_insert on public.ot_visitas for insert to authenticated
 with check (owner_id=(select auth.uid()));
create policy ot_visitas_update on public.ot_visitas for update to authenticated
 using (owner_id=(select auth.uid())) with check (owner_id=(select auth.uid()));
create policy ot_visitas_delete on public.ot_visitas for delete to authenticated
 using (owner_id=(select auth.uid()));

create policy ot_fotos_select on public.ot_fotos for select to authenticated
 using (owner_id=(select auth.uid()));
create policy ot_fotos_insert on public.ot_fotos for insert to authenticated
 with check (owner_id=(select auth.uid()));
create policy ot_fotos_update on public.ot_fotos for update to authenticated
 using (owner_id=(select auth.uid())) with check (owner_id=(select auth.uid()));
create policy ot_fotos_delete on public.ot_fotos for delete to authenticated
 using (owner_id=(select auth.uid()));

revoke all on public.ot_empresas, public.ot_visitas, public.ot_fotos from anon;
grant usage on schema public to authenticated;
grant select,insert,update,delete on public.ot_empresas,public.ot_visitas,public.ot_fotos to authenticated;

-- Armazenamento de testes: nome conhecido do app, completamente isolado por projeto.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('ot-clientes-privado','ot-clientes-privado',false,6291456,
  array['image/jpeg','image/png','image/webp']::text[])
on conflict (id) do nothing;

-- Políticas Storage: somente seu próprio prefixo, e somente empresas de sua conta.
create policy ot_storage_read on storage.objects for select to authenticated
 using (bucket_id='ot-clientes-privado'
   and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy ot_storage_insert on storage.objects for insert to authenticated
 with check (
   bucket_id='ot-clientes-privado'
   and (storage.foldername(name))[1]=(select auth.uid())::text
   and exists (
     select 1 from public.ot_empresas e
     where e.owner_id=(select auth.uid())
       and e.id::text=(storage.foldername(name))[2]
   )
 );
create policy ot_storage_delete on storage.objects for delete to authenticated
 using (bucket_id='ot-clientes-privado'
  and (storage.foldername(name))[1]=(select auth.uid())::text);

commit;

-- Validação obrigatória, rodar no staging após criar usuário de testes:
-- 1. Contar 3 tabelas com RLS habilitada;
-- 2. Contar 12 políticas de tabela e 3 de Storage;
-- 3. Bucket privado, 6 MB, MIME jpeg/png/webp;
-- 4. API autenticada cria 1 empresa + visita + foto; anon recebe 401/403
--    ou lista vazia sem vazamento;
-- 5. Outra conta autenticada não vê, altera nem apaga os registros de teste.
