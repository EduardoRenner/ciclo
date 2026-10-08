-- =====================================================================
-- CICLO · pacote Advocacia: intimações do DJEN, prazos blindados e feriados (migration 0109)
--
-- docs/101 anexo 01 §2.12-§2.17, anexo 02 A5/A22 (T1.5 e T1.6). Origem: LUBI 0020, 0026, 0028, 0029,
-- reescritos para multi-tenant. A regra que mais pesa em todo o produto mora aqui e em
-- `core/advocacia/prazo-*.ts`: **nenhuma data de prazo é dada como certa sem confirmação humana**,
-- e prazo fatal não se adia, não se apaga e não muda sem motivo.
--
-- Quem escreve:
--   - intimações: só o servidor (job de captura, `service_role`), pela RPC `legal_intimacoes_gravar`;
--     a triagem (vincular, "não gera prazo", descartar) pela RPC `legal_intimacao_decidir`;
--   - sugestão de prazo: só o servidor (`legal_intimation_suggestions`); a decisão LÊ dali, nunca
--     aceita a data do chamador como "sugerida" (achado 1 da revisão do T11.3 do LUBI);
--   - prazos: a pessoa, pela rota (RLS do usuário) ou pela decisão da intimação.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) OAB e papel jurídico da equipe (nulos fora do pacote)
-- ---------------------------------------------------------------------
alter table public.professionals
  add column oab_number text check (oab_number is null or oab_number ~ '^[0-9]{1,7}$'),
  add column oab_uf text check (oab_uf is null or oab_uf ~ '^[A-Z]{2}$'),
  -- estagiário não vira papel de banco (enum user_role): é atributo, docs/101 §3.4
  add column legal_role text check (legal_role is null or legal_role in ('advogado', 'estagio'));

-- ---------------------------------------------------------------------
-- 2) Feriados: plataforma (tenant nulo) + escritório (tribunal/comarca), com fonte
-- ---------------------------------------------------------------------
create table public.legal_holidays (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid references public.tenants(id) on delete cascade,
  day            date not null,
  scope          text not null check (scope in ('nacional', 'estadual', 'municipal', 'forense', 'recesso')),
  name           text not null check (char_length(btrim(name)) between 2 and 120),
  tribunal       text check (tribunal is null or char_length(btrim(tribunal)) between 2 and 20),
  comarca        text check (comarca is null or char_length(btrim(comarca)) between 2 and 80),
  fonte_url      text check (fonte_url is null or fonte_url ~ '^https://'),
  conferido_por  uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now()
);
create unique index legal_holidays_uidx on public.legal_holidays (
  coalesce(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid), day, coalesce(tribunal, ''), coalesce(comarca, ''));
create index legal_holidays_tenant_idx on public.legal_holidays (tenant_id);
create index legal_holidays_conferido_por_idx on public.legal_holidays (conferido_por);

-- feriados nacionais por lei (fixos + Sexta-feira Santa) e a suspensão de fim de ano (CPC art. 220)
insert into public.legal_holidays (tenant_id, day, scope, name)
select null, d::date, 'nacional', n from (values
  ('2026-01-01', 'Confraternização Universal'), ('2026-04-03', 'Sexta-feira Santa'), ('2026-04-21', 'Tiradentes'),
  ('2026-05-01', 'Dia do Trabalho'), ('2026-09-07', 'Independência do Brasil'), ('2026-10-12', 'Nossa Senhora Aparecida'),
  ('2026-11-02', 'Finados'), ('2026-11-15', 'Proclamação da República'), ('2026-11-20', 'Zumbi e Consciência Negra'),
  ('2026-12-25', 'Natal'), ('2027-01-01', 'Confraternização Universal'), ('2027-03-26', 'Sexta-feira Santa'),
  ('2027-04-21', 'Tiradentes'), ('2027-05-01', 'Dia do Trabalho'), ('2027-09-07', 'Independência do Brasil'),
  ('2027-10-12', 'Nossa Senhora Aparecida'), ('2027-11-02', 'Finados'), ('2027-11-15', 'Proclamação da República'),
  ('2027-11-20', 'Zumbi e Consciência Negra'), ('2027-12-25', 'Natal')) as f(d, n);
