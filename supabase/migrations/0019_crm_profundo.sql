-- CRM profundo: perfil de verdade, notas com data, fidelidade e clube de assinatura.
-- Referências do nicho que sustentam cada bloco estão em `docs/DECISOES.md`.

-- ─────────────────────────────── perfil do cliente
-- O que todo software de salão pergunta e o CICLO não tinha onde guardar. Tudo opcional: um
-- salão que só quer nome e telefone continua funcionando sem ver nada disso preenchido.
alter table clients add column if not exists document text;                 -- CPF, para nota fiscal
alter table clients add column if not exists gender text;                   -- texto livre, não enum: lista fechada exclui gente
alter table clients add column if not exists address text;
alter table clients add column if not exists emergency_contact text;        -- procedimento longo/química pede isso
-- "Sempre corta com o Diego" é a pergunta nº 1 na recepção de barbearia.
alter table clients add column if not exists preferred_professional_id uuid references professionals(id) on delete set null;
-- Cliente que sumiu 3 vezes sem avisar continua podendo marcar sozinho pelo site; isto é a trava.
alter table clients add column if not exists online_booking_blocked boolean not null default false;

create index if not exists clients_preferred_professional_idx on clients (preferred_professional_id);

-- ─────────────────────────────── notas com data
-- `clients.notes` é UM campo que se sobrescreve: anotar "gostou do degradê baixo" apaga o que
-- estava lá antes. Vira histórico — cada atendimento pode deixar a sua, com autor e data.
-- Nada de update/delete no fluxo normal (regra 11): anotação é registro, não rascunho.
create table if not exists client_notes (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references tenants(id) on delete cascade,
  client_id      uuid not null references clients(id) on delete cascade,
  appointment_id uuid references appointments(id) on delete set null,
  body           text not null,
  author_id      uuid references profiles(id) on delete set null,
  created_at     timestamptz not null default now()
);

alter table client_notes enable row level security;
alter table client_notes force row level security;
create policy client_notes_tenant_all on client_notes for all
  using (has_tenant(tenant_id)) with check (has_tenant(tenant_id));
create index if not exists client_notes_cliente_idx on client_notes (tenant_id, client_id, created_at desc);

-- ─────────────────────────────── fidelidade por pontos
-- Razão (`reason`) fica junto do lançamento porque o extrato precisa se explicar sozinho para o
-- cliente que pergunta "por que eu tenho 40 pontos?". Livro-razão: só entra linha, nunca some.
create table if not exists loyalty_entries (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references tenants(id) on delete cascade,
  client_id      uuid not null references clients(id) on delete cascade,
  appointment_id uuid references appointments(id) on delete set null,
  points         integer not null,
  reason         text not null,
  created_by     uuid references profiles(id) on delete set null,
  created_at     timestamptz not null default now()
);

alter table loyalty_entries enable row level security;
alter table loyalty_entries force row level security;
create policy loyalty_entries_tenant_all on loyalty_entries for all
  using (has_tenant(tenant_id)) with check (has_tenant(tenant_id));
create index if not exists loyalty_entries_cliente_idx on loyalty_entries (tenant_id, client_id, created_at desc);

-- ─────────────────────────────── clube de assinatura
-- O padrão do mercado brasileiro de barbearia: mensalidade que dá direito a N serviços por mês.
-- O plano é do negócio; a assinatura é do cliente.
create table if not exists subscription_plans (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references tenants(id) on delete cascade,
  name           text not null,
  price_cents    bigint not null check (price_cents >= 0),
  -- Quantos atendimentos o plano cobre por mês. `null` = ilimitado (barbearia usa muito isso).
  sessions_per_month integer check (sessions_per_month is null or sessions_per_month > 0),
  benefits       text,
  active         boolean not null default true,
  created_at     timestamptz not null default now()
);

alter table subscription_plans enable row level security;
alter table subscription_plans force row level security;
create policy subscription_plans_tenant_all on subscription_plans for all
  using (has_tenant(tenant_id)) with check (has_tenant(tenant_id));

create table if not exists client_subscriptions (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  client_id    uuid not null references clients(id) on delete cascade,
  plan_id      uuid not null references subscription_plans(id) on delete restrict,
  -- Dia do mês em que cobra. 1..28 para nunca cair em mês que não tem dia 29/30/31.
  billing_day  integer not null check (billing_day between 1 and 28),
  status       text not null default 'active' check (status in ('active', 'canceled')),
  started_on   date not null default current_date,
  canceled_on  date,
  created_at   timestamptz not null default now()
);

alter table client_subscriptions enable row level security;
alter table client_subscriptions force row level security;
create policy client_subscriptions_tenant_all on client_subscriptions for all
  using (has_tenant(tenant_id)) with check (has_tenant(tenant_id));
-- Um cliente não pode ter duas assinaturas ativas ao mesmo tempo.
create unique index if not exists client_subscriptions_uma_ativa
  on client_subscriptions (tenant_id, client_id) where status = 'active';
