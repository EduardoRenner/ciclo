-- =====================================================================
-- CICLO · schema completo (migration 0001)
-- Postgres 15+ / Supabase
--
-- Convenções:
--   · dinheiro em centavos (bigint, sufixo _cents)
--   · percentual em basis points (int, sufixo _bps · 3000 = 30%)
--   · datas sempre timestamptz (UTC); fuso do tenant só na apresentação
--   · toda tabela de negócio tem tenant_id NOT NULL + RLS
-- =====================================================================

create extension if not exists pgcrypto;      -- gen_random_uuid, digest
create extension if not exists btree_gist;    -- exclusion constraint com uuid
create extension if not exists pg_trgm;       -- busca por nome
create extension if not exists citext;        -- e-mail case-insensitive

-- ---------------------------------------------------------------------
-- 0. ENUMS
-- ---------------------------------------------------------------------
create type user_role          as enum ('owner','manager','professional','reception','finance');
create type vertical_pack      as enum ('barber','nails','lashes','brows','waxing','aesthetics','tattoo','hair');
create type plan_tier          as enum ('start','pro','studio','network');
create type appointment_status as enum ('pending','confirmed','arrived','done','no_show','canceled','expired');
create type appointment_origin as enum ('app','public_page','whatsapp','recurring','waitlist','import');
create type cycle_state        as enum ('on_track','due','late','at_risk','lost');
create type ticket_status      as enum ('open','closed','paid','canceled','refunded');
create type payment_method     as enum ('pix','credit','debit','cash','club','package','voucher','other');
create type payment_status     as enum ('pending','paid','failed','refunded','expired','canceled');
create type payment_kind       as enum ('deposit','service','product','club','fee');
create type comp_model         as enum ('commission','rent','hybrid','owner');
create type stock_move_type    as enum ('in','out','adjust','loss','return');
create type consent_type       as enum ('health_data','image_use','marketing','terms');
create type message_channel    as enum ('whatsapp','sms','push','email');
create type message_status     as enum ('queued','sent','delivered','read','failed','opted_out');
create type message_kind       as enum ('reminder','confirmation','cycle','campaign','transactional','review');
create type job_status         as enum ('queued','running','done','failed','dead');

-- ---------------------------------------------------------------------
-- 1. TENANTS, USUÁRIOS E PAPÉIS
-- ---------------------------------------------------------------------
create table tenants (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  slug            citext not null unique,
  vertical        vertical_pack not null,
  plan            plan_tier not null default 'start',
  timezone        text not null default 'America/Sao_Paulo',
  currency        char(3) not null default 'BRL',
  phone           text,
  document        text,                       -- CNPJ/CPF (cifrado na aplicação se preenchido)
  address         jsonb,
  settings        jsonb not null default '{}'::jsonb,
  trial_ends_at   timestamptz,
  created_at      timestamptz not null default now(),
  deleted_at      timestamptz,
  constraint tenants_slug_format check (slug ~ '^[a-z0-9][a-z0-9-]{2,38}[a-z0-9]$')
);

-- espelho de auth.users (Supabase)
create table profiles (
  id            uuid primary key,             -- = auth.users.id
  full_name     text not null,
  email         citext,
  phone         text,
  avatar_url    text,
  locale        text not null default 'pt-BR',
  created_at    timestamptz not null default now()
);

create table memberships (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  user_id      uuid not null references profiles(id) on delete cascade,
  role         user_role not null,
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  unique (tenant_id, user_id)
);
create index on memberships (user_id) where active;
create index on memberships (tenant_id) where active;