insert into public.legal_holidays (tenant_id, day, scope, name)
select null, d::date, 'recesso', 'Suspensão de fim de ano (CPC, art. 220)'
  from generate_series(date '2025-12-20', date '2026-01-20', interval '1 day') d
 where not exists (select 1 from public.legal_holidays h where h.tenant_id is null and h.day = d::date);
insert into public.legal_holidays (tenant_id, day, scope, name)
select null, d::date, 'recesso', 'Suspensão de fim de ano (CPC, art. 220)'
  from generate_series(date '2026-12-20', date '2027-01-20', interval '1 day') d
 where not exists (select 1 from public.legal_holidays h where h.tenant_id is null and h.day = d::date);

-- ---------------------------------------------------------------------
-- 3) Intimações capturadas e a prova de reconciliação
-- ---------------------------------------------------------------------
create table public.legal_intimations (
  id                     uuid primary key default gen_random_uuid(),
  tenant_id              uuid not null references public.tenants(id) on delete cascade,
  djen_id                bigint not null,
  hash                   text check (hash is null or char_length(hash) <= 200),
  numero_processo        text not null check (numero_processo ~ '^[0-9]{20}$'),
  data_disponibilizacao  date not null check (data_disponibilizacao between date '2000-01-01' and date '2100-01-01'),
  tribunal               text not null check (char_length(btrim(tribunal)) between 2 and 20),
  orgao                  text check (orgao is null or char_length(orgao) <= 300),
  tipo                   text check (tipo is null or char_length(tipo) <= 120),
  classe                 text check (classe is null or char_length(classe) <= 200),
  texto_sanitizado       text not null check (char_length(texto_sanitizado) <= 200000),
  link                   text check (link is null or link ~ '^https://'),
  destinatarios          jsonb not null default '[]'::jsonb check (jsonb_typeof(destinatarios) = 'array'),
  alvo                   text not null check (char_length(btrim(alvo)) between 3 and 160),
  case_id                uuid,
  status                 text not null default 'nova' check (status in ('nova', 'vinculada', 'prazo_criado', 'sem_prazo', 'descartada')),
  triaged_by             uuid references auth.users(id) on delete set null,
  triaged_at             timestamptz,
  reason                 text check (reason is null or char_length(reason) <= 500),
  cancelled_at           timestamptz,
  cancel_reason          text check (cancel_reason is null or char_length(cancel_reason) <= 300),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  unique (tenant_id, djen_id),
  unique (id, tenant_id),
  foreign key (case_id, tenant_id) references public.legal_cases (id, tenant_id) on delete no action,
  constraint legal_intimations_estado_coerente check (
    (status <> 'nova' or case_id is null)
    and (status not in ('vinculada', 'prazo_criado') or case_id is not null)
    and (status not in ('prazo_criado', 'sem_prazo', 'descartada') or (triaged_by is not null and triaged_at is not null))
    and (status not in ('sem_prazo', 'descartada') or char_length(btrim(coalesce(reason, ''))) >= 5))
);
create index legal_intimations_novas_idx on public.legal_intimations (tenant_id, data_disponibilizacao desc) where status = 'nova';
create index legal_intimations_case_idx on public.legal_intimations (case_id, tenant_id) where case_id is not null;
create index legal_intimations_numero_idx on public.legal_intimations (tenant_id, numero_processo);
create index legal_intimations_triaged_by_idx on public.legal_intimations (triaged_by);

create table public.legal_intimation_sync (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants(id) on delete cascade,
  alvo           text not null check (char_length(btrim(alvo)) between 3 and 160),
  dia            date not null,
  count_fonte    int not null check (count_fonte >= 0),
  count_gravado  int not null check (count_gravado >= 0),
  ok             boolean not null,
  detalhe        text check (detalhe is null or char_length(detalhe) <= 300),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (tenant_id, alvo, dia)
);
create index legal_intimation_sync_dia_idx on public.legal_intimation_sync (tenant_id, dia desc);

-- o conteúdo do tribunal nunca muda; só o estado da triagem, o vínculo e o cancelamento
create or replace function public.legal_intimacao_so_estado()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.djen_id is distinct from old.djen_id or new.numero_processo is distinct from old.numero_processo
     or new.data_disponibilizacao is distinct from old.data_disponibilizacao or new.tribunal is distinct from old.tribunal
     or new.texto_sanitizado is distinct from old.texto_sanitizado or new.destinatarios is distinct from old.destinatarios
     or new.alvo is distinct from old.alvo or new.tenant_id is distinct from old.tenant_id then
    raise exception 'O que o tribunal publicou não se altera.' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger legal_intimations_so_estado before update on public.legal_intimations
  for each row execute function public.legal_intimacao_so_estado();
