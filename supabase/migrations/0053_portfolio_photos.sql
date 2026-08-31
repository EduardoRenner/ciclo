-- TICKET-115 (docs/35-FOTOS-CONSENTIMENTO-PLANO.md) — "publicar no site". A foto sai do bucket
-- privado `media` e vira uma CÓPIA própria no bucket público `vitrine`, mesma disciplina de
-- logo/capa/serviço/profissional (0051/0052): aquele bucket é privado de propósito (URL assinada
-- de 5 minutos, acesso registrado em vault_access_log) — forçar isso na leitura da vitrine
-- pública quebraria cache e a prévia de link do WhatsApp, que lê sem sessão nenhuma.
--
-- `client_id` fica na linha só para a revogação em cascata (`revogarConsentimento`, alterado
-- junto): revogar `image_use` precisa achar e apagar toda foto publicada daquela cliente, sem
-- depender de `source_media_id` sobreviver (`on delete set null`).
create table portfolio_photos (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references tenants(id) on delete cascade,
  client_id        uuid not null references clients(id) on delete cascade,
  source_media_id  uuid references media(id) on delete set null,
  storage_key      text not null,
  created_at       timestamptz not null default now()
);

create index portfolio_photos_tenant_idx on portfolio_photos(tenant_id, created_at desc);
create index portfolio_photos_client_idx on portfolio_photos(tenant_id, client_id);

alter table portfolio_photos enable row level security;
alter table portfolio_photos force row level security;

-- Mesmo padrão-blanket da 0001 (`tenant_tables`) — nada aqui precisa de trava por papel além do
-- que a rota já confere (`client:update`); a leitura pública passa por service_role, não por RLS.
create policy portfolio_photos_tenant_all on portfolio_photos
  for all
  using (public.has_tenant(tenant_id))
  with check (public.has_tenant(tenant_id));
