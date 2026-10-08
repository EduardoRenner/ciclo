-- =====================================================================
-- CICLO · pacote Advocacia: documentos, versões imutáveis, vínculos e trilha de acesso (migration 0107)
--
-- docs/101 anexo 01 §2.10-§2.11, anexo 02 §3.4 (T1.4). Origem: LUBI `0023_documentos.sql`.
--
-- Bucket `legal-docs` PRIVADO e sem política em `storage.objects`: ninguém lê nem escreve objeto
-- pelo cliente do usuário. O servidor confere permissão (a RLS das tabelas abaixo, pelo cliente do
-- USUÁRIO), grava a trilha e só então assina uma URL curta com `service_role` dentro de `withTenant`.
-- É o mesmo desenho do bucket `media` (0013): a única porta é o servidor.
--
-- `legal_access_log` é a trilha de leitura sensível (documento aberto, baixado; caso sigiloso aberto),
-- append-only e sem política nenhuma: só o servidor grava e só o servidor lê (rota da direção).
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('legal-docs', 'legal-docs', false, 52428800, array[
  'application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.oasis.opendocument.text', 'text/plain'])
on conflict (id) do nothing;

create table public.legal_documents (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenants(id) on delete cascade,
  client_id           uuid not null,
  case_id             uuid,
  title               text not null check (char_length(btrim(title)) between 2 and 200),
  category            text not null default 'outro' check (category in (
                        'identificacao_pessoal', 'certidao_civil', 'pacto_antenupcial', 'comprovante_endereco',
                        'contrato_social', 'alteracao_contratual', 'ata_assembleia', 'acordo_socios', 'cartao_cnpj',
                        'procuracao', 'matricula_imovel', 'escritura', 'iptu_itr_ccir', 'contrato', 'declaracao_ir',
                        'extrato_bancario', 'contrato_bancario', 'testamento', 'peticao_decisao', 'laudo_avaliacao',
                        'comprovante_pagamento', 'outro')),
  tags                text[] not null default '{}' check (cardinality(tags) <= 20),
  current_version_id  uuid,
  issued_on           date,
  valid_until         date,
  sensitivity         text not null default 'normal' check (sensitivity in ('normal', 'sigiloso')),
  -- `cliente` = recebido do cliente (por WhatsApp, e-mail, pessoalmente) e lançado pela equipe; entra em
  -- quarentena (`recebido`) até alguém conferir. O envio direto pelo cliente (link) é P2.
  origin              text not null default 'equipe' check (origin in ('equipe', 'cliente')),
  status              text not null default 'aceito' check (status in ('recebido', 'em_conferencia', 'aceito', 'recusado')),
  refused_reason      text check (refused_reason is null or char_length(refused_reason) <= 300),
  reviewed_by         uuid references auth.users(id) on delete set null,
  reviewed_at         timestamptz,
  created_by          uuid references auth.users(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  archived_at         timestamptz,
  row_version         int not null default 1,
  unique (id, tenant_id),
  foreign key (client_id, tenant_id) references public.clients (id, tenant_id) on delete cascade,
  foreign key (case_id, tenant_id) references public.legal_cases (id, tenant_id),
  constraint legal_documents_validade check (valid_until is null or issued_on is null or valid_until >= issued_on),
  constraint legal_documents_recusa_tem_motivo check ((status = 'recusado') = (char_length(btrim(coalesce(refused_reason, ''))) >= 5)),
  constraint legal_documents_sigiloso_tem_caso check (sensitivity <> 'sigiloso' or case_id is not null),
  constraint legal_documents_cliente_comeca_em_quarentena check (origin = 'equipe' or status <> 'aceito' or reviewed_at is not null)
);
create index legal_documents_client_idx on public.legal_documents (client_id, tenant_id);
create index legal_documents_case_idx on public.legal_documents (case_id, tenant_id) where case_id is not null;
create index legal_documents_quarentena_idx on public.legal_documents (tenant_id, created_at) where status in ('recebido', 'em_conferencia');
create index legal_documents_reviewed_by_idx on public.legal_documents (reviewed_by);
create index legal_documents_created_by_idx on public.legal_documents (created_by);

create table public.legal_document_versions (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  document_id   uuid not null,
  version_no    int not null check (version_no > 0),
  -- {tenant}/{client}/{document}/{versão}: só uuids, nunca o nome original (que pode ter dado pessoal)
  storage_path  text not null unique check (storage_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9]+$'),
  mime          text not null check (mime in (
                  'application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic',
                  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                  'application/vnd.oasis.opendocument.text', 'text/plain')),
  size_bytes    bigint not null check (size_bytes > 0 and size_bytes <= 52428800),
  sha256        text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  note          text check (note is null or char_length(note) <= 300),
  removed_at    timestamptz,
  uploaded_by   uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  unique (document_id, version_no),
  unique (id, document_id),
  foreign key (document_id, tenant_id) references public.legal_documents (id, tenant_id) on delete cascade
);
create index legal_document_versions_document_idx on public.legal_document_versions (document_id, tenant_id);
create index legal_document_versions_uploaded_by_idx on public.legal_document_versions (uploaded_by);
create index legal_document_versions_tenant_idx on public.legal_document_versions (tenant_id);

alter table public.legal_documents
  add constraint legal_documents_current_version_fkey
  foreign key (current_version_id, id) references public.legal_document_versions (id, document_id);
create index legal_documents_current_version_idx on public.legal_documents (current_version_id, id) where current_version_id is not null;

create table public.legal_document_links (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  document_id  uuid not null,
  target_type  text not null check (target_type in ('person', 'entity', 'corporate_change', 'checklist_item')),
  target_id    uuid not null,
  created_at   timestamptz not null default now(),
  unique (document_id, target_type, target_id),
  foreign key (document_id, tenant_id) references public.legal_documents (id, tenant_id) on delete cascade
);
create index legal_document_links_alvo_idx on public.legal_document_links (tenant_id, target_type, target_id);
create index legal_document_links_document_fk_idx on public.legal_document_links (document_id, tenant_id);

create table public.legal_access_log (
  id           bigint generated always as identity primary key,
  at           timestamptz not null default now(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  user_id      uuid,
  client_id    uuid,
  document_id  uuid,
  version_id   uuid,
  case_id      uuid,
  kind         text not null check (kind in ('view', 'download', 'open_case', 'open_intimation')),
  ip_hash      text check (ip_hash is null or ip_hash ~ '^[0-9a-f]{16,64}$'),
  constraint legal_access_log_alvo check (
    (kind in ('view', 'download') and document_id is not null and version_id is not null)
    or (kind = 'open_case' and case_id is not null)
    or (kind = 'open_intimation'))
);
create index legal_access_log_tenant_idx on public.legal_access_log (tenant_id, at desc);
create index legal_access_log_document_idx on public.legal_access_log (document_id) where document_id is not null;

create trigger legal_documents_touch before update on public.legal_documents for each row execute function public.touch_updated_at();
-- versão é prova: só `removed_at` (eliminação LGPD, pelo servidor) pode mudar
create or replace function public.legal_versao_so_remove()
returns trigger language plpgsql set search_path = public as $$
begin
  if (to_jsonb(new) - 'removed_at') is distinct from (to_jsonb(old) - 'removed_at') then
    raise exception 'Versão de documento não se altera: envie uma versão nova.' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger legal_document_versions_imutavel before update on public.legal_document_versions
  for each row execute function public.legal_versao_so_remove();
create trigger legal_access_log_imutavel before update on public.legal_access_log
  for each row execute function public.legal_negar_alteracao();

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.legal_documents enable row level security;
alter table public.legal_documents force row level security;
alter table public.legal_document_versions enable row level security;
alter table public.legal_document_versions force row level security;
alter table public.legal_document_links enable row level security;
alter table public.legal_document_links force row level security;
alter table public.legal_access_log enable row level security;
alter table public.legal_access_log force row level security;

-- documento de caso segue o caso; documento sem caso segue o escritório (nunca o papel financeiro)
create policy legal_documents_select on public.legal_documents for select
  using (case when case_id is null then public.has_tenant(tenant_id) and public.tenant_role(tenant_id) <> 'finance'
              else public.legal_can_access_case(case_id) end);
create policy legal_documents_insert on public.legal_documents for insert
  with check (case when case_id is null then public.has_tenant(tenant_id) and public.tenant_role(tenant_id) <> 'finance'
                   else public.legal_can_access_case(case_id) end);
create policy legal_documents_update on public.legal_documents for update
  using (case when case_id is null then public.has_tenant(tenant_id) and public.tenant_role(tenant_id) <> 'finance'
              else public.legal_can_access_case(case_id) end)
  with check (public.has_tenant(tenant_id) and public.tenant_role(tenant_id) <> 'finance');

create policy legal_document_versions_select on public.legal_document_versions for select
  using (exists (select 1 from public.legal_documents d where d.id = document_id));
create policy legal_document_versions_insert on public.legal_document_versions for insert
  with check (exists (select 1 from public.legal_documents d where d.id = document_id));

create policy legal_document_links_select on public.legal_document_links for select
  using (exists (select 1 from public.legal_documents d where d.id = document_id));
create policy legal_document_links_insert on public.legal_document_links for insert
  with check (exists (select 1 from public.legal_documents d where d.id = document_id));
-- legal_access_log: sem política (só o servidor)