create trigger legal_intimations_touch before update on public.legal_intimations for each row execute function public.touch_updated_at();
create trigger legal_intimation_sync_touch before update on public.legal_intimation_sync for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- 4) Prazos (blindados), histórico e prova de alerta
-- ---------------------------------------------------------------------
create table public.legal_deadlines (
  id                           uuid primary key default gen_random_uuid(),
  tenant_id                    uuid not null references public.tenants(id) on delete cascade,
  client_id                    uuid not null,
  case_id                      uuid,
  kind                         text not null check (kind in ('fatal', 'interno', 'audiencia', 'contratual')),
  title                        text not null check (char_length(btrim(title)) between 2 and 200),
  due_on                       date not null check (due_on between date '2000-01-01' and date '2100-01-01'),
  due_at                       timestamptz,
  internal_due_on              date,
  source                       text not null default 'manual' check (source in ('manual', 'djen', 'modelo')),
  intimation_id                uuid,
  source_note                  text check (source_note is null or char_length(source_note) <= 500),
  calc_memo                    jsonb check (calc_memo is null or (jsonb_typeof(calc_memo) = 'object' and pg_column_size(calc_memo) < 8000)),
  calc_rule_version            text check (calc_rule_version is null or char_length(btrim(calc_rule_version)) between 3 and 40),
  suggested_due_on             date,
  calc_divergence              boolean,
  responsible_professional_id  uuid references public.professionals(id) on delete set null,
  alert_days                   int[] not null default '{7,3,1,0}' check (alert_days @> '{1,0}' and cardinality(alert_days) <= 10),
  confirmed_by                 uuid references auth.users(id) on delete set null,
  confirmed_at                 timestamptz,
  status                       text not null default 'aberto' check (status in ('aberto', 'cumprido', 'perdido', 'cancelado')),
  close_note                   text check (close_note is null or char_length(close_note) <= 1000),
  close_document_id            uuid,
  close_reason                 text check (close_reason is null or char_length(close_reason) <= 500),
  closed_at                    timestamptz,
  closed_by                    uuid references auth.users(id) on delete set null,
  -- transitória: o motivo de UMA alteração viaja aqui e o gatilho o move para o histórico
  change_reason                text check (change_reason is null or char_length(change_reason) <= 500),
  created_by                   uuid references auth.users(id) on delete set null,
  created_at                   timestamptz not null default now(),
  updated_at                   timestamptz not null default now(),
  unique (id, tenant_id),
  foreign key (client_id, tenant_id) references public.clients (id, tenant_id) on delete no action,
  foreign key (case_id, tenant_id) references public.legal_cases (id, tenant_id) on delete no action,
  foreign key (intimation_id, tenant_id) references public.legal_intimations (id, tenant_id) on delete no action,
  foreign key (close_document_id, tenant_id) references public.legal_documents (id, tenant_id) on delete no action,
  constraint legal_deadlines_hora_so_audiencia check (due_at is null or kind = 'audiencia'),
  constraint legal_deadlines_interno_antes check (internal_due_on is null or internal_due_on <= due_on),
  constraint legal_deadlines_baixa_coerente check ((status = 'aberto') = (closed_at is null)),
  constraint legal_deadlines_motivo_da_baixa check (status not in ('perdido', 'cancelado') or char_length(btrim(coalesce(close_reason, ''))) >= 5),
  constraint legal_deadlines_fatal_cumprido_com_prova check (
    not (kind = 'fatal' and status = 'cumprido') or close_document_id is not null or char_length(btrim(coalesce(close_note, ''))) >= 5),
  constraint legal_deadlines_confirmacao_coerente check ((confirmed_by is null) = (confirmed_at is null)),
  constraint legal_deadlines_calculo_coerente check (
    (suggested_due_on is null) = (calc_divergence is null)
    and (suggested_due_on is null or (calc_memo is not null and calc_rule_version is not null))
    and ((source = 'djen') = (intimation_id is not null)))
);
create unique index legal_deadlines_intimation_uidx on public.legal_deadlines (intimation_id) where intimation_id is not null;
create index legal_deadlines_abertos_idx on public.legal_deadlines (tenant_id, coalesce(internal_due_on, due_on)) where status = 'aberto';
create index legal_deadlines_client_idx on public.legal_deadlines (client_id, tenant_id);
create index legal_deadlines_case_idx on public.legal_deadlines (case_id, tenant_id) where case_id is not null;
create index legal_deadlines_intimation_fk_idx on public.legal_deadlines (intimation_id, tenant_id) where intimation_id is not null;
create index legal_deadlines_close_document_idx on public.legal_deadlines (close_document_id, tenant_id) where close_document_id is not null;
create index legal_deadlines_responsible_idx on public.legal_deadlines (responsible_professional_id);
create index legal_deadlines_confirmed_by_idx on public.legal_deadlines (confirmed_by);
create index legal_deadlines_closed_by_idx on public.legal_deadlines (closed_by);
create index legal_deadlines_created_by_idx on public.legal_deadlines (created_by);

