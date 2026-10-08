-- =====================================================================
-- CICLO · pacote Advocacia: a reunião do caso (migration 0108)
--
-- docs/101 anexo 01 §2.7 e D3. Reunião do caso = um agendamento da agenda de sempre + este vínculo.
-- Tabela de vínculo, e não coluna em `appointments`: não toca o núcleo e não cria segunda FK para a
-- mesma tabela (que quebra o embed do PostgREST, memória do projeto).
--
-- Arquivo próprio, e as duas chaves com `no action`, nunca `cascade`: `appointments` é histórico
-- (inviolável nº 11 do `CLAUDE.md`, 0079), e caso também não se apaga pela API (0105, sem política de
-- DELETE). O offboarding do tenant leva as três tabelas no mesmo comando pelo `cascade` de `tenants`,
-- e `no action` só confere no fim do comando. A guarda `nunca-delete-o-que-e-historico` lê este
-- arquivo inteiro: ele só pode ter o `cascade` do tenant.
-- =====================================================================

create table public.legal_case_meetings (
  case_id         uuid not null,
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  appointment_id  uuid not null references public.appointments(id) on delete no action,
  created_at      timestamptz not null default now(),
  primary key (case_id, appointment_id),
  foreign key (case_id, tenant_id) references public.legal_cases (id, tenant_id) on delete no action
);
create index legal_case_meetings_appointment_idx on public.legal_case_meetings (appointment_id);
create index legal_case_meetings_case_fk_idx on public.legal_case_meetings (case_id, tenant_id);
create index legal_case_meetings_tenant_idx on public.legal_case_meetings (tenant_id);

alter table public.legal_case_meetings enable row level security;
alter table public.legal_case_meetings force row level security;

create policy legal_case_meetings_select on public.legal_case_meetings for select
  using (public.legal_can_access_case(case_id));
create policy legal_case_meetings_insert on public.legal_case_meetings for insert
  with check (public.legal_can_access_case(case_id));
