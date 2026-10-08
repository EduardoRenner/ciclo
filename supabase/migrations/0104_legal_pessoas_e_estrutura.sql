-- =====================================================================
-- CICLO · pacote Advocacia: pessoas, empresas e participação societária no tempo (migration 0104)
--
-- docs/101 anexo 01 §2.1-§2.4 (T1.1). Origem do desenho: LUBI `0014_estrutura.sql` (entities,
-- corporate_changes, ownerships temporais com exclusão GiST), reescrito para multi-tenant.
--
-- ## Por que FK composta por tenant
--
-- `client_id` sozinho deixaria uma linha do escritório A apontar para cliente do escritório B (a RLS
-- confere o `tenant_id` da linha, não o do alvo). A FK `(client_id, tenant_id)` → `clients(id,
-- tenant_id)` torna isso impossível no banco. Para ela existir, `clients` ganha um índice único
-- `(id, tenant_id)`: aditivo e barato (o `id` já é único sozinho).
--
-- ## Participação nunca muda de percentual
--
-- Mudou o quadro? Um ATO (`legal_corporate_changes`) fecha as participações antigas (`valid_to`) e
-- abre as novas, numa transação só, pela função `legal_apply_corporate_change` (INVOKER: a RLS do
-- usuário vale dentro dela, PM-D-009 do LUBI). O gatilho recusa UPDATE que mexa em percentual, dono
-- ou empresa; o que pode mudar numa linha é só o fechamento.
--
-- ## Sem DELETE
--
-- Nenhuma das quatro tabelas tem política de DELETE: com RLS forçada, ausência de política é
-- negação (mesmo desenho da 0080). Pessoa e empresa se arquivam (`archived_at`). A eliminação da
-- LGPD anonimiza por função com `service_role` (docs/101 anexo 02 §3.6), não apaga.
-- =====================================================================

create unique index if not exists clients_id_tenant_uidx on public.clients (id, tenant_id);