create table public.legal_deadline_changes (
  id           bigint generated always as identity primary key,
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  deadline_id  uuid not null,
  field        text not null check (field in ('due_on', 'due_at', 'kind', 'responsible_professional_id', 'alert_days', 'status')),
  old_value    text,
  new_value    text,
  reason       text check (reason is null or char_length(reason) <= 500),
  changed_by   uuid,
  changed_at   timestamptz not null default now(),
  foreign key (deadline_id, tenant_id) references public.legal_deadlines (id, tenant_id) on delete no action
);
create index legal_deadline_changes_deadline_idx on public.legal_deadline_changes (deadline_id, tenant_id);
create index legal_deadline_changes_tenant_idx on public.legal_deadline_changes (tenant_id);

create table public.legal_deadline_alerts (
  id                 bigint generated always as identity primary key,
  tenant_id          uuid not null references public.tenants(id) on delete cascade,
  deadline_id        uuid not null,
  marco              int not null check (marco between 0 and 60),
  emitted_at         timestamptz not null default now(),
  notified_user_id   uuid,
  unique (deadline_id, marco),
  foreign key (deadline_id, tenant_id) references public.legal_deadlines (id, tenant_id) on delete no action
);
create index legal_deadline_alerts_fk_idx on public.legal_deadline_alerts (deadline_id, tenant_id);
create index legal_deadline_alerts_tenant_idx on public.legal_deadline_alerts (tenant_id);

-- Sugestão do servidor para a decisão ler (vale 15 minutos). Só `service_role`.
create table public.legal_intimation_suggestions (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references public.tenants(id) on delete cascade,
  intimation_id      uuid not null,
  suggested_due_on   date,
  internal_due_on    date,
  calc_memo          jsonb,
  calc_rule_version  text,
  sem_sugestao       text check (sem_sugestao is null or char_length(sem_sugestao) <= 300),
  created_at         timestamptz not null default now(),
  foreign key (intimation_id, tenant_id) references public.legal_intimations (id, tenant_id) on delete no action,
  check ((suggested_due_on is null) <> (sem_sugestao is null))
);
create index legal_intimation_suggestions_fk_idx on public.legal_intimation_suggestions (intimation_id, tenant_id, created_at desc);
create index legal_intimation_suggestions_tenant_idx on public.legal_intimation_suggestions (tenant_id);

create trigger legal_deadlines_touch before update on public.legal_deadlines for each row execute function public.touch_updated_at();
create trigger legal_deadline_changes_imutavel before update on public.legal_deadline_changes for each row execute function public.legal_negar_alteracao();
create trigger legal_deadline_alerts_imutavel before update on public.legal_deadline_alerts for each row execute function public.legal_negar_alteracao();

-- ---------------------------------------------------------------------
-- 5) A blindagem do prazo
-- ---------------------------------------------------------------------
create or replace function public.legal_prazo_ao_criar()
returns trigger language plpgsql set search_path = public as $$
declare
  v_estagio boolean;
