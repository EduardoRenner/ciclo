-- P7 (docs/09-PLATAFORMA.md §12, fecha G4): `appointments.recurrence_id` existe desde a
-- migration inicial mas nunca teve tabela-mãe nem gerador (achado, grep confirmou zero uso).
-- Esta migration cria a série de recorrência e liga a FK que faltava.

create table appointment_series (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null references tenants(id) on delete cascade,
  client_id             uuid not null references clients(id) on delete restrict,
  professional_id       uuid not null references professionals(id) on delete restrict,
  service_id            uuid not null references services(id) on delete restrict,
  -- Os 3 padrões do §12 ("toda terça 14h"; "a cada 15 dias"; "primeira segunda do mês").
  -- Regra em colunas (não jsonb) pra poder validar coerência com CHECK e indexar se precisar.
  tipo                  text not null check (tipo in ('semanal', 'a_cada_dias', 'mensal_dia_semana')),
  weekday               smallint check (weekday between 0 and 6), -- 0=domingo, mesma convenção de business_hours.weekday
  intervalo_semanas     smallint check (intervalo_semanas > 0),   -- 1 = toda semana, 2 = quinzenal
  intervalo_dias        smallint check (intervalo_dias > 0),
  ordinal_no_mes        smallint check (ordinal_no_mes between 1 and 5), -- 5 = última ocorrência do mês, existente ou não
  horario               time not null,
  starts_on             date not null,
  ends_on               date,
  max_ocorrencias       smallint check (max_ocorrencias > 0),
  ocorrencias_geradas   smallint not null default 0,
  status                text not null default 'active' check (status in ('active', 'canceled')),
  note                  text,
  address               text,
  created_by            uuid references profiles(id),
  created_at            timestamptz not null default now(),
  canceled_at           timestamptz,
  check (ends_on is null or ends_on >= starts_on),
  check (
    (tipo = 'semanal' and weekday is not null and intervalo_semanas is not null and intervalo_dias is null and ordinal_no_mes is null)
    or (tipo = 'a_cada_dias' and intervalo_dias is not null and weekday is null and intervalo_semanas is null and ordinal_no_mes is null)
    or (tipo = 'mensal_dia_semana' and weekday is not null and ordinal_no_mes is not null and intervalo_dias is null and intervalo_semanas is null)
  )
);

create index appointment_series_tenant_idx on appointment_series(tenant_id);
create index appointment_series_professional_idx on appointment_series(professional_id);
create index appointment_series_client_idx on appointment_series(client_id);
-- Consultada a cada geração de ocorrências pra saber quais séries ainda estão ativas.
create index appointment_series_active_idx on appointment_series(tenant_id) where status = 'active';

alter table appointment_series enable row level security;
alter table appointment_series force row level security;

-- Mesmo padrão de appointments (0001): quem vê a série é quem veria os agendamentos dela.
create policy appointment_series_select on appointment_series for select
  using (public.has_tenant(tenant_id) and public.can_see_appointment(tenant_id, professional_id));

create policy appointment_series_insert on appointment_series for insert
  with check (public.has_tenant(tenant_id));

create policy appointment_series_update on appointment_series for update
  using (public.has_tenant(tenant_id) and public.can_see_appointment(tenant_id, professional_id))
  with check (public.has_tenant(tenant_id));

create policy appointment_series_delete on appointment_series for delete
  using (public.has_tenant(tenant_id) and public.tenant_role(tenant_id) in ('owner', 'manager'));

-- A coluna já existia (0001) sem FK — nenhum agendamento tem valor hoje (grep confirmou
-- nada no código produz esse valor ainda), então a FK entra sem backfill.
alter table appointments
  add constraint appointments_recurrence_id_fkey foreign key (recurrence_id) references appointment_series(id) on delete set null;

create index appointments_recurrence_id_idx on appointments(recurrence_id) where recurrence_id is not null;
