-- CICLO · leituras de km do veículo (docs/106-automotivo AUT-103, docs/105-ciclo/C-039)
--
-- A leitura do hodômetro no check-in é o que alimenta o relógio de uso (core/cycle/relogios.ts): sem ela,
-- a oficina só sabe "12 meses", e o carro de aplicativo vence a troca de óleo em 2 meses. A avaliação da
-- leitura é pura (core/manutencao/leitura-de-km.ts, C-029): km que DESCE ou que dá salto absurdo é ACEITO
-- com aviso (bloquear faz a oficina largar o sistema), e o aviso fica gravado em `flag` para quem ler o
-- histórico do carro saber que aquele número foi conferido.
--
-- Histórico: sem UPDATE e sem DELETE (regra 11). Leitura errada se corrige com uma leitura nova.
-- Aditiva: nenhum código lê ainda; a rota de gravar vem no mesmo ticket.
--
-- Revisão adversarial:
-- - Chaves COMPOSTAS (tenant_id, subject_id) e (tenant_id, appointment_id): a leitura só aponta para
--   veículo e visita do MESMO tenant (FK não passa pela RLS).
-- - `appointments (tenant_id, id)` único: `id` já é único, então o índice não muda dado (como o de
--   clients na 0132).
-- - LGPD: km não identifica ninguém; o veículo é anonimizado na eliminação (0132), a leitura fica sem dono.
-- - Sem `on delete cascade` a partir do veículo: sujeito não se apaga (sem DELETE), e se um dia apagar,
--   o histórico tem de impedir, não sumir junto.

create unique index if not exists appointments_tenant_id_id_key on appointments (tenant_id, id);

create table odometer_readings (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references tenants(id) on delete cascade,
  subject_id     uuid not null,
  appointment_id uuid,
  read_on        date not null,
  km             integer not null check (km between 0 and 3000000),
  -- O aviso do C-029 que a pessoa viu e confirmou: 'desce' (trocou o painel?) ou 'salto' (sobrou um zero?).
  flag           text check (flag is null or flag in ('desce', 'salto')),
  created_by     uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now(),
  foreign key (tenant_id, subject_id) references subjects (tenant_id, id),
  foreign key (tenant_id, appointment_id) references appointments (tenant_id, id)
);

create index odometer_readings_subject_idx on odometer_readings (tenant_id, subject_id, read_on);
create index odometer_readings_appointment_idx on odometer_readings (tenant_id, appointment_id);
create index odometer_readings_created_by_idx on odometer_readings (created_by);

alter table odometer_readings enable row level security;
alter table odometer_readings force row level security;

create policy odometer_readings_select on odometer_readings for select using (public.has_tenant(tenant_id));
create policy odometer_readings_insert on odometer_readings for insert with check (public.has_tenant(tenant_id));

revoke update, delete on public.odometer_readings from authenticated, anon;

comment on table odometer_readings is
  'AUT-103: leitura do hodômetro por veículo (subjects kind=veiculo). Histórico: sem UPDATE/DELETE; correção = leitura nova. flag = aviso do C-029 confirmado.';
