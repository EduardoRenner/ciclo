-- Avaliação pós-atendimento (NPS sem depender de credencial de terceiro). O link é assinado
-- (HMAC via `token-assinado.ts`, mesmo mecanismo do link de confirmação e da lista de espera) —
-- não precisa de coluna de token nem de sessão para o cliente responder.
create table if not exists client_reviews (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references tenants(id) on delete cascade,
  appointment_id uuid not null references appointments(id) on delete cascade,
  client_id      uuid references clients(id) on delete set null,
  rating         smallint not null check (rating between 1 and 5),
  comment        text,
  created_at     timestamptz not null default now(),
  unique (appointment_id)
);

alter table client_reviews enable row level security;
alter table client_reviews force row level security;
create policy client_reviews_tenant_all on client_reviews for all
  using (has_tenant(tenant_id)) with check (has_tenant(tenant_id));
create index if not exists client_reviews_cliente_idx on client_reviews (tenant_id, client_id, created_at desc);