begin
  -- prazo nascido em caso judicial (com número CNJ) é fatal por padrão
  if new.kind = 'interno' and new.case_id is not null
     and exists (select 1 from public.legal_cases c where c.id = new.case_id and c.cnj_number is not null)
     and new.source = 'djen' then
    new.kind := 'fatal';
  end if;
  -- fatal criado por quem é de estágio nasce sem confirmação (a direção ou a advocacia confirma)
  if current_user = 'authenticated' and new.kind = 'fatal' then
    select coalesce(p.legal_role = 'estagio', false) into v_estagio
      from public.professionals p where p.tenant_id = new.tenant_id and p.user_id = auth.uid() limit 1;
    if coalesce(v_estagio, false) then
      new.confirmed_by := null;
      new.confirmed_at := null;
    end if;
  end if;
  new.change_reason := null;
  return new;
end $$;
create trigger legal_deadlines_ao_criar before insert on public.legal_deadlines
  for each row execute function public.legal_prazo_ao_criar();

-- O histórico do prazo não tem política de escrita para o usuário (ninguém forja histórico pela API).
-- Quem grava é esta função, `security definer`, e ela só aceita ser chamada de dentro de um gatilho:
-- `pg_trigger_depth() = 0` é chamada direta (RPC), e é recusada.
create or replace function public.legal_registrar_mudanca_de_prazo(
  p_tenant uuid, p_deadline uuid, p_campo text, p_antes text, p_depois text, p_motivo text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if pg_trigger_depth() = 0 then
    raise exception 'O histórico do prazo só é gravado pelo próprio prazo.' using errcode = '42501';
  end if;
  insert into public.legal_deadline_changes (tenant_id, deadline_id, field, old_value, new_value, reason, changed_by)
  values (p_tenant, p_deadline, p_campo, p_antes, p_depois, p_motivo, auth.uid());
end $$;
revoke all on function public.legal_registrar_mudanca_de_prazo(uuid, uuid, text, text, text, text) from public, anon;
grant execute on function public.legal_registrar_mudanca_de_prazo(uuid, uuid, text, text, text, text) to authenticated;

create or replace function public.legal_prazo_ao_alterar()
returns trigger language plpgsql set search_path = public as $$
declare
  v_motivo text := nullif(btrim(coalesce(new.change_reason, '')), '');
  v_campo text;
begin
  -- o que foi decidido na triagem não se reescreve: correção posterior vai para o histórico
  if (new.suggested_due_on, new.calc_memo, new.calc_rule_version, new.calc_divergence, new.intimation_id, new.source)
     is distinct from (old.suggested_due_on, old.calc_memo, old.calc_rule_version, old.calc_divergence, old.intimation_id, old.source) then
    raise exception 'A prova do cálculo do prazo não se altera.' using errcode = 'P0001';
  end if;
  if old.status <> 'aberto' and new.status = old.status and (new.due_on, new.kind) is distinct from (old.due_on, old.kind) then
    raise exception 'Prazo encerrado não muda de data nem de tipo.' using errcode = 'P0001';
  end if;
  if old.kind in ('fatal', 'audiencia') then
    if new.due_on > old.due_on and new.status = 'aberto' then
      raise exception 'Prazo fatal não pode ser adiado. Para corrigir a data, informe o motivo.' using errcode = 'P0001';
    end if;
    if (new.due_on, new.kind, new.responsible_professional_id) is distinct from (old.due_on, old.kind, old.responsible_professional_id)
       and (v_motivo is null or char_length(v_motivo) < 5) then
      raise exception 'Mudar prazo fatal exige motivo.' using errcode = '23514';
    end if;
    if new.kind not in ('fatal', 'audiencia') and current_user = 'authenticated'
       and coalesce(public.tenant_role(new.tenant_id)::text, '') not in ('owner', 'manager', 'professional') then
      raise exception 'Só a advocacia rebaixa um prazo fatal.' using errcode = '42501';
    end if;
  end if;
  foreach v_campo in array array['due_on', 'due_at', 'kind', 'responsible_professional_id', 'alert_days', 'status'] loop
    if (to_jsonb(new) -> v_campo) is distinct from (to_jsonb(old) -> v_campo) then
      perform public.legal_registrar_mudanca_de_prazo(new.tenant_id, new.id, v_campo, to_jsonb(old) ->> v_campo, to_jsonb(new) ->> v_campo, v_motivo);
    end if;
  end loop;
  new.change_reason := null;
  return new;
end $$;
create trigger legal_deadlines_ao_alterar before update on public.legal_deadlines
  for each row execute function public.legal_prazo_ao_alterar();

-- ---------------------------------------------------------------------
-- 6) RLS
-- ---------------------------------------------------------------------
alter table public.legal_holidays enable row level security;
alter table public.legal_holidays force row level security;
alter table public.legal_intimations enable row level security;
alter table public.legal_intimations force row level security;
alter table public.legal_intimation_sync enable row level security;
alter table public.legal_intimation_sync force row level security;
alter table public.legal_intimation_suggestions enable row level security;
alter table public.legal_intimation_suggestions force row level security;
alter table public.legal_deadlines enable row level security;
alter table public.legal_deadlines force row level security;
alter table public.legal_deadline_changes enable row level security;
alter table public.legal_deadline_changes force row level security;
alter table public.legal_deadline_alerts enable row level security;
alter table public.legal_deadline_alerts force row level security;