-- chave de dados (envelope encryption) — DEK cifrada pela KEK da aplicação
create table tenant_keys (
  tenant_id     uuid primary key references tenants(id) on delete cascade,
  dek_wrapped   bytea not null,
  key_version   int  not null default 1,
  rotated_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 2. PROFISSIONAIS, EXPEDIENTE E SERVIÇOS
-- ---------------------------------------------------------------------
create table professionals (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references tenants(id) on delete cascade,
  user_id           uuid references profiles(id) on delete set null,
  display_name      text not null,
  avatar_url        text,
  bio               text,
  color             text,                                   -- cor na agenda
  comp_model        comp_model not null default 'owner',
  commission_bps    int not null default 0 check (commission_bps between 0 and 10000),
  rent_cents        bigint not null default 0 check (rent_cents >= 0),
  accepts_online    boolean not null default true,
  active            boolean not null default true,
  created_at        timestamptz not null default now(),
  deleted_at        timestamptz
);
create index on professionals (tenant_id) where deleted_at is null;

create table business_hours (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references tenants(id) on delete cascade,
  professional_id  uuid references professionals(id) on delete cascade,   -- null = padrão do tenant
  weekday          int not null check (weekday between 0 and 6),          -- 0 = domingo
  opens_at         time not null,
  closes_at        time not null,
  check (closes_at > opens_at)
);
create index on business_hours (tenant_id, professional_id, weekday);

create table time_off (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references tenants(id) on delete cascade,
  professional_id  uuid references professionals(id) on delete cascade,   -- null = fecha o estabelecimento
  starts_at        timestamptz not null,
  ends_at          timestamptz not null,
  reason           text,
  created_at       timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index on time_off (tenant_id, starts_at, ends_at);

create table service_categories (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  name        text not null,
  position    int not null default 0
);

create table services (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references tenants(id) on delete cascade,
  category_id         uuid references service_categories(id) on delete set null,
  name                text not null,
  description         text,
  duration_min        int  not null check (duration_min between 5 and 720),
  buffer_before_min   int  not null default 0 check (buffer_before_min >= 0),
  buffer_after_min    int  not null default 0 check (buffer_after_min  >= 0),
  price_cents         bigint not null check (price_cents >= 0),
  cost_cents          bigint not null default 0 check (cost_cents >= 0),   -- estimado; o real vem do estoque
  cycle_days          int  not null default 21 check (cycle_days between 1 and 365),
  deposit_bps         int  not null default 0 check (deposit_bps between 0 and 10000),
  deposit_min_cents   bigint not null default 0,
  parallel_capacity   int  not null default 1 check (parallel_capacity >= 1),
  requires_anamnesis  boolean not null default false,
  bookable_online     boolean not null default true,
  active              boolean not null default true,
  position            int not null default 0,
  created_at          timestamptz not null default now(),
  deleted_at          timestamptz
);
create index on services (tenant_id) where deleted_at is null and active;

create table professional_services (
  tenant_id        uuid not null references tenants(id) on delete cascade,
  professional_id  uuid not null references professionals(id) on delete cascade,
  service_id       uuid not null references services(id) on delete cascade,
  duration_min     int,                        -- sobrescreve a duração padrão (aprendida com o uso)
  price_cents      bigint,                     -- sobrescreve o preço
  commission_bps   int check (commission_bps between 0 and 10000),
  primary key (professional_id, service_id)
);

-- ---------------------------------------------------------------------
-- 3. PRODUTOS E ESTOQUE
-- ---------------------------------------------------------------------
create table products (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references tenants(id) on delete cascade,
  name              text not null,
  sku               text,
  unit              text not null default 'un',           -- un, ml, g
  avg_cost_cents    bigint not null default 0,            -- média móvel ponderada
  price_cents       bigint,                               -- se for revendido
  stock_qty         numeric(12,3) not null default 0,
  reorder_point     numeric(12,3) not null default 0,
  expires_at        date,
  is_retail         boolean not null default false,
  active            boolean not null default true,
  created_at        timestamptz not null default now(),
  deleted_at        timestamptz
);
create index on products (tenant_id) where deleted_at is null;

-- ficha de consumo: quanto cada serviço gasta de cada produto
create table service_products (
  tenant_id   uuid not null references tenants(id) on delete cascade,
  service_id  uuid not null references services(id) on delete cascade,
  product_id  uuid not null references products(id) on delete cascade,
  qty         numeric(12,3) not null check (qty > 0),
  primary key (service_id, product_id)
);

create table stock_moves (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  product_id    uuid not null references products(id) on delete cascade,
  kind          stock_move_type not null,
  qty           numeric(12,3) not null,                  -- positivo entrada, negativo saída
  unit_cost_cents bigint,
  source        text,                                    -- 'ticket', 'manual', 'purchase', 'reversal'
  source_id     uuid,
  note          text,
  created_by    uuid references profiles(id),
  created_at    timestamptz not null default now()
);
create index on stock_moves (tenant_id, product_id, created_at desc);

-- ---------------------------------------------------------------------
-- 4. CLIENTES
-- ---------------------------------------------------------------------
create table clients (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references tenants(id) on delete cascade,
  name              text not null,
  phone_e164        text,                                  -- +5511999999999
  phone_hash        text,                                  -- sha256(phone + salt do tenant) para busca sem expor
  email             citext,
  birth_date        date,
  notes             text,                                  -- notas livres (NÃO usar para dado de saúde)
  tags              text[] not null default '{}',
  source            text,                                  -- instagram, indicação, google, walk-in
  referred_by       uuid references clients(id) on delete set null,
  marketing_opt_in  boolean not null default false,
  whatsapp_opt_out  boolean not null default false,
  no_show_count     int not null default 0,
  visits_count      int not null default 0,
  ltv_cents         bigint not null default 0,
  last_visit_at     timestamptz,
  user_id           uuid references profiles(id) on delete set null,   -- se criou conta no app da cliente
  created_at        timestamptz not null default now(),
  deleted_at        timestamptz,
  anonymized_at     timestamptz
);
create index on clients (tenant_id) where deleted_at is null;
create index on clients (tenant_id, phone_hash);
create index clients_name_trgm on clients using gin (name gin_trgm_ops);
create unique index clients_unique_phone on clients (tenant_id, phone_e164)
  where phone_e164 is not null and deleted_at is null;

-- ---------------------------------------------------------------------
-- 5. AGENDA
-- ---------------------------------------------------------------------
create table appointments (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references tenants(id) on delete cascade,
  client_id         uuid references clients(id) on delete set null,
  professional_id   uuid not null references professionals(id) on delete restrict,
  service_id        uuid not null references services(id) on delete restrict,
  starts_at         timestamptz not null,
  ends_at           timestamptz not null,
  status            appointment_status not null default 'pending',
  origin            appointment_origin not null default 'app',
  price_cents       bigint not null default 0,
  deposit_cents     bigint not null default 0,
  hold_expires_at   timestamptz,                            -- reserva aguardando o sinal
  confirmed_at      timestamptz,
  arrived_at        timestamptz,
  completed_at      timestamptz,
  canceled_at       timestamptz,
  canceled_by       text,                                   -- 'client' | 'professional' | 'system'
  cancel_reason     text,
  no_show_score     numeric(4,3),
  risk_features     jsonb,
  recurrence_id     uuid,
  client_note       text,
  internal_note     text,
  created_by        uuid references profiles(id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  period            tstzrange generated always as (tstzrange(starts_at, ends_at, '[)')) stored,
  check (ends_at > starts_at)
);

-- impede agendamento sobreposto para o mesmo profissional (à prova de corrida)
alter table appointments
  add constraint appointments_no_overlap
  exclude using gist (professional_id with =, period with &&)
  where (status in ('pending','confirmed','arrived'));

create index on appointments (tenant_id, starts_at);
create index on appointments (tenant_id, professional_id, starts_at);
create index on appointments (tenant_id, client_id, starts_at desc);
create index on appointments (tenant_id, status, hold_expires_at) where status = 'pending';

create table waitlist (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references tenants(id) on delete cascade,
  client_id        uuid not null references clients(id) on delete cascade,
  service_id       uuid not null references services(id) on delete cascade,
  professional_id  uuid references professionals(id) on delete set null,
  earliest_at      timestamptz,
  latest_at        timestamptz,
  weekdays         int[],
  period_of_day    text,                                    -- morning | afternoon | evening
  notified_at      timestamptz,
  fulfilled_at     timestamptz,
  created_at       timestamptz not null default now()
);
create index on waitlist (tenant_id) where fulfilled_at is null;

-- ---------------------------------------------------------------------
-- 6. MOTOR DE CICLO
-- ---------------------------------------------------------------------
create table client_cycles (
  tenant_id            uuid not null references tenants(id) on delete cascade,
  client_id            uuid not null references clients(id) on delete cascade,
  service_id           uuid not null references services(id) on delete cascade,
  personal_cycle_days  int not null,
  last_visit_on        date,
  predicted_on         date,
  late_days            int not null default 0,
  state                cycle_state not null default 'on_track',
  value_at_risk_cents  bigint not null default 0,
  last_campaign_at     timestamptz,
  computed_at          timestamptz not null default now(),
  primary key (tenant_id, client_id, service_id)
);
create index on client_cycles (tenant_id, state, value_at_risk_cents desc);
create index on client_cycles (tenant_id, predicted_on);

-- ---------------------------------------------------------------------
-- 7. COMANDA, PAGAMENTOS E COMISSÃO
-- ---------------------------------------------------------------------
create table tickets (                                       -- comanda
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references tenants(id) on delete cascade,
  client_id         uuid references clients(id) on delete set null,
  appointment_id    uuid references appointments(id) on delete set null,
  professional_id   uuid references professionals(id) on delete set null,
  status            ticket_status not null default 'open',
  subtotal_cents    bigint not null default 0,
  discount_cents    bigint not null default 0,
  tip_cents         bigint not null default 0,
  total_cents       bigint not null default 0,
  material_cost_cents bigint not null default 0,
  fee_cents         bigint not null default 0,
  commission_cents  bigint not null default 0,
  profit_cents      bigint not null default 0,
  closed_at         timestamptz,
  created_by        uuid references profiles(id),
  created_at        timestamptz not null default now(),
  check (discount_cents >= 0 and tip_cents >= 0)
);
create index on tickets (tenant_id, created_at desc);
create index on tickets (tenant_id, status);

create table ticket_items (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references tenants(id) on delete cascade,
  ticket_id        uuid not null references tickets(id) on delete cascade,
  service_id       uuid references services(id) on delete set null,
  product_id       uuid references products(id) on delete set null,
  professional_id  uuid references professionals(id) on delete set null,
  description      text not null,
  qty              numeric(12,3) not null default 1 check (qty > 0),
  unit_price_cents bigint not null check (unit_price_cents >= 0),
  discount_cents   bigint not null default 0,
  total_cents      bigint not null,
  commission_bps   int not null default 0,                  -- congelado no momento
  commission_cents bigint not null default 0,
  cost_cents       bigint not null default 0,
  check (service_id is not null or product_id is not null)
);
create index on ticket_items (tenant_id, ticket_id);

create table payments (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references tenants(id) on delete cascade,
  ticket_id         uuid references tickets(id) on delete set null,
  appointment_id    uuid references appointments(id) on delete set null,
  client_id         uuid references clients(id) on delete set null,
  kind              payment_kind not null,
  method            payment_method not null,
  status            payment_status not null default 'pending',
  amount_cents      bigint not null check (amount_cents > 0),
  fee_cents         bigint not null default 0,
  net_cents         bigint,
  installments      int not null default 1,
  psp               text,
  psp_charge_id     text,
  psp_payload       jsonb,
  pix_qr            text,
  pix_copy_paste    text,
  expires_at        timestamptz,
  paid_at           timestamptz,
  refunded_at       timestamptz,
  refund_amount_cents bigint,
  created_at        timestamptz not null default now()
);
create unique index on payments (psp, psp_charge_id) where psp_charge_id is not null;
create index on payments (tenant_id, created_at desc);
create index on payments (tenant_id, status) where status = 'pending';

create table commissions (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references tenants(id) on delete cascade,
  professional_id  uuid not null references professionals(id) on delete cascade,
  ticket_item_id   uuid references ticket_items(id) on delete cascade,
  period_start     date not null,
  period_end       date not null,
  base_cents       bigint not null,
  bps              int not null,
  amount_cents     bigint not null,
  settled_at       timestamptz,
  created_at       timestamptz not null default now()
);
create index on commissions (tenant_id, professional_id, period_start);

-- ---------------------------------------------------------------------
-- 8. PACOTES E CRÉDITOS
-- ---------------------------------------------------------------------
create table packages (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references tenants(id) on delete cascade,
  client_id      uuid not null references clients(id) on delete cascade,
  service_id     uuid not null references services(id) on delete restrict,
  total_sessions int not null check (total_sessions > 0),
  used_sessions  int not null default 0,
  paid_cents     bigint not null default 0,
  expires_on     date,
  created_at     timestamptz not null default now(),
  check (used_sessions <= total_sessions)
);
create index on packages (tenant_id, client_id);

create table package_uses (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references tenants(id) on delete cascade,
  package_id     uuid not null references packages(id) on delete cascade,
  appointment_id uuid references appointments(id) on delete set null,
  used_at        timestamptz not null default now()
);

create table wallet_entries (                                -- crédito da cliente (sinal virado crédito, cortesia)
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  client_id    uuid not null references clients(id) on delete cascade,
  amount_cents bigint not null,                              -- positivo crédito, negativo consumo
  reason       text not null,
  source_id    uuid,
  expires_on   date,
  created_at   timestamptz not null default now()
);
create index on wallet_entries (tenant_id, client_id);

-- ---------------------------------------------------------------------
-- 9. COFRE (DADO DE SAÚDE) E CONSENTIMENTOS
-- ---------------------------------------------------------------------
create table health_records (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  client_id    uuid not null references clients(id) on delete cascade,
  form_key     text not null,                                -- 'lashes_v1', 'aesthetics_v1'
  ciphertext   bytea not null,
  iv           bytea not null,
  auth_tag     bytea not null,
  key_version  int not null default 1,
  has_alert    boolean not null default false,               -- só o BOOLEANO fica em claro
  alert_label  text,                                         -- ex.: "Alergia" (rótulo curto, sem detalhe clínico)
  filled_by    text not null default 'professional',         -- professional | client
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index on health_records (tenant_id, client_id);

create table vault_access_log (
  id          bigserial primary key,
  tenant_id   uuid not null,
  client_id   uuid not null,
  actor_id    uuid,
  actor_label text,
  action      text not null,                                 -- read | write | export
  ip          inet,
  user_agent  text,
  created_at  timestamptz not null default now()
);
create index on vault_access_log (tenant_id, client_id, created_at desc);

create table consents (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  client_id     uuid not null references clients(id) on delete cascade,
  kind          consent_type not null,
  version       text not null,
  text_hash     text not null,                               -- sha256 do texto exibido
  granted       boolean not null,
  signature_key text,                                        -- caminho no storage da assinatura
  ip            inet,
  user_agent    text,
  granted_at    timestamptz not null default now(),
  revoked_at    timestamptz
);
create index on consents (tenant_id, client_id, kind);

create table media (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references tenants(id) on delete cascade,
  client_id      uuid references clients(id) on delete cascade,
  appointment_id uuid references appointments(id) on delete set null,
  storage_key    text not null,
  kind           text not null default 'photo',              -- photo | signature | document
  phase          text,                                       -- before | after | reference
  consent_id     uuid references consents(id) on delete set null,
  width          int, height int, bytes bigint,
  created_by     uuid references profiles(id),
  created_at     timestamptz not null default now(),
  deleted_at     timestamptz
);
create index on media (tenant_id, client_id, created_at desc);

-- ---------------------------------------------------------------------
-- 10. MENSAGERIA E CAMPANHAS
-- ---------------------------------------------------------------------
create table messages (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references tenants(id) on delete cascade,
  client_id      uuid references clients(id) on delete set null,
  appointment_id uuid references appointments(id) on delete set null,
  channel        message_channel not null,
  kind           message_kind not null,
  template       text,
  body           text,
  status         message_status not null default 'queued',
  provider_id    text,
  cost_cents     bigint not null default 0,
  error          text,
  scheduled_for  timestamptz,
  sent_at        timestamptz,
  created_at     timestamptz not null default now()
);
create index on messages (tenant_id, client_id, created_at desc);
create index on messages (status, scheduled_for) where status = 'queued';
-- evita mandar o mesmo lembrete duas vezes
create unique index messages_dedupe
  on messages (appointment_id, kind, template)
  where appointment_id is not null and kind in ('reminder','confirmation');

create table campaigns (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  name          text not null,
  segment       jsonb not null,                              -- filtro serializado
  template      text not null,
  status        text not null default 'draft',
  sent_count    int not null default 0,
  booked_count  int not null default 0,
  revenue_cents bigint not null default 0,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 11. INFRAESTRUTURA: AUDITORIA, IDEMPOTÊNCIA, FILAS
-- ---------------------------------------------------------------------
create table audit_log (
  id          bigserial primary key,
  tenant_id   uuid,
  actor_id    uuid,
  actor_role  user_role,
  action      text not null,                                 -- client.export, commission.update...
  entity      text,
  entity_id   uuid,
  before      jsonb,
  after       jsonb,
  ip          inet,
  user_agent  text,
  request_id  text,
  created_at  timestamptz not null default now()
);
create index on audit_log (tenant_id, created_at desc);
create index on audit_log (tenant_id, entity, entity_id);

create table idempotency_keys (
  key             text primary key,
  tenant_id       uuid,
  endpoint        text not null,
  request_hash    text not null,
  response_status int,
  response_body   jsonb,
  created_at      timestamptz not null default now()
);
create index on idempotency_keys (created_at);

create table job_queue (
  id          bigserial primary key,
  tenant_id   uuid,
  kind        text not null,
  payload     jsonb not null default '{}'::jsonb,
  status      job_status not null default 'queued',
  attempts    int not null default 0,
  max_attempts int not null default 5,
  run_after   timestamptz not null default now(),
  locked_at   timestamptz,
  last_error  text,
  created_at  timestamptz not null default now()
);
create index on job_queue (status, run_after) where status in ('queued','failed');
create unique index job_queue_dedupe on job_queue (kind, (payload->>'dedupe_key'))
  where status in ('queued','running') and payload ? 'dedupe_key';

create table webhook_events (                                -- garante processamento único
  id           bigserial primary key,
  provider     text not null,
  event_id     text not null,
  payload      jsonb not null,
  processed_at timestamptz,
  created_at   timestamptz not null default now(),
  unique (provider, event_id)
);

-- ---------------------------------------------------------------------
-- 12. FUNÇÕES DE APOIO
-- ---------------------------------------------------------------------

-- pertence ao tenant?
create or replace function public.has_tenant(t uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.memberships m
    where m.tenant_id = t and m.user_id = auth.uid() and m.active
  );
$$;

-- papel do usuário no tenant
create or replace function public.tenant_role(t uuid)
returns user_role language sql stable security definer set search_path = public as $$
  select m.role from public.memberships m
  where m.tenant_id = t and m.user_id = auth.uid() and m.active
  limit 1;
$$;

-- id do profissional vinculado ao usuário logado
create or replace function public.my_professional_id(t uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select p.id from public.professionals p
  where p.tenant_id = t and p.user_id = auth.uid() and p.deleted_at is null
  limit 1;
$$;

-- profissional só vê a própria agenda quando o dono ativou a trava
create or replace function public.can_see_appointment(t uuid, prof uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when public.tenant_role(t) in ('owner','manager','reception','finance') then true
    when coalesce((select (settings->>'restrict_professional_view')::boolean
                   from public.tenants where id = t), false) = false then true
    else prof = public.my_professional_id(t)
  end;
$$;

-- contexto de tenant para workers (usado dentro de withTenant)
create or replace function public.set_tenant_context(t uuid)
returns void language sql volatile as $$
  select set_config('app.tenant_id', t::text, true);
$$;

create or replace function public.clear_tenant_context()
returns void language sql volatile as $$
  select set_config('app.tenant_id', '', true);
$$;

-- atualiza updated_at
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create trigger appointments_touch before update on appointments
  for each row execute function public.touch_updated_at();
create trigger health_records_touch before update on health_records
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- 13. RLS
-- Padrão: leitura e escrita restritas ao tenant do usuário.
-- Tabelas com regra extra estão comentadas.
-- ---------------------------------------------------------------------
do $$
declare
  t text;
  tenant_tables text[] := array[
    'professionals','business_hours','time_off','service_categories','services',
    'professional_services','products','service_products','stock_moves','clients',
    'waitlist','client_cycles','tickets','ticket_items','payments','commissions',
    'packages','package_uses','wallet_entries','health_records','consents','media',
    'messages','campaigns','tenant_keys'
  ];
begin
  foreach t in array tenant_tables loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format($f$
      create policy %1$s_tenant_all on %1$I
        for all
        using (public.has_tenant(tenant_id))
        with check (public.has_tenant(tenant_id))
    $f$, t);
  end loop;
end $$;

-- appointments: política própria (trava de visão por profissional)
alter table appointments enable row level security;
alter table appointments force row level security;

create policy appointments_select on appointments for select
  using (public.has_tenant(tenant_id) and public.can_see_appointment(tenant_id, professional_id));

create policy appointments_insert on appointments for insert
  with check (public.has_tenant(tenant_id));

create policy appointments_update on appointments for update
  using (public.has_tenant(tenant_id) and public.can_see_appointment(tenant_id, professional_id))
  with check (public.has_tenant(tenant_id));

create policy appointments_delete on appointments for delete
  using (public.has_tenant(tenant_id) and public.tenant_role(tenant_id) in ('owner','manager'));

-- tenants: só quem é membro
alter table tenants enable row level security;
alter table tenants force row level security;
create policy tenants_select on tenants for select using (public.has_tenant(id));
create policy tenants_update on tenants for update
  using (public.tenant_role(id) = 'owner') with check (public.tenant_role(id) = 'owner');

-- profiles: cada um vê o próprio, e membros do mesmo tenant se veem
alter table profiles enable row level security;
alter table profiles force row level security;
create policy profiles_self on profiles for all
  using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_same_tenant on profiles for select
  using (exists (
    select 1 from memberships a join memberships b on a.tenant_id = b.tenant_id
    where a.user_id = auth.uid() and a.active and b.user_id = profiles.id and b.active
  ));

-- memberships: leitura pelos membros; escrita só pelo dono
alter table memberships enable row level security;
alter table memberships force row level security;
create policy memberships_select on memberships for select using (public.has_tenant(tenant_id));
create policy memberships_write on memberships for all
  using (public.tenant_role(tenant_id) = 'owner')
  with check (public.tenant_role(tenant_id) = 'owner');

-- auditoria e log do cofre: leitura pelo dono/gerente, escrita só pelo servidor
alter table audit_log enable row level security;
alter table audit_log force row level security;
create policy audit_read on audit_log for select
  using (public.has_tenant(tenant_id) and public.tenant_role(tenant_id) in ('owner','manager','finance'));

alter table vault_access_log enable row level security;
alter table vault_access_log force row level security;
create policy vault_log_read on vault_access_log for select
  using (public.has_tenant(tenant_id) and public.tenant_role(tenant_id) in ('owner','manager'));

-- tabelas de infraestrutura: nenhum acesso via cliente (só service_role)
alter table idempotency_keys enable row level security;
alter table job_queue        enable row level security;
alter table webhook_events   enable row level security;
alter table idempotency_keys force row level security;
alter table job_queue        force row level security;
alter table webhook_events   force row level security;
-- (sem políticas = ninguém lê pelo cliente. Intencional.)

-- ---------------------------------------------------------------------
-- 14. VIEWS DE APOIO
-- ---------------------------------------------------------------------
-- security_invoker = true é OBRIGATÓRIO: sem isso a view roda com os
-- privilégios do dono e FURA o RLS das tabelas de baixo.
create or replace view v_recover_revenue with (security_invoker = true) as
select
  cc.tenant_id,
  cc.client_id,
  c.name        as client_name,
  c.phone_e164,
  cc.service_id,
  s.name        as service_name,
  cc.state,
  cc.late_days,
  cc.predicted_on,
  cc.value_at_risk_cents,
  cc.last_campaign_at
from client_cycles cc
join clients  c on c.id = cc.client_id and c.deleted_at is null
join services s on s.id = cc.service_id
where cc.state in ('due','late','at_risk','lost')
order by cc.value_at_risk_cents desc;

create or replace view v_daily_cash with (security_invoker = true) as
select
  t.tenant_id,
  date_trunc('day', t.closed_at) as day,
  count(*)                       as tickets,
  sum(t.total_cents)             as revenue_cents,
  sum(t.material_cost_cents)     as material_cents,
  sum(t.fee_cents)               as fee_cents,
  sum(t.commission_cents)        as commission_cents,
  sum(t.profit_cents)            as profit_cents
from tickets t
where t.status in ('closed','paid')
group by 1,2;

-- =====================================================================
-- FIM
-- =====================================================================
