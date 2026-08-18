-- TICKET-056. Registro local do que já estava aplicado no projeto remoto (migration
-- `20260818230107_push_subscriptions`, criada por outra sessão em paralelo antes deste
-- arquivo existir — só a tabela, sem código nenhum em cima). Recriado aqui palavra por
-- palavra a partir do banco (`information_schema`) para o histórico do git bater com a
-- realidade; a 0016 corrige o que veio frouxo demais (política e unicidade).
create table push_subscriptions (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  user_id      uuid not null references profiles(id) on delete cascade,
  endpoint     text not null unique,
  p256dh       text not null,
  auth         text not null,
  created_at   timestamptz not null default now()
);

alter table push_subscriptions enable row level security;
alter table push_subscriptions force row level security;

create policy push_subscriptions_tenant_all on push_subscriptions for all
  using (has_tenant(tenant_id))
  with check (has_tenant(tenant_id));