create policy legal_holidays_select on public.legal_holidays for select
  using ((tenant_id is null and auth.role() = 'authenticated') or public.has_tenant(tenant_id));
create policy legal_holidays_insert on public.legal_holidays for insert
  with check (tenant_id is not null and public.has_tenant(tenant_id) and public.tenant_role(tenant_id) in ('owner', 'manager'));
create policy legal_holidays_update on public.legal_holidays for update
  using (tenant_id is not null and public.has_tenant(tenant_id) and public.tenant_role(tenant_id) in ('owner', 'manager'))
  with check (tenant_id is not null and public.has_tenant(tenant_id) and public.tenant_role(tenant_id) in ('owner', 'manager'));

-- intimação sem caso: direção e advocacia; com caso: quem enxerga o caso (docs/101 §3.4, decisão pendente)
create policy legal_intimations_select on public.legal_intimations for select
  using (case when case_id is null
              then public.has_tenant(tenant_id) and public.tenant_role(tenant_id) in ('owner', 'manager', 'professional')
              else public.legal_can_access_case(case_id) end);
-- sem insert/update pela API: só as RPCs do servidor e da decisão

-- o texto do tribunal e os destinatários (nomes de partes) fora do SELECT direto: só pela RPC que registra trilha
revoke select on public.legal_intimations from anon, authenticated;
grant select (id, tenant_id, djen_id, numero_processo, data_disponibilizacao, tribunal, orgao, tipo, classe, link, alvo,
              case_id, status, triaged_by, triaged_at, reason, cancelled_at, cancel_reason, created_at, updated_at)
  on public.legal_intimations to authenticated;

create policy legal_deadlines_select on public.legal_deadlines for select
  using (case when case_id is null then public.has_tenant(tenant_id) and public.tenant_role(tenant_id) <> 'finance'
              else public.legal_can_access_case(case_id) end);
create policy legal_deadlines_insert on public.legal_deadlines for insert
  with check (
    (case when case_id is null then public.has_tenant(tenant_id) and public.tenant_role(tenant_id) <> 'finance'
          else public.legal_can_access_case(case_id) end)
    and (kind <> 'fatal' or public.tenant_role(tenant_id) in ('owner', 'manager', 'professional')));
create policy legal_deadlines_update on public.legal_deadlines for update
  using (case when case_id is null then public.has_tenant(tenant_id) and public.tenant_role(tenant_id) <> 'finance'
              else public.legal_can_access_case(case_id) end)
  with check (public.has_tenant(tenant_id) and public.tenant_role(tenant_id) <> 'finance');

create policy legal_deadline_changes_select on public.legal_deadline_changes for select
  using (exists (select 1 from public.legal_deadlines d where d.id = deadline_id));
create policy legal_deadline_alerts_select on public.legal_deadline_alerts for select
  using (exists (select 1 from public.legal_deadlines d where d.id = deadline_id));
-- só o servidor GRAVA a captura e a sugestão; ler é de quem triagem (a sugestão herda a visibilidade da
-- intimação, e a saúde da captura é da direção, que é quem decide quando o robô parou)
create policy legal_intimation_suggestions_select on public.legal_intimation_suggestions for select
  using (exists (select 1 from public.legal_intimations i where i.id = intimation_id));
create policy legal_intimation_sync_select on public.legal_intimation_sync for select
  using (public.has_tenant(tenant_id) and public.tenant_role(tenant_id) in ('owner', 'manager'));