-- ---------------------------------------------------------------------
-- legal_persons: as pessoas físicas da conta (titular, cônjuge, herdeiros, sócios)
-- ---------------------------------------------------------------------
create table public.legal_persons (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  client_id       uuid not null,
  full_name       text not null check (char_length(btrim(full_name)) between 2 and 160),
  relationship    text not null default 'outro' check (relationship in (
                    'titular', 'conjuge', 'filho_filha', 'pai_mae', 'irmao_irma', 'neto_neta', 'socio_socia', 'outro')),
  marital_regime  text not null default 'nao_informado' check (marital_regime in (
                    'comunhao_parcial', 'comunhao_universal', 'separacao_total', 'participacao_final', 'uniao_estavel', 'nao_informado')),
  birth_date      date check (birth_date is null or birth_date between date '1900-01-01' and date '2100-01-01'),
  -- sha256(CPF + sal do servidor), nunca o CPF (docs/101 D2)
  document_hash   text check (document_hash is null or document_hash ~ '^[0-9a-f]{64}$'),
  phone_e164      text check (phone_e164 is null or phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  email           citext,
  is_contact      boolean not null default false,
  notes           text check (notes is null or char_length(notes) <= 2000),
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  archived_at     timestamptz,
  row_version     int not null default 1,
  unique (id, tenant_id),
  foreign key (client_id, tenant_id) references public.clients (id, tenant_id) on delete cascade
);
create index legal_persons_client_idx on public.legal_persons (tenant_id, client_id) where archived_at is null;
create index legal_persons_client_fk_idx on public.legal_persons (client_id, tenant_id);
create index legal_persons_doc_idx on public.legal_persons (tenant_id, document_hash) where document_hash is not null;
create index legal_persons_created_by_idx on public.legal_persons (created_by);

-- ---------------------------------------------------------------------
-- legal_entities: as empresas da conta (holding, operacional, externa)
-- ---------------------------------------------------------------------
create table public.legal_entities (
  id                   uuid primary key default gen_random_uuid(),
  tenant_id            uuid not null references public.tenants(id) on delete cascade,
  client_id            uuid not null,
  kind                 text not null check (kind in ('holding_patrimonial', 'holding_participacoes', 'holding_mista', 'operacional', 'outra')),
  legal_name           text not null check (char_length(btrim(legal_name)) between 2 and 200),
  trade_name           text check (trade_name is null or char_length(trade_name) <= 120),
  cnpj_hash            text check (cnpj_hash is null or cnpj_hash ~ '^[0-9a-f]{64}$'),
  legal_form           text check (legal_form is null or legal_form in (
                         'ltda', 'slu', 'sa_fechada', 'sa_aberta', 'eireli_legado', 'simples_sociedade', 'cooperativa', 'outra')),
  tax_regime           text check (tax_regime is null or tax_regime in ('simples', 'presumido', 'real', 'imune_isenta', 'nao_informado')),
  main_cnae            text check (main_cnae is null or main_cnae ~ '^[0-9]{7}$'),
  city                 text check (city is null or char_length(city) <= 80),
  uf                   text check (uf is null or uf ~ '^[A-Z]{2}$'),
  incorporated_on      date check (incorporated_on is null or incorporated_on between date '1900-01-01' and date '2100-01-01'),
  share_capital_cents  bigint check (share_capital_cents is null or share_capital_cents >= 0),
  total_quotas         bigint check (total_quotas is null or total_quotas > 0),
  status               text not null default 'ativa' check (status in ('ativa', 'inativa', 'baixada', 'em_constituicao')),
  is_external          boolean not null default false,
  -- ponto de extensão "ativo com ciclo" (docs/101 §2): a revisão anual da holding
  next_review_on       date,
  created_by           uuid references auth.users(id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  archived_at          timestamptz,
  row_version          int not null default 1,
  unique (id, tenant_id),
  foreign key (client_id, tenant_id) references public.clients (id, tenant_id) on delete cascade
);
create index legal_entities_client_idx on public.legal_entities (tenant_id, client_id) where archived_at is null;
create index legal_entities_client_fk_idx on public.legal_entities (client_id, tenant_id);
-- o mesmo CNPJ não se repete no mesmo cliente; em clientes diferentes é permitido (vira sinal de conflito, P2)
create unique index legal_entities_cnpj_por_cliente on public.legal_entities (tenant_id, client_id, cnpj_hash) where cnpj_hash is not null;
create index legal_entities_created_by_idx on public.legal_entities (created_by);

-- ---------------------------------------------------------------------
-- legal_corporate_changes: o ato que fecha e abre participações (append-only)
-- ---------------------------------------------------------------------
create table public.legal_corporate_changes (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants(id) on delete cascade,
  entity_id      uuid not null,
  effective_on   date not null check (effective_on between date '1900-01-01' and date '2200-01-01'),
  kind           text not null check (kind in (
                   'constituicao', 'alteracao_contratual', 'cessao_quotas', 'aumento_capital', 'reducao_capital',
                   'doacao_quotas', 'entrada_socio', 'saida_socio', 'transformacao', 'incorporacao', 'outro')),
  description    text check (description is null or char_length(description) <= 1000),
  registered_on  date,
  created_by     uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now(),
  unique (id, tenant_id),
  foreign key (entity_id, tenant_id) references public.legal_entities (id, tenant_id) on delete cascade
);
create index legal_corporate_changes_entity_idx on public.legal_corporate_changes (entity_id, tenant_id, effective_on desc);
create index legal_corporate_changes_created_by_idx on public.legal_corporate_changes (created_by);
create index legal_corporate_changes_tenant_idx on public.legal_corporate_changes (tenant_id);

-- ---------------------------------------------------------------------
-- legal_ownerships: participação temporal; nunca UPDATE de percentual
-- ---------------------------------------------------------------------
create table public.legal_ownerships (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null references public.tenants(id) on delete cascade,
  owned_entity_id       uuid not null,
  owner_person_id       uuid,
  owner_entity_id       uuid,
  percent               numeric(9, 6) not null check (percent > 0 and percent <= 100),
  quotas                bigint check (quotas is null or quotas > 0),
  quota_class           text check (quota_class is null or char_length(quota_class) <= 40),
  usufruct_person_id    uuid,
  usufruct_until        date,
  valid_from            date not null check (valid_from between date '1900-01-01' and date '2200-01-01'),
  valid_to              date,
  opened_by_change_id   uuid not null,
  closed_by_change_id   uuid,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  owner_key             text generated always as (
                          case when owner_person_id is not null then 'p:' || owner_person_id::text
                               else 'e:' || owner_entity_id::text end) stored,
  foreign key (owned_entity_id, tenant_id) references public.legal_entities (id, tenant_id) on delete cascade,
  foreign key (owner_person_id, tenant_id) references public.legal_persons (id, tenant_id),
  foreign key (owner_entity_id, tenant_id) references public.legal_entities (id, tenant_id),
  foreign key (usufruct_person_id, tenant_id) references public.legal_persons (id, tenant_id),
  foreign key (opened_by_change_id, tenant_id) references public.legal_corporate_changes (id, tenant_id),
  foreign key (closed_by_change_id, tenant_id) references public.legal_corporate_changes (id, tenant_id),
  check ((owner_person_id is not null) <> (owner_entity_id is not null)),
  check (owner_entity_id is null or owner_entity_id <> owned_entity_id),
  check (valid_to is null or valid_to > valid_from),
  check ((valid_to is null) = (closed_by_change_id is null)),
  check (usufruct_until is null or usufruct_person_id is not null)
);
-- o mesmo dono não aparece duas vezes na mesma empresa em períodos que se sobrepõem
alter table public.legal_ownerships
  add constraint legal_ownerships_sem_sobreposicao
  exclude using gist (owned_entity_id with =, owner_key with =, daterange(valid_from, valid_to, '[)') with &&);
create index legal_ownerships_owned_idx on public.legal_ownerships (owned_entity_id, tenant_id) where valid_to is null;
create index legal_ownerships_owner_entity_idx on public.legal_ownerships (owner_entity_id, tenant_id) where owner_entity_id is not null;
create index legal_ownerships_owner_person_idx on public.legal_ownerships (owner_person_id, tenant_id) where owner_person_id is not null;
create index legal_ownerships_usufruct_idx on public.legal_ownerships (usufruct_person_id, tenant_id) where usufruct_person_id is not null;
create index legal_ownerships_opened_idx on public.legal_ownerships (opened_by_change_id, tenant_id);
create index legal_ownerships_closed_idx on public.legal_ownerships (closed_by_change_id, tenant_id) where closed_by_change_id is not null;
create index legal_ownerships_tenant_idx on public.legal_ownerships (tenant_id);

-- ---------------------------------------------------------------------
-- Gatilhos: carimbo e imutabilidade
-- ---------------------------------------------------------------------
create trigger legal_persons_touch before update on public.legal_persons for each row execute function public.touch_updated_at();
create trigger legal_entities_touch before update on public.legal_entities for each row execute function public.touch_updated_at();
create trigger legal_ownerships_touch before update on public.legal_ownerships for each row execute function public.touch_updated_at();

-- Participação só FECHA: percentual, dono, empresa, usufruto e abertura não mudam; e uma participação
-- fechada não reabre. Quem precisa de outro percentual registra um ato novo.
create or replace function public.legal_ownership_so_fecha()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.percent is distinct from old.percent
     or new.owned_entity_id is distinct from old.owned_entity_id
     or new.owner_person_id is distinct from old.owner_person_id
     or new.owner_entity_id is distinct from old.owner_entity_id
     or new.valid_from is distinct from old.valid_from
     or new.opened_by_change_id is distinct from old.opened_by_change_id
     or new.tenant_id is distinct from old.tenant_id then
    raise exception 'Participação não muda: registre um ato que feche esta e abra outra.' using errcode = 'P0001';
  end if;
  if old.valid_to is not null then
    raise exception 'Participação já fechada não reabre.' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger legal_ownerships_so_fecha before update on public.legal_ownerships
  for each row execute function public.legal_ownership_so_fecha();

-- Ato é prova: não muda depois de registrado.
create or replace function public.legal_negar_alteracao()
returns trigger language plpgsql set search_path = public as $$
begin
  raise exception 'Registro histórico não se altera.' using errcode = 'P0001';
end $$;
create trigger legal_corporate_changes_imutavel before update on public.legal_corporate_changes
  for each row execute function public.legal_negar_alteracao();

-- ---------------------------------------------------------------------
-- RLS: escritório só vê o seu; o papel `finance` não lê nem escreve estrutura (docs/101 §3.4)
-- ---------------------------------------------------------------------
alter table public.legal_persons enable row level security;
alter table public.legal_persons force row level security;
alter table public.legal_entities enable row level security;
alter table public.legal_entities force row level security;
alter table public.legal_corporate_changes enable row level security;
alter table public.legal_corporate_changes force row level security;
alter table public.legal_ownerships enable row level security;
alter table public.legal_ownerships force row level security;

create policy legal_persons_select on public.legal_persons for select
  using (public.has_tenant(tenant_id) and public.tenant_role(tenant_id) <> 'finance');
create policy legal_persons_insert on public.legal_persons for insert
  with check (public.has_tenant(tenant_id) and public.tenant_role(tenant_id) <> 'finance');
create policy legal_persons_update on public.legal_persons for update
  using (public.has_tenant(tenant_id) and public.tenant_role(tenant_id) <> 'finance')
  with check (public.has_tenant(tenant_id) and public.tenant_role(tenant_id) <> 'finance');

create policy legal_entities_select on public.legal_entities for select
  using (public.has_tenant(tenant_id) and public.tenant_role(tenant_id) <> 'finance');
create policy legal_entities_insert on public.legal_entities for insert
  with check (public.has_tenant(tenant_id) and public.tenant_role(tenant_id) <> 'finance');
create policy legal_entities_update on public.legal_entities for update
  using (public.has_tenant(tenant_id) and public.tenant_role(tenant_id) <> 'finance')
  with check (public.has_tenant(tenant_id) and public.tenant_role(tenant_id) <> 'finance');

create policy legal_corporate_changes_select on public.legal_corporate_changes for select
  using (public.has_tenant(tenant_id) and public.tenant_role(tenant_id) <> 'finance');
create policy legal_corporate_changes_insert on public.legal_corporate_changes for insert
  with check (public.has_tenant(tenant_id) and public.tenant_role(tenant_id) <> 'finance');

create policy legal_ownerships_select on public.legal_ownerships for select
  using (public.has_tenant(tenant_id) and public.tenant_role(tenant_id) <> 'finance');
create policy legal_ownerships_insert on public.legal_ownerships for insert
  with check (public.has_tenant(tenant_id) and public.tenant_role(tenant_id) <> 'finance');
create policy legal_ownerships_update on public.legal_ownerships for update
  using (public.has_tenant(tenant_id) and public.tenant_role(tenant_id) <> 'finance')
  with check (public.has_tenant(tenant_id) and public.tenant_role(tenant_id) <> 'finance');

-- ---------------------------------------------------------------------
-- A porta de escrita da estrutura: um ato fecha e abre participações numa transação
-- ---------------------------------------------------------------------
-- p = { tenant_id, entity_id, effective_on, kind, description?,
--       fechar: [ownership_id, ...],
--       abrir:  [{ owner_person_id? | owner_entity_id?, percent, quotas?, usufruct_person_id?, usufruct_until? }, ...] }
-- INVOKER de propósito: a RLS do usuário vale dentro (quem não alcança a empresa não registra ato nela).
create or replace function public.legal_apply_corporate_change(p jsonb)
returns uuid language plpgsql security invoker set search_path = public as $$
declare
  v_tenant uuid := (p->>'tenant_id')::uuid;
  v_entity uuid := (p->>'entity_id')::uuid;
  v_quando date := (p->>'effective_on')::date;
  v_ato uuid;
  v_id text;
  v_item jsonb;
  v_fechadas int;
begin
  if v_tenant is null or v_entity is null or v_quando is null then
    raise exception 'Ato sem escritório, empresa ou data.' using errcode = '22023';
  end if;

  insert into public.legal_corporate_changes (tenant_id, entity_id, effective_on, kind, description, created_by)
  values (v_tenant, v_entity, v_quando, p->>'kind', nullif(p->>'description', ''), auth.uid())
  returning id into v_ato;

  for v_id in select jsonb_array_elements_text(coalesce(p->'fechar', '[]'::jsonb)) loop
    update public.legal_ownerships
       set valid_to = v_quando, closed_by_change_id = v_ato
     where id = v_id::uuid and tenant_id = v_tenant and owned_entity_id = v_entity and valid_to is null;
    get diagnostics v_fechadas = row_count;
    -- UPDATE de zero linhas não é erro no Postgres; aqui é: a participação não existia, já estava
    -- fechada, ou é de outra empresa. Silenciar deixaria o quadro com duas versões abertas.
    if v_fechadas = 0 then
      raise exception 'Participação % não está aberta nesta empresa.', v_id using errcode = 'P0002';
    end if;
  end loop;

  for v_item in select * from jsonb_array_elements(coalesce(p->'abrir', '[]'::jsonb)) loop
    insert into public.legal_ownerships (
      tenant_id, owned_entity_id, owner_person_id, owner_entity_id, percent, quotas,
      usufruct_person_id, usufruct_until, valid_from, opened_by_change_id)
    values (
      v_tenant, v_entity, (v_item->>'owner_person_id')::uuid, (v_item->>'owner_entity_id')::uuid,
      (v_item->>'percent')::numeric, (v_item->>'quotas')::bigint,
      (v_item->>'usufruct_person_id')::uuid, (v_item->>'usufruct_until')::date, v_quando, v_ato);
  end loop;

  return v_ato;
end $$;
revoke all on function public.legal_apply_corporate_change(jsonb) from public, anon;
grant execute on function public.legal_apply_corporate_change(jsonb) to authenticated;

comment on table public.legal_ownerships is
  'docs/101 anexo 01 §2.4: participação temporal. Muda só por ato (legal_apply_corporate_change), que fecha e abre na mesma transação. Sem DELETE.';
