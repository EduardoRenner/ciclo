-- P8 (docs/09-PLATAFORMA.md §11): orçamento com aprovação por link, sem tabela de token
-- dedicada (mesmo HMAC generalizado de token-assinado.ts, escopo próprio).

create table quotes (
  id                      uuid primary key default gen_random_uuid(),
  tenant_id               uuid not null references tenants(id) on delete cascade,
  client_id               uuid not null references clients(id) on delete restrict,
  professional_id         uuid not null references professionals(id) on delete restrict,
  status                  text not null default 'draft' check (status in ('draft', 'sent', 'approved', 'rejected', 'expired', 'converted')),
  total_cents             bigint not null default 0 check (total_cents >= 0),
  -- "vale por 15 dias" (§11): validade do NEGÓCIO, independente da validade técnica do token
  -- HMAC (esta é decidida pela aplicação, não pelo criador do orçamento).
  valid_until             date,
  message                 text, -- mensagem opcional visível pra cliente na tela de aprovação
  created_by              uuid references profiles(id),
  created_at              timestamptz not null default now(),
  sent_at                 timestamptz,
  approved_at             timestamptz,
  rejected_at             timestamptz,
  rejected_reason         text,
  converted_appointment_id uuid references appointments(id) on delete set null
);

create table quote_items (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references tenants(id) on delete cascade,
  quote_id          uuid not null references quotes(id) on delete cascade,
  description       text not null,
  qty               numeric(12,3) not null default 1 check (qty > 0),
  unit_price_cents  bigint not null check (unit_price_cents >= 0),
  total_cents       bigint not null check (total_cents >= 0)
);

create index quotes_tenant_idx on quotes(tenant_id);
create index quotes_professional_idx on quotes(professional_id);
create index quotes_client_idx on quotes(client_id);
create index quote_items_quote_idx on quote_items(quote_id);

alter table quotes enable row level security;
alter table quotes force row level security;
alter table quote_items enable row level security;
alter table quote_items force row level security;

create policy quotes_select on quotes for select
  using (public.has_tenant(tenant_id) and public.can_see_appointment(tenant_id, professional_id));

create policy quotes_insert on quotes for insert
  with check (public.has_tenant(tenant_id));

create policy quotes_update on quotes for update
  using (public.has_tenant(tenant_id) and public.can_see_appointment(tenant_id, professional_id))
  with check (public.has_tenant(tenant_id));

create policy quotes_delete on quotes for delete
  using (public.has_tenant(tenant_id) and public.tenant_role(tenant_id) in ('owner', 'manager'));

-- Item herda a visibilidade do orçamento-pai via join — mais simples e igual ao padrão de
-- ticket_items (mesma tenant_id, sem cruzar professional_id de novo).
create policy quote_items_select on quote_items for select
  using (public.has_tenant(tenant_id));

create policy quote_items_insert on quote_items for insert
  with check (public.has_tenant(tenant_id));

create policy quote_items_update on quote_items for update
  using (public.has_tenant(tenant_id))
  with check (public.has_tenant(tenant_id));

create policy quote_items_delete on quote_items for delete
  using (public.has_tenant(tenant_id) and public.tenant_role(tenant_id) in ('owner', 'manager'));