-- ---------------------------------------------------------------------
-- 7) As portas do servidor
-- ---------------------------------------------------------------------
-- Gravação idempotente da captura (só service_role). p = { tenant_id, alvo, dia, count_fonte, itens: [...] }
create or replace function public.legal_intimacoes_gravar(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_tenant uuid := (p->>'tenant_id')::uuid;
  v_item jsonb;
  v_novas int := 0;
  v_vinculadas int := 0;
  v_id uuid;
  v_caso uuid;
  v_gravadas int;
begin
  for v_item in select * from jsonb_array_elements(coalesce(p->'itens', '[]'::jsonb)) loop
    select c.id into v_caso from public.legal_cases c
     where c.tenant_id = v_tenant and c.cnj_number = v_item->>'numero_processo' and c.archived_at is null
     order by c.created_at limit 1;
    insert into public.legal_intimations (tenant_id, djen_id, hash, numero_processo, data_disponibilizacao, tribunal, orgao, tipo,
                                          classe, texto_sanitizado, link, destinatarios, alvo, case_id, status, cancelled_at, cancel_reason)
    values (v_tenant, (v_item->>'djen_id')::bigint, v_item->>'hash', v_item->>'numero_processo', (v_item->>'data_disponibilizacao')::date,
            v_item->>'tribunal', v_item->>'orgao', v_item->>'tipo', v_item->>'classe', v_item->>'texto', v_item->>'link',
            coalesce(v_item->'destinatarios', '[]'::jsonb), p->>'alvo', v_caso,
            case when v_caso is null then 'nova' else 'vinculada' end,
            (v_item->>'cancelado_em')::timestamptz, v_item->>'motivo_cancelamento')
    on conflict (tenant_id, djen_id) do update
       set cancelled_at = coalesce(public.legal_intimations.cancelled_at, excluded.cancelled_at),
           cancel_reason = coalesce(public.legal_intimations.cancel_reason, excluded.cancel_reason)
    returning id into v_id;
    if v_caso is not null then v_vinculadas := v_vinculadas + 1; end if;
    v_novas := v_novas + 1;
  end loop;
  select count(*) into v_gravadas from public.legal_intimations
   where tenant_id = v_tenant and alvo = p->>'alvo' and data_disponibilizacao = (p->>'dia')::date;
  insert into public.legal_intimation_sync (tenant_id, alvo, dia, count_fonte, count_gravado, ok, detalhe)
  values (v_tenant, p->>'alvo', (p->>'dia')::date, (p->>'count_fonte')::int, v_gravadas,
          v_gravadas >= (p->>'count_fonte')::int, case when v_gravadas < (p->>'count_fonte')::int then 'faltam intimações deste dia' end)
  on conflict (tenant_id, alvo, dia) do update
     set count_fonte = excluded.count_fonte, count_gravado = excluded.count_gravado, ok = excluded.ok, detalhe = excluded.detalhe;
  return jsonb_build_object('processadas', v_novas, 'vinculadas', v_vinculadas, 'gravadas_no_dia', v_gravadas);
end $$;
revoke all on function public.legal_intimacoes_gravar(jsonb) from public, anon, authenticated;
grant execute on function public.legal_intimacoes_gravar(jsonb) to service_role;

-- Texto completo da intimação, com trilha (o SELECT direto não alcança a coluna)
create or replace function public.legal_abrir_intimacao(p_id uuid)
returns table (texto text, destinatarios jsonb) language plpgsql security definer set search_path = public as $$
declare
  v public.legal_intimations;
begin
  select * into v from public.legal_intimations i where i.id = p_id;
  if v.id is null then return; end if;
  if not public.has_tenant(v.tenant_id) then return; end if;
  if v.case_id is null then
    if public.tenant_role(v.tenant_id) not in ('owner', 'manager', 'professional') then return; end if;
  elsif not public.legal_can_access_case(v.case_id) then
    return;
  end if;
  insert into public.legal_access_log (tenant_id, user_id, case_id, kind) values (v.tenant_id, auth.uid(), v.case_id, 'open_intimation');
  return query select v.texto_sanitizado, v.destinatarios;
end $$;
revoke all on function public.legal_abrir_intimacao(uuid) from public, anon;
grant execute on function public.legal_abrir_intimacao(uuid) to authenticated;
