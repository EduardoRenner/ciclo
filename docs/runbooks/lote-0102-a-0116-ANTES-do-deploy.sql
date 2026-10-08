-- CICLO · lote 0102 a 0116 (pacote Advocacia)
-- PARA COLAR NO SQL EDITOR DO SUPABASE DE PRODUCAO (eqzlvthzdjnsbogymcsw). Rodar ANTES de o codigo novo ir ao ar.
--
-- ANTES DE COLAR, rode esta consulta e APAGUE deste arquivo os blocos das migrations que ela já listar
-- (a producao tinha 103 aplicadas contra 100 esperadas pelo codigo em 2026-10-08, e eu nao consigo ver
-- quais sao as 3 a mais):
--   select version, name from supabase_migrations.schema_migrations where version >= '0100' order by version;
--
-- Cada migration vai no seu proprio begin/commit e se registra no livro (`supabase_migrations.schema_migrations`,
-- formato version + name sem prefixo, o que o /api/health le). Se um bloco falhar, os anteriores ficam aplicados
-- e os seguintes NAO devem ser colados: pare e me mostre o erro.
-- Nao use `supabase db push` (docs/runbooks/publicar-a-branch-de-trabalho.md, secao 4.3).
-- Blocos neste arquivo: 0102, 0103, 0104, 0105, 0106, 0107, 0108, 0109, 0110, 0111, 0112, 0113, 0114, 0115, 0116

-- ===== 0102_pacote_advocacia.sql =====
begin;

-- =====================================================================
-- CICLO · a profissão ganha um PACOTE, e nasce a Advocacia (migration 0102)
--
-- docs/101-MVP-ADVOGADO.md §3.2 (T0.1). Um núcleo, vários pacotes: o que muda por
-- profissão (menu, botão central, vocabulário extra, módulos próprios) passa a ser
-- propriedade da LINHA do catálogo, não do tenant. `base` é exatamente o comportamento
-- de hoje, e é o padrão da coluna: nenhuma das 18 profissões existentes muda nada.
--
-- Por que uma coluna com `check` e não uma tabela: hoje são dois valores, e o que decide
-- o que cada pacote faz mora em código (`src/core/pacotes/`), com tipo, rota e componente.
-- A guarda `pacote-tem-registro` lê este `check` e exige que o registro em código tenha
-- exatamente estes slugs. Pacote novo = valor novo aqui + entrada lá, no mesmo commit.
--
-- Por que o pacote é da profissão e não de `tenants`: quem troca de profissão troca de
-- pacote; e `profession_id` já é a ponte que o onboarding grava (`executarOnboarding`).
-- Reverter: coluna em `tenants` que sobrepõe, se um dia um negócio precisar.
--
-- A linha `advocacia`: grupo `profissional` (`0022:25`); eixos pelo docs/09 §4 (advogado
-- não deixa desconhecido marcar direto: `inicio = 'solicitacao'`; honorário é orçamento;
-- ritmo sob demanda; híbrido). `ciclo_padrao_dias = 365`: revisão anual é o único ciclo
-- que faz sentido antes de o Motor aprender outro. O `vocab` guarda só palavras com plural
-- conhecido (`vocabulario-da-profissao` confere) e sem gênero ("profissional", nunca
-- "advogado"). Os sinônimos são termos de BUSCA do onboarding, por isso trazem as duas
-- formas: quem digita "advogada" precisa achar a linha.
--
-- Nenhuma conta consegue usar este pacote em produção enquanto a chave `ADVOCACIA_ABERTA`
-- (T0.6) estiver desligada: a linha existe para o cadastro local e para a demonstração.
-- =====================================================================

alter table public.professions
  add column pacote text not null default 'base'
  check (pacote in ('base', 'advocacia'));

insert into public.professions
  (slug, nome, grupo, sinonimos, onde, cobranca, inicio, ritmo,
   vocab, duracao_padrao_min, ciclo_padrao_dias, ativa, posicao, pacote)
values
  ('advocacia', 'Advocacia', 'profissional',
   '{"advogado","advogada","escritório de advocacia","direito","jurídico"}',
   'hibrido', 'orcamento', 'solicitacao', 'sob_demanda',
   '{"cliente":"cliente","atendimento":"reunião","profissional":"profissional","servico":"serviço","local":"escritório","agenda":"agenda"}',
   60, 365, true, 18, 'advocacia')
on conflict (slug) do nothing;

insert into supabase_migrations.schema_migrations (version, name) values ('0102', 'pacote_advocacia') on conflict do nothing;
commit;

-- ===== 0103_modulos_do_pacote.sql =====
begin;

-- =====================================================================
-- CICLO · os cinco módulos do pacote Advocacia (migration 0103)
--
-- docs/101-MVP-ADVOGADO.md §3.3 (T0.2). Mesmo desenho da 0043: a 0041 já foi aplicada em
-- produção e não se edita, então módulo novo entra como INSERT em migration própria. A guarda
-- `tests/unit/core/modulos-catalogo.test.ts` lê as três (0041, 0043, 0103) e exige que o
-- `CATALOGO` de `core/billing/planos.ts` tenha as mesmas chaves, na mesma ordem.
--
-- Sem `eixo`: o que condiciona estes cinco não é um dos quatro eixos da 0023, é o PACOTE da
-- profissão (0102). Essa quarta camada mora em código (`CONDICAO_DE_PACOTE`, antes do eixo na
-- ordem de `podeUsarModulo`), e não ganhou coluna aqui de propósito: `modules.eixo` existe porque
-- a tela de bloqueio precisa explicar "não se aplica ao seu tipo de atendimento"; módulo fora do
-- pacote não aparece para explicar nada. Se um dia a tela precisar, a coluna entra aditiva.
--
-- `sempre_ligado = false` em todos: o escritório pode desligar o que não usa (Estrutura, por
-- exemplo, num escritório só de contencioso). Tenant de beleza nunca vê nenhum deles.
-- =====================================================================

insert into modules (key, label, eixo, sempre_ligado, ordem) values
  ('legal_cases',      'Casos',                  null, false, 18),
  ('legal_checklists', 'Pendências do cliente',  null, false, 19),
  ('legal_structure',  'Estrutura da família',   null, false, 20),
  ('legal_deadlines',  'Prazos e intimações',    null, false, 21),
  ('legal_documents',  'Documentos do caso',     null, false, 22);

insert into supabase_migrations.schema_migrations (version, name) values ('0103', 'modulos_do_pacote') on conflict do nothing;
commit;

-- ===== 0104_legal_pessoas_e_estrutura.sql =====
begin;

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

insert into supabase_migrations.schema_migrations (version, name) values ('0104', 'legal_pessoas_e_estrutura') on conflict do nothing;
commit;

-- ===== 0105_legal_casos.sql =====
begin;

-- =====================================================================
-- CICLO · pacote Advocacia: casos, equipe do caso, reuniões e sigilo (migration 0105)
--
-- docs/101 anexo 01 §2.5-§2.6 (T1.2). A reunião do caso (§2.7) mora na 0108. Origem: LUBI `0013_casos.sql`, reescrito para multi-tenant.
-- As mesmas regras que `core/advocacia/casos.ts` aplica na tela, repetidas aqui como rede:
--   - `client_title` obrigatório (é o único título que vai para o cliente);
--   - criminal e júri nascem sigilosos e não descem;
--   - tirar o sigilo: só `owner`, com motivo;
--   - caso sigiloso só para `owner`/`manager` e para quem está na equipe do caso.
--
-- `legal_can_access_case(case_id)` é a peça que as tabelas seguintes (pendências, documentos,
-- prazos, intimações vinculadas) usam nas próprias políticas: o sigilo mora num lugar só.
-- =====================================================================

create table public.legal_cases (
  id                           uuid primary key default gen_random_uuid(),
  tenant_id                    uuid not null references public.tenants(id) on delete cascade,
  client_id                    uuid not null,
  kind                         text not null check (kind in (
                                 'holding', 'inventario', 'planejamento_sucessorio', 'divorcio_partilha', 'contrato',
                                 'societario', 'tributario', 'trabalhista', 'civel', 'outro')),
  area                         text not null default 'outro' check (area in (
                                 'holding_planejamento', 'empresarial', 'familia_sucessoes', 'tributario', 'bancario',
                                 'trabalhista', 'previdenciario', 'civel', 'criminal', 'tribunal_juri', 'outro')),
  title                        text not null check (char_length(btrim(title)) between 2 and 200),
  client_title                 text not null check (char_length(btrim(client_title)) between 2 and 200),
  status                       text not null default 'aberto' check (status in (
                                 'aberto', 'em_andamento', 'aguardando_cliente', 'aguardando_terceiros', 'concluido', 'arquivado')),
  client_status_note           text check (client_status_note is null or char_length(client_status_note) <= 300),
  sensitivity                  text not null default 'normal' check (sensitivity in ('normal', 'sigiloso')),
  sensitivity_reason           text check (sensitivity_reason is null or char_length(sensitivity_reason) <= 300),
  responsible_professional_id  uuid references public.professionals(id) on delete set null,
  cnj_number                   text check (cnj_number is null or cnj_number ~ '^[0-9]{20}$'),
  rito                         text check (rito is null or rito in ('civel', 'trabalhista', 'jec', 'penal')),
  prazo_em_dobro               boolean not null default false,
  comarca                      text check (comarca is null or char_length(btrim(comarca)) between 2 and 80),
  checklist_template_version   int,
  opened_on                    date not null default current_date,
  closed_on                    date,
  created_by                   uuid references auth.users(id) on delete set null,
  created_at                   timestamptz not null default now(),
  updated_at                   timestamptz not null default now(),
  archived_at                  timestamptz,
  row_version                  int not null default 1,
  unique (id, tenant_id),
  foreign key (client_id, tenant_id) references public.clients (id, tenant_id) on delete cascade,
  check (closed_on is null or closed_on >= opened_on)
);
create index legal_cases_client_idx on public.legal_cases (client_id, tenant_id);
create index legal_cases_tenant_status_idx on public.legal_cases (tenant_id, status) where archived_at is null;
create index legal_cases_cnj_idx on public.legal_cases (tenant_id, cnj_number) where cnj_number is not null;
create index legal_cases_responsible_idx on public.legal_cases (responsible_professional_id);
create index legal_cases_created_by_idx on public.legal_cases (created_by);

create table public.legal_case_members (
  case_id          uuid not null,
  tenant_id        uuid not null references public.tenants(id) on delete cascade,
  professional_id  uuid not null references public.professionals(id) on delete cascade,
  role             text not null default 'equipe' check (role in ('responsavel', 'equipe')),
  created_at       timestamptz not null default now(),
  primary key (case_id, professional_id),
  foreign key (case_id, tenant_id) references public.legal_cases (id, tenant_id) on delete cascade
);
create index legal_case_members_professional_idx on public.legal_case_members (professional_id);
create index legal_case_members_case_fk_idx on public.legal_case_members (case_id, tenant_id);
create index legal_case_members_tenant_idx on public.legal_case_members (tenant_id);

create trigger legal_cases_touch before update on public.legal_cases for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- Sigilo: criminal/júri nascem e ficam sigilosos; descer só a direção, com motivo
-- ---------------------------------------------------------------------
create or replace function public.legal_cases_regras_de_sigilo()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.area in ('criminal', 'tribunal_juri') then
    new.sensitivity := 'sigiloso';
  end if;
  if tg_op = 'UPDATE' and old.sensitivity = 'sigiloso' and new.sensitivity = 'normal' then
    -- `current_user` diferente de `authenticated` = servidor (service_role) ou dono da migration
    if current_user = 'authenticated' and coalesce(public.tenant_role(new.tenant_id)::text, '') <> 'owner' then
      raise exception 'Só a direção tira o sigilo de um caso.' using errcode = '42501';
    end if;
    if char_length(btrim(coalesce(new.sensitivity_reason, ''))) < 5 then
      raise exception 'Tirar o sigilo exige motivo.' using errcode = '23514';
    end if;
  end if;
  return new;
end $$;
create trigger legal_cases_sigilo before insert or update on public.legal_cases
  for each row execute function public.legal_cases_regras_de_sigilo();

-- Quem cria o caso entra na equipe como responsável. Sem isto, a advocacia que cria um caso SIGILOSO
-- perde o acesso a ele no mesmo instante (o sigiloso só abre para direção e equipe). `security definer`
-- porque a política de inserir membro exige enxergar o caso, que é justamente o que falta aqui.
create or replace function public.legal_cases_criador_na_equipe()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_prof uuid := public.my_professional_id(new.tenant_id);
begin
  if v_prof is not null then
    insert into public.legal_case_members (case_id, tenant_id, professional_id, role)
    values (new.id, new.tenant_id, v_prof, 'responsavel')
    on conflict (case_id, professional_id) do nothing;
  end if;
  return null;
end $$;
revoke all on function public.legal_cases_criador_na_equipe() from public, anon, authenticated;
create trigger legal_cases_criador_na_equipe after insert on public.legal_cases
  for each row execute function public.legal_cases_criador_na_equipe();

-- ---------------------------------------------------------------------
-- Quem enxerga o caso (base das políticas das tabelas jurídicas)
-- ---------------------------------------------------------------------
create or replace function public.legal_can_access_case(p_case uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.legal_cases c
     where c.id = p_case
       and public.has_tenant(c.tenant_id)
       and public.tenant_role(c.tenant_id) <> 'finance'
       and (
         c.sensitivity = 'normal'
         or public.tenant_role(c.tenant_id) in ('owner', 'manager')
         or exists (
           select 1 from public.legal_case_members m
            where m.case_id = c.id and m.professional_id = public.my_professional_id(c.tenant_id))
       )
  );
$$;
revoke all on function public.legal_can_access_case(uuid) from public, anon;
grant execute on function public.legal_can_access_case(uuid) to authenticated;

-- Quem está na equipe do caso. Separada de `legal_can_access_case` para a política da PRÓPRIA tabela
-- `legal_cases` não precisar reler a linha (ver a política abaixo).
create or replace function public.legal_sou_da_equipe(p_case uuid, p_tenant uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.legal_case_members m
     where m.case_id = p_case and m.professional_id = public.my_professional_id(p_tenant));
$$;
revoke all on function public.legal_sou_da_equipe(uuid, uuid) from public, anon;
grant execute on function public.legal_sou_da_equipe(uuid, uuid) to authenticated;

-- "N itens restritos": só o número, nenhuma coluna (para a tela dizer que existe algo que a pessoa não vê)
create or replace function public.legal_count_restricted(p_tenant uuid)
returns integer language sql stable security definer set search_path = public as $$
  select case when not public.has_tenant(p_tenant) then 0 else (
    select count(*)::int from public.legal_cases c
     where c.tenant_id = p_tenant and c.archived_at is null and not public.legal_can_access_case(c.id)
  ) end;
$$;
revoke all on function public.legal_count_restricted(uuid) from public, anon;
grant execute on function public.legal_count_restricted(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.legal_cases enable row level security;
alter table public.legal_cases force row level security;
alter table public.legal_case_members enable row level security;
alter table public.legal_case_members force row level security;

-- A política da PRÓPRIA tabela lê as colunas da linha, e não `legal_can_access_case(id)`: aquela função
-- relê `legal_cases` com o snapshot do início do comando, onde a linha de um INSERT ainda não existe.
-- Resultado medido no banco local: `insert ... returning` de caso SIGILOSO caía em 42501 até para a
-- direção. As outras tabelas jurídicas podem usar a função, porque o caso já existe quando elas gravam.
create policy legal_cases_select on public.legal_cases for select
  using (
    public.has_tenant(tenant_id) and public.tenant_role(tenant_id) <> 'finance'
    and (sensitivity = 'normal' or public.tenant_role(tenant_id) in ('owner', 'manager') or public.legal_sou_da_equipe(id, tenant_id)));
create policy legal_cases_insert on public.legal_cases for insert
  with check (public.has_tenant(tenant_id) and public.tenant_role(tenant_id) <> 'finance');
create policy legal_cases_update on public.legal_cases for update
  using (
    public.has_tenant(tenant_id) and public.tenant_role(tenant_id) <> 'finance'
    and (sensitivity = 'normal' or public.tenant_role(tenant_id) in ('owner', 'manager') or public.legal_sou_da_equipe(id, tenant_id)))
  with check (public.has_tenant(tenant_id) and public.tenant_role(tenant_id) <> 'finance');

create policy legal_case_members_select on public.legal_case_members for select
  using (public.legal_can_access_case(case_id));
create policy legal_case_members_insert on public.legal_case_members for insert
  with check (public.legal_can_access_case(case_id) and public.tenant_role(tenant_id) in ('owner', 'manager', 'professional'));
create policy legal_case_members_delete on public.legal_case_members for delete
  using (public.legal_can_access_case(case_id) and public.tenant_role(tenant_id) in ('owner', 'manager'));

insert into supabase_migrations.schema_migrations (version, name) values ('0105', 'legal_casos') on conflict do nothing;
commit;

-- ===== 0106_legal_checklists.sql =====
begin;

-- =====================================================================
-- CICLO · pacote Advocacia: modelos de checklist e "o que falta de você" (migration 0106)
--
-- docs/101 anexo 01 §2.8-§2.9 (T1.3). Origem: LUBI `0021` (`client_actions`: estados, rodada, escada
-- de lembretes) e o `workflow_templates` que o LUBI planejou e não fez. As regras de estado e a
-- geração das datas moram em `core/advocacia/checklist.ts`; aqui ficam os checks que o banco garante.
--
-- Modelo da PLATAFORMA = `tenant_id` nulo (semeado aqui, texto `precisa_revisao` até o advogado
-- revisar); modelo do ESCRITÓRIO = com `tenant_id`. Caso aberto congela a versão: mudar o modelo não
-- mexe em pendência que já existe.
-- =====================================================================

create table public.legal_checklist_templates (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid references public.tenants(id) on delete cascade,
  case_kind   text not null check (case_kind in (
                'holding', 'inventario', 'planejamento_sucessorio', 'divorcio_partilha', 'contrato',
                'societario', 'tributario', 'trabalhista', 'civel', 'outro')),
  name        text not null check (char_length(btrim(name)) between 3 and 120),
  version     int not null default 1 check (version >= 1),
  active      boolean not null default true,
  -- enquanto `true`, a tela mostra "modelo de exemplo, a revisar pela advocacia"
  needs_review boolean not null default true,
  created_at  timestamptz not null default now()
);
create unique index legal_checklist_templates_versao_uidx
  on public.legal_checklist_templates (coalesce(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid), case_kind, version);
create index legal_checklist_templates_tenant_idx on public.legal_checklist_templates (tenant_id);

create table public.legal_checklist_template_items (
  id                    uuid primary key default gen_random_uuid(),
  template_id           uuid not null references public.legal_checklist_templates(id) on delete cascade,
  position              int not null check (position >= 1),
  title                 text not null check (char_length(btrim(title)) between 2 and 200),
  kind                  text not null check (kind in ('enviar_documento', 'assinar', 'responder', 'conferir', 'agendar')),
  owed_by               text not null check (owed_by in ('cliente', 'equipe')),
  offset_business_days  int not null check (offset_business_days between 0 and 365),
  urgency               text not null default 'media' check (urgency in ('alta', 'media', 'baixa')),
  expected_category     text check (expected_category is null or char_length(expected_category) <= 60),
  unique (template_id, position)
);

create table public.legal_checklist_items (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references public.tenants(id) on delete cascade,
  case_id            uuid not null,
  template_item_id   uuid references public.legal_checklist_template_items(id) on delete set null,
  position           int not null default 1 check (position >= 1),
  title              text not null check (char_length(btrim(title)) between 2 and 200),
  instructions       text check (instructions is null or char_length(instructions) <= 2000),
  kind               text not null check (kind in ('enviar_documento', 'assinar', 'responder', 'conferir', 'agendar')),
  owed_by            text not null check (owed_by in ('cliente', 'equipe')),
  owed_by_person_id  uuid,
  expected_category  text check (expected_category is null or char_length(expected_category) <= 60),
  urgency            text not null default 'media' check (urgency in ('alta', 'media', 'baixa')),
  due_on             date,
  status             text not null default 'pendente' check (status in (
                       'rascunho', 'pendente', 'recebido', 'em_conferencia', 'concluido', 'devolvido', 'cancelado')),
  returned_reason    text check (returned_reason is null or char_length(returned_reason) <= 500),
  cancel_reason      text check (cancel_reason is null or char_length(cancel_reason) <= 300),
  rodada             int not null default 1 check (rodada >= 1),
  rodada_desde       date not null default current_date,
  reminders_sent     int[] not null default '{}',
  call_task_created  boolean not null default false,
  document_id        uuid,
  approved_by        uuid references auth.users(id) on delete set null,
  approved_at        timestamptz,
  created_by         uuid references auth.users(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  row_version        int not null default 1,
  unique (id, tenant_id),
  foreign key (case_id, tenant_id) references public.legal_cases (id, tenant_id) on delete cascade,
  foreign key (owed_by_person_id, tenant_id) references public.legal_persons (id, tenant_id),
  constraint legal_checklist_devolvida_tem_motivo check (status <> 'devolvido' or char_length(btrim(coalesce(returned_reason, ''))) >= 5),
  constraint legal_checklist_cancelada_tem_motivo check (status <> 'cancelado' or char_length(btrim(coalesce(cancel_reason, ''))) >= 5),
  constraint legal_checklist_pessoa_so_do_cliente check (owed_by_person_id is null or owed_by = 'cliente')
);
create index legal_checklist_items_case_idx on public.legal_checklist_items (case_id, tenant_id);
create index legal_checklist_items_abertas_idx on public.legal_checklist_items (tenant_id, due_on)
  where status in ('pendente', 'recebido', 'em_conferencia', 'devolvido');
create index legal_checklist_items_person_idx on public.legal_checklist_items (owed_by_person_id, tenant_id) where owed_by_person_id is not null;
create index legal_checklist_items_template_item_idx on public.legal_checklist_items (template_item_id);
create index legal_checklist_items_approved_by_idx on public.legal_checklist_items (approved_by);
create index legal_checklist_items_created_by_idx on public.legal_checklist_items (created_by);

create trigger legal_checklist_items_touch before update on public.legal_checklist_items
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.legal_checklist_templates enable row level security;
alter table public.legal_checklist_templates force row level security;
alter table public.legal_checklist_template_items enable row level security;
alter table public.legal_checklist_template_items force row level security;
alter table public.legal_checklist_items enable row level security;
alter table public.legal_checklist_items force row level security;

-- modelo da plataforma: todo autenticado lê; ninguém escreve pela API (só migration)
create policy legal_checklist_templates_select on public.legal_checklist_templates for select
  using ((tenant_id is null and auth.role() = 'authenticated') or public.has_tenant(tenant_id));
create policy legal_checklist_templates_insert on public.legal_checklist_templates for insert
  with check (tenant_id is not null and public.has_tenant(tenant_id) and public.tenant_role(tenant_id) in ('owner', 'manager'));
create policy legal_checklist_templates_update on public.legal_checklist_templates for update
  using (tenant_id is not null and public.has_tenant(tenant_id) and public.tenant_role(tenant_id) in ('owner', 'manager'))
  with check (tenant_id is not null and public.has_tenant(tenant_id) and public.tenant_role(tenant_id) in ('owner', 'manager'));

create policy legal_checklist_template_items_select on public.legal_checklist_template_items for select
  using (exists (select 1 from public.legal_checklist_templates t where t.id = template_id
                  and ((t.tenant_id is null and auth.role() = 'authenticated') or public.has_tenant(t.tenant_id))));
create policy legal_checklist_template_items_insert on public.legal_checklist_template_items for insert
  with check (exists (select 1 from public.legal_checklist_templates t where t.id = template_id
                       and t.tenant_id is not null and public.has_tenant(t.tenant_id) and public.tenant_role(t.tenant_id) in ('owner', 'manager')));

create policy legal_checklist_items_select on public.legal_checklist_items for select
  using (public.legal_can_access_case(case_id));
create policy legal_checklist_items_insert on public.legal_checklist_items for insert
  with check (public.legal_can_access_case(case_id));
create policy legal_checklist_items_update on public.legal_checklist_items for update
  using (public.legal_can_access_case(case_id))
  with check (public.legal_can_access_case(case_id));

-- ---------------------------------------------------------------------
-- Modelos da plataforma (exemplo, `needs_review`: a advocacia revisa antes de valer como padrão)
-- ---------------------------------------------------------------------
with t as (
  insert into public.legal_checklist_templates (tenant_id, case_kind, name, version, needs_review) values
    (null, 'holding', 'Holding patrimonial', 1, true),
    (null, 'inventario', 'Inventário extrajudicial', 1, true),
    (null, 'planejamento_sucessorio', 'Planejamento sucessório', 1, true),
    (null, 'divorcio_partilha', 'Divórcio consensual com partilha', 1, true),
    (null, 'societario', 'Contrato e alteração societária', 1, true)
  returning id, case_kind
)
insert into public.legal_checklist_template_items (template_id, position, title, kind, owed_by, offset_business_days, urgency, expected_category)
select t.id, i.position, i.title, i.kind, i.owed_by, i.offset_business_days, i.urgency, i.expected_category
  from t
  join (values
    ('holding', 1, 'Conferir quadro societário e bens', 'conferir', 'equipe', 0, 'media', null),
    ('holding', 2, 'Documento de identificação dos sócios', 'enviar_documento', 'cliente', 5, 'media', 'identificacao_pessoal'),
    ('holding', 3, 'Certidão de casamento e pacto antenupcial', 'enviar_documento', 'cliente', 5, 'media', 'certidao_civil'),
    ('holding', 4, 'Matrícula atualizada de cada imóvel', 'enviar_documento', 'cliente', 10, 'alta', 'matricula_imovel'),
    ('holding', 5, 'IPTU, ITR ou CCIR de cada imóvel', 'enviar_documento', 'cliente', 10, 'media', 'iptu_itr_ccir'),
    ('holding', 6, 'Declaração de imposto de renda dos sócios', 'enviar_documento', 'cliente', 10, 'media', 'declaracao_ir'),
    ('holding', 7, 'Comprovante de endereço', 'enviar_documento', 'cliente', 5, 'baixa', 'comprovante_endereco'),
    ('holding', 8, 'Assinar o contrato social', 'assinar', 'cliente', 20, 'alta', 'contrato_social'),
    ('inventario', 1, 'Certidão de óbito', 'enviar_documento', 'cliente', 3, 'alta', 'certidao_civil'),
    ('inventario', 2, 'Documento de identificação dos herdeiros', 'enviar_documento', 'cliente', 5, 'media', 'identificacao_pessoal'),
    ('inventario', 3, 'Certidões negativas de débito', 'enviar_documento', 'cliente', 10, 'media', 'outro'),
    ('inventario', 4, 'Matrícula e avaliação dos bens', 'enviar_documento', 'cliente', 10, 'alta', 'matricula_imovel'),
    ('inventario', 5, 'Conferir plano de partilha', 'conferir', 'equipe', 15, 'media', null),
    ('planejamento_sucessorio', 1, 'Levantamento dos bens da família', 'responder', 'cliente', 5, 'media', null),
    ('planejamento_sucessorio', 2, 'Certidões civis da família', 'enviar_documento', 'cliente', 10, 'media', 'certidao_civil'),
    ('planejamento_sucessorio', 3, 'Declaração de imposto de renda', 'enviar_documento', 'cliente', 10, 'media', 'declaracao_ir'),
    ('planejamento_sucessorio', 4, 'Reunião de apresentação do cenário', 'agendar', 'equipe', 15, 'media', null),
    ('divorcio_partilha', 1, 'Certidão de casamento', 'enviar_documento', 'cliente', 3, 'media', 'certidao_civil'),
    ('divorcio_partilha', 2, 'Relação de bens e dívidas do casal', 'responder', 'cliente', 7, 'alta', null),
    ('divorcio_partilha', 3, 'Conferir proposta de partilha', 'conferir', 'equipe', 10, 'media', null),
    ('societario', 1, 'Contrato social atual e alterações', 'enviar_documento', 'cliente', 5, 'media', 'contrato_social'),
    ('societario', 2, 'Cartão CNPJ', 'enviar_documento', 'cliente', 3, 'baixa', 'cartao_cnpj'),
    ('societario', 3, 'Conferir minuta da alteração', 'conferir', 'equipe', 10, 'media', null)
  ) as i(case_kind, position, title, kind, owed_by, offset_business_days, urgency, expected_category)
    on i.case_kind = t.case_kind;

insert into supabase_migrations.schema_migrations (version, name) values ('0106', 'legal_checklists') on conflict do nothing;
commit;

-- ===== 0107_legal_documentos.sql =====
begin;

-- =====================================================================
-- CICLO · pacote Advocacia: documentos, versões imutáveis, vínculos e trilha de acesso (migration 0107)
--
-- docs/101 anexo 01 §2.10-§2.11, anexo 02 §3.4 (T1.4). Origem: LUBI `0023_documentos.sql`.
--
-- Bucket `legal-docs` PRIVADO e sem política em `storage.objects`: ninguém lê nem escreve objeto
-- pelo cliente do usuário. O servidor confere permissão (a RLS das tabelas abaixo, pelo cliente do
-- USUÁRIO), grava a trilha e só então assina uma URL curta com `service_role` dentro de `withTenant`.
-- É o mesmo desenho do bucket `media` (0013): a única porta é o servidor.
--
-- `legal_access_log` é a trilha de leitura sensível (documento aberto, baixado; caso sigiloso aberto),
-- append-only e sem política nenhuma: só o servidor grava e só o servidor lê (rota da direção).
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('legal-docs', 'legal-docs', false, 52428800, array[
  'application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.oasis.opendocument.text', 'text/plain'])
on conflict (id) do nothing;

create table public.legal_documents (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenants(id) on delete cascade,
  client_id           uuid not null,
  case_id             uuid,
  title               text not null check (char_length(btrim(title)) between 2 and 200),
  category            text not null default 'outro' check (category in (
                        'identificacao_pessoal', 'certidao_civil', 'pacto_antenupcial', 'comprovante_endereco',
                        'contrato_social', 'alteracao_contratual', 'ata_assembleia', 'acordo_socios', 'cartao_cnpj',
                        'procuracao', 'matricula_imovel', 'escritura', 'iptu_itr_ccir', 'contrato', 'declaracao_ir',
                        'extrato_bancario', 'contrato_bancario', 'testamento', 'peticao_decisao', 'laudo_avaliacao',
                        'comprovante_pagamento', 'outro')),
  tags                text[] not null default '{}' check (cardinality(tags) <= 20),
  current_version_id  uuid,
  issued_on           date,
  valid_until         date,
  sensitivity         text not null default 'normal' check (sensitivity in ('normal', 'sigiloso')),
  -- `cliente` = recebido do cliente (por WhatsApp, e-mail, pessoalmente) e lançado pela equipe; entra em
  -- quarentena (`recebido`) até alguém conferir. O envio direto pelo cliente (link) é P2.
  origin              text not null default 'equipe' check (origin in ('equipe', 'cliente')),
  status              text not null default 'aceito' check (status in ('recebido', 'em_conferencia', 'aceito', 'recusado')),
  refused_reason      text check (refused_reason is null or char_length(refused_reason) <= 300),
  reviewed_by         uuid references auth.users(id) on delete set null,
  reviewed_at         timestamptz,
  created_by          uuid references auth.users(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  archived_at         timestamptz,
  row_version         int not null default 1,
  unique (id, tenant_id),
  foreign key (client_id, tenant_id) references public.clients (id, tenant_id) on delete cascade,
  foreign key (case_id, tenant_id) references public.legal_cases (id, tenant_id),
  constraint legal_documents_validade check (valid_until is null or issued_on is null or valid_until >= issued_on),
  constraint legal_documents_recusa_tem_motivo check ((status = 'recusado') = (char_length(btrim(coalesce(refused_reason, ''))) >= 5)),
  constraint legal_documents_sigiloso_tem_caso check (sensitivity <> 'sigiloso' or case_id is not null),
  constraint legal_documents_cliente_comeca_em_quarentena check (origin = 'equipe' or status <> 'aceito' or reviewed_at is not null)
);
create index legal_documents_client_idx on public.legal_documents (client_id, tenant_id);
create index legal_documents_case_idx on public.legal_documents (case_id, tenant_id) where case_id is not null;
create index legal_documents_quarentena_idx on public.legal_documents (tenant_id, created_at) where status in ('recebido', 'em_conferencia');
create index legal_documents_reviewed_by_idx on public.legal_documents (reviewed_by);
create index legal_documents_created_by_idx on public.legal_documents (created_by);

create table public.legal_document_versions (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  document_id   uuid not null,
  version_no    int not null check (version_no > 0),
  -- {tenant}/{client}/{document}/{versão}: só uuids, nunca o nome original (que pode ter dado pessoal)
  storage_path  text not null unique check (storage_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9]+$'),
  mime          text not null check (mime in (
                  'application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic',
                  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                  'application/vnd.oasis.opendocument.text', 'text/plain')),
  size_bytes    bigint not null check (size_bytes > 0 and size_bytes <= 52428800),
  sha256        text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  note          text check (note is null or char_length(note) <= 300),
  removed_at    timestamptz,
  uploaded_by   uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  unique (document_id, version_no),
  unique (id, document_id),
  foreign key (document_id, tenant_id) references public.legal_documents (id, tenant_id) on delete cascade
);
create index legal_document_versions_document_idx on public.legal_document_versions (document_id, tenant_id);
create index legal_document_versions_uploaded_by_idx on public.legal_document_versions (uploaded_by);
create index legal_document_versions_tenant_idx on public.legal_document_versions (tenant_id);

alter table public.legal_documents
  add constraint legal_documents_current_version_fkey
  foreign key (current_version_id, id) references public.legal_document_versions (id, document_id);
create index legal_documents_current_version_idx on public.legal_documents (current_version_id, id) where current_version_id is not null;

create table public.legal_document_links (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  document_id  uuid not null,
  target_type  text not null check (target_type in ('person', 'entity', 'corporate_change', 'checklist_item')),
  target_id    uuid not null,
  created_at   timestamptz not null default now(),
  unique (document_id, target_type, target_id),
  foreign key (document_id, tenant_id) references public.legal_documents (id, tenant_id) on delete cascade
);
create index legal_document_links_alvo_idx on public.legal_document_links (tenant_id, target_type, target_id);
create index legal_document_links_document_fk_idx on public.legal_document_links (document_id, tenant_id);

create table public.legal_access_log (
  id           bigint generated always as identity primary key,
  at           timestamptz not null default now(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  user_id      uuid,
  client_id    uuid,
  document_id  uuid,
  version_id   uuid,
  case_id      uuid,
  kind         text not null check (kind in ('view', 'download', 'open_case', 'open_intimation')),
  ip_hash      text check (ip_hash is null or ip_hash ~ '^[0-9a-f]{16,64}$'),
  constraint legal_access_log_alvo check (
    (kind in ('view', 'download') and document_id is not null and version_id is not null)
    or (kind = 'open_case' and case_id is not null)
    or (kind = 'open_intimation'))
);
create index legal_access_log_tenant_idx on public.legal_access_log (tenant_id, at desc);
create index legal_access_log_document_idx on public.legal_access_log (document_id) where document_id is not null;

create trigger legal_documents_touch before update on public.legal_documents for each row execute function public.touch_updated_at();
-- versão é prova: só `removed_at` (eliminação LGPD, pelo servidor) pode mudar
create or replace function public.legal_versao_so_remove()
returns trigger language plpgsql set search_path = public as $$
begin
  if (to_jsonb(new) - 'removed_at') is distinct from (to_jsonb(old) - 'removed_at') then
    raise exception 'Versão de documento não se altera: envie uma versão nova.' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger legal_document_versions_imutavel before update on public.legal_document_versions
  for each row execute function public.legal_versao_so_remove();
create trigger legal_access_log_imutavel before update on public.legal_access_log
  for each row execute function public.legal_negar_alteracao();

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.legal_documents enable row level security;
alter table public.legal_documents force row level security;
alter table public.legal_document_versions enable row level security;
alter table public.legal_document_versions force row level security;
alter table public.legal_document_links enable row level security;
alter table public.legal_document_links force row level security;
alter table public.legal_access_log enable row level security;
alter table public.legal_access_log force row level security;

-- documento de caso segue o caso; documento sem caso segue o escritório (nunca o papel financeiro)
create policy legal_documents_select on public.legal_documents for select
  using (case when case_id is null then public.has_tenant(tenant_id) and public.tenant_role(tenant_id) <> 'finance'
              else public.legal_can_access_case(case_id) end);
create policy legal_documents_insert on public.legal_documents for insert
  with check (case when case_id is null then public.has_tenant(tenant_id) and public.tenant_role(tenant_id) <> 'finance'
                   else public.legal_can_access_case(case_id) end);
create policy legal_documents_update on public.legal_documents for update
  using (case when case_id is null then public.has_tenant(tenant_id) and public.tenant_role(tenant_id) <> 'finance'
              else public.legal_can_access_case(case_id) end)
  with check (public.has_tenant(tenant_id) and public.tenant_role(tenant_id) <> 'finance');

create policy legal_document_versions_select on public.legal_document_versions for select
  using (exists (select 1 from public.legal_documents d where d.id = document_id));
create policy legal_document_versions_insert on public.legal_document_versions for insert
  with check (exists (select 1 from public.legal_documents d where d.id = document_id));

create policy legal_document_links_select on public.legal_document_links for select
  using (exists (select 1 from public.legal_documents d where d.id = document_id));
create policy legal_document_links_insert on public.legal_document_links for insert
  with check (exists (select 1 from public.legal_documents d where d.id = document_id));
-- legal_access_log: sem política (só o servidor)

insert into supabase_migrations.schema_migrations (version, name) values ('0107', 'legal_documentos') on conflict do nothing;
commit;

-- ===== 0108_legal_reunioes_do_caso.sql =====
begin;

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

insert into supabase_migrations.schema_migrations (version, name) values ('0108', 'legal_reunioes_do_caso') on conflict do nothing;
commit;

-- ===== 0109_legal_intimacoes_e_prazos.sql =====
begin;

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

insert into supabase_migrations.schema_migrations (version, name) values ('0109', 'legal_intimacoes_e_prazos') on conflict do nothing;
commit;

-- ===== 0110_legal_rascunho_so_quem_assina_aprova.sql =====
begin;

-- docs/101 §3.4: o que o estágio gera nasce em RASCUNHO e só a direção ou a advocacia tira de lá.
-- Sem esta trava, a política de update de `legal_checklist_items` (quem enxerga o caso, edita) deixava
-- o próprio estágio aprovar o que gerou, e o rascunho virava formalidade.
-- Código próprio (LGL01), e não 42501: o 42501 é o mesmo da violação de RLS, e o servidor precisa
-- distinguir "a regra do rascunho recusou" de "a política recusou" para dar a frase certa.
create or replace function public.legal_rascunho_so_quem_assina_aprova()
returns trigger language plpgsql set search_path = public as $$
declare
  v_estagio boolean;
begin
  if old.status = 'rascunho' and new.status not in ('rascunho', 'cancelado') and current_user = 'authenticated' then
    select coalesce(p.legal_role = 'estagio', false) into v_estagio
      from public.professionals p where p.tenant_id = new.tenant_id and p.user_id = auth.uid() limit 1;
    if coalesce(v_estagio, false) then
      raise exception 'Quem é de estágio não aprova pendência em rascunho: peça à advocacia ou à direção.' using errcode = 'LGL01';
    end if;
  end if;
  return new;
end $$;

create trigger legal_checklist_items_rascunho before update on public.legal_checklist_items
  for each row execute function public.legal_rascunho_so_quem_assina_aprova();

insert into supabase_migrations.schema_migrations (version, name) values ('0110', 'legal_rascunho_so_quem_assina_aprova') on conflict do nothing;
commit;

-- ===== 0111_legal_trilha_do_caso_sigiloso.sql =====
begin;

-- docs/101 anexo 04 §4.4: "Caso sigiloso: cada abertura grava trilha". A trilha (`legal_access_log`,
-- 0107) não tem política para ninguém: só o servidor grava. Esta é a porta, e ela só registra o que a
-- pessoa de fato alcança (`legal_can_access_case`), para a trilha não virar um verificador de casos.
--
-- Só o SIGILOSO gera linha: abrir caso comum é rotina, e uma trilha que registra tudo é uma trilha que
-- ninguém lê. O que importa auditar é quem viu o que estava restrito.
create or replace function public.legal_registrar_abertura_do_caso(p_case uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_tenant uuid;
  v_sigiloso boolean;
begin
  if not public.legal_can_access_case(p_case) then
    return false;
  end if;
  select c.tenant_id, c.sensitivity = 'sigiloso' into v_tenant, v_sigiloso from public.legal_cases c where c.id = p_case;
  if not coalesce(v_sigiloso, false) then
    return false;
  end if;
  insert into public.legal_access_log (tenant_id, user_id, case_id, kind) values (v_tenant, auth.uid(), p_case, 'open_case');
  return true;
end $$;

revoke all on function public.legal_registrar_abertura_do_caso(uuid) from public, anon;
grant execute on function public.legal_registrar_abertura_do_caso(uuid) to authenticated;

insert into supabase_migrations.schema_migrations (version, name) values ('0111', 'legal_trilha_do_caso_sigiloso') on conflict do nothing;
commit;

-- ===== 0112_legal_intimacao_decidir.sql =====
begin;

-- docs/101 T4.2: a decisão da triagem de uma intimação. `legal_intimations` não tem política de escrita
-- para ninguém (0109): o que o tribunal publicou só muda de ESTADO, e só por esta porta.
--
-- p = { id, acao: 'vincular' | 'criar_prazo' | 'sem_prazo' | 'descartar', case_id?, due_on?, internal_due_on?,
--       title?, motivo? }
--
-- `security definer` porque grava em duas tabelas sem política de escrita para o usuário (a intimação) e
-- com política restrita (o prazo). Por isso a função REPETE as checagens que a RLS faria: tenant, papel,
-- alcance do caso. Códigos próprios para o servidor traduzir sem ambiguidade (memória
-- `sqlstate-42501-e-ambiguo`): LGL01 sem permissão, LGL02 entrada inválida, LGL04 não encontrada.
create or replace function public.legal_intimacao_decidir(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v public.legal_intimations;
  v_acao text := p->>'acao';
  v_caso uuid := nullif(p->>'case_id', '')::uuid;
  v_motivo text := nullif(btrim(coalesce(p->>'motivo', '')), '');
  v_due date := nullif(p->>'due_on', '')::date;
  v_interno date := nullif(p->>'internal_due_on', '')::date;
  v_titulo text := coalesce(nullif(btrim(coalesce(p->>'title', '')), ''), 'Prazo da intimação');
  v_cliente uuid;
  v_responsavel uuid;
  v_sug public.legal_intimation_suggestions;
  v_estagio boolean;
  v_prazo uuid;
begin
  select * into v from public.legal_intimations i where i.id = nullif(p->>'id', '')::uuid for update;
  if v.id is null or not public.has_tenant(v.tenant_id) then
    raise exception 'Essa intimação não está mais disponível.' using errcode = 'LGL04';
  end if;
  if public.tenant_role(v.tenant_id) not in ('owner', 'manager', 'professional') then
    raise exception 'Seu perfil não decide intimações.' using errcode = 'LGL01';
  end if;
  if v.case_id is not null and not public.legal_can_access_case(v.case_id) then
    raise exception 'Essa intimação não está mais disponível.' using errcode = 'LGL04';
  end if;
  if v.status in ('prazo_criado', 'sem_prazo', 'descartada') then
    raise exception 'Esta intimação já foi decidida.' using errcode = 'LGL02';
  end if;
  if v_acao not in ('vincular', 'criar_prazo', 'sem_prazo', 'descartar') then
    raise exception 'Ação desconhecida.' using errcode = 'LGL02';
  end if;

  -- o caso: o informado agora, ou o já vinculado
  v_caso := coalesce(v_caso, v.case_id);
  if v_caso is not null then
    select c.client_id, c.responsible_professional_id into v_cliente, v_responsavel
      from public.legal_cases c where c.id = v_caso and c.tenant_id = v.tenant_id;
    if v_cliente is null or not public.legal_can_access_case(v_caso) then
      raise exception 'Esse caso não está disponível.' using errcode = 'LGL04';
    end if;
  end if;

  if v_acao in ('vincular', 'criar_prazo') and v_caso is null then
    raise exception 'Escolha o caso desta intimação.' using errcode = 'LGL02';
  end if;
  if v_acao in ('sem_prazo', 'descartar') and char_length(coalesce(v_motivo, '')) < 5 then
    raise exception 'Escreva o motivo (pelo menos 5 letras): ele fica no histórico.' using errcode = 'LGL02';
  end if;

  if v_acao = 'vincular' then
    update public.legal_intimations set case_id = v_caso, status = 'vinculada' where id = v.id;
    return jsonb_build_object('status', 'vinculada');
  end if;

  if v_acao = 'criar_prazo' then
    if v_due is null then
      raise exception 'Informe a data do prazo.' using errcode = 'LGL02';
    end if;
    if v_interno is not null and v_interno > v_due then
      raise exception 'O dia interno precisa ser antes do prazo fatal.' using errcode = 'LGL02';
    end if;
    select * into v_sug from public.legal_intimation_suggestions s
      where s.intimation_id = v.id and s.suggested_due_on is not null order by s.created_at desc limit 1;
    -- quem é de estágio cria, mas o prazo nasce sem confirmação: a advocacia ou a direção confirma
    select coalesce(pr.legal_role = 'estagio', false) into v_estagio
      from public.professionals pr where pr.tenant_id = v.tenant_id and pr.user_id = auth.uid() limit 1;
    insert into public.legal_deadlines (
      tenant_id, client_id, case_id, kind, title, due_on, internal_due_on, source, intimation_id,
      calc_memo, calc_rule_version, suggested_due_on, calc_divergence, responsible_professional_id,
      confirmed_by, confirmed_at, created_by)
    values (
      v.tenant_id, v_cliente, v_caso, 'fatal', v_titulo, v_due, v_interno, 'djen', v.id,
      v_sug.calc_memo, v_sug.calc_rule_version, v_sug.suggested_due_on,
      case when v_sug.id is null then null else v_sug.suggested_due_on is distinct from v_due end,
      v_responsavel,
      case when coalesce(v_estagio, false) then null else auth.uid() end,
      case when coalesce(v_estagio, false) then null else now() end,
      auth.uid())
    returning id into v_prazo;
    update public.legal_intimations
       set case_id = v_caso, status = 'prazo_criado', triaged_by = auth.uid(), triaged_at = now(), reason = v_motivo
     where id = v.id;
    return jsonb_build_object('status', 'prazo_criado', 'deadline_id', v_prazo, 'confirmado', not coalesce(v_estagio, false));
  end if;

  update public.legal_intimations
     set case_id = v_caso, status = case v_acao when 'sem_prazo' then 'sem_prazo' else 'descartada' end,
         triaged_by = auth.uid(), triaged_at = now(), reason = v_motivo
   where id = v.id;
  return jsonb_build_object('status', case v_acao when 'sem_prazo' then 'sem_prazo' else 'descartada' end);
end $$;

revoke all on function public.legal_intimacao_decidir(jsonb) from public, anon;
grant execute on function public.legal_intimacao_decidir(jsonb) to authenticated;

insert into supabase_migrations.schema_migrations (version, name) values ('0112', 'legal_intimacao_decidir') on conflict do nothing;
commit;

-- ===== 0113_legal_captura_grava_o_formato_do_nucleo.sql =====
begin;

-- docs/101 T4.1: a gravação da captura passa a ler o corpo que o núcleo MONTA (`corpoDaRpc` em
-- core/advocacia/intimacoes.ts, portado do LUBI com teste próprio).
--
-- O defeito da 0109: a função lia `texto`, `cancelado_em` e `motivo_cancelamento`, e o núcleo manda
-- `texto_sanitizado`, `cancelled_at` e `cancel_reason`. Toda intimação real cairia no `not null` do texto,
-- e o dia ficaria sem gravar. Achado ao escrever a captura, antes de qualquer chamada real.
--
-- Também: o `ok` e o `detalhe` do chamador (itens recusados por formato, de outro alvo, repetidos) passam
-- a valer junto com a contagem; e a SUGESTÃO de prazo de cada item novo (calculada no servidor por
-- `sugerirPrazo`) é gravada na mesma transação, só quando a intimação nasce (recaptura não duplica).
create or replace function public.legal_intimacoes_gravar(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_tenant uuid := (p->>'tenant_id')::uuid;
  v_item jsonb;
  v_novas int := 0;
  v_vinculadas int := 0;
  v_id uuid;
  v_inserida boolean;
  v_caso uuid;
  v_gravadas int;
  v_ok boolean;
  v_detalhe text;
begin
  for v_item in select * from jsonb_array_elements(coalesce(p->'itens', '[]'::jsonb)) loop
    select c.id into v_caso from public.legal_cases c
     where c.tenant_id = v_tenant and c.cnj_number = v_item->>'numero_processo' and c.archived_at is null
     order by c.created_at limit 1;
    insert into public.legal_intimations (tenant_id, djen_id, hash, numero_processo, data_disponibilizacao, tribunal, orgao, tipo,
                                          classe, texto_sanitizado, link, destinatarios, alvo, case_id, status, cancelled_at, cancel_reason)
    values (v_tenant, (v_item->>'djen_id')::bigint, v_item->>'hash', v_item->>'numero_processo', (v_item->>'data_disponibilizacao')::date,
            v_item->>'tribunal', v_item->>'orgao', v_item->>'tipo', v_item->>'classe', v_item->>'texto_sanitizado', v_item->>'link',
            coalesce(v_item->'destinatarios', '[]'::jsonb), p->>'alvo', v_caso,
            case when v_caso is null then 'nova' else 'vinculada' end,
            (v_item->>'cancelled_at')::timestamptz, v_item->>'cancel_reason')
    on conflict (tenant_id, djen_id) do update
       set cancelled_at = coalesce(public.legal_intimations.cancelled_at, excluded.cancelled_at),
           cancel_reason = coalesce(public.legal_intimations.cancel_reason, excluded.cancel_reason)
    returning id, (xmax = 0) into v_id, v_inserida;

    if v_inserida then
      v_novas := v_novas + 1;
      if v_caso is not null then v_vinculadas := v_vinculadas + 1; end if;
      if v_item ? 'sugestao' then
        insert into public.legal_intimation_suggestions
          (tenant_id, intimation_id, suggested_due_on, internal_due_on, calc_memo, calc_rule_version, sem_sugestao)
        values (v_tenant, v_id,
                (v_item->'sugestao'->>'suggested_due_on')::date, (v_item->'sugestao'->>'internal_due_on')::date,
                v_item->'sugestao'->'calc_memo', v_item->'sugestao'->>'calc_rule_version',
                left(v_item->'sugestao'->>'sem_sugestao', 300));
      end if;
    end if;
  end loop;

  select count(*) into v_gravadas from public.legal_intimations
   where tenant_id = v_tenant and alvo = p->>'alvo' and data_disponibilizacao = (p->>'dia')::date;
  v_ok := coalesce((p->>'ok')::boolean, true) and v_gravadas >= (p->>'count_fonte')::int;
  v_detalhe := left(concat_ws('; ',
    nullif(p->>'detalhe', ''),
    case when v_gravadas < (p->>'count_fonte')::int then format('gravadas %s de %s', v_gravadas, p->>'count_fonte') end), 300);
  insert into public.legal_intimation_sync (tenant_id, alvo, dia, count_fonte, count_gravado, ok, detalhe)
  values (v_tenant, p->>'alvo', (p->>'dia')::date, (p->>'count_fonte')::int, v_gravadas, v_ok, nullif(v_detalhe, ''))
  on conflict (tenant_id, alvo, dia) do update
     set count_fonte = excluded.count_fonte, count_gravado = excluded.count_gravado, ok = excluded.ok, detalhe = excluded.detalhe,
         updated_at = now();
  return jsonb_build_object('novas', v_novas, 'vinculadas', v_vinculadas, 'gravadas_no_dia', v_gravadas, 'ok', v_ok);
end $$;
revoke all on function public.legal_intimacoes_gravar(jsonb) from public, anon, authenticated;
grant execute on function public.legal_intimacoes_gravar(jsonb) to service_role;

-- Falha de rede ou de formato num dia: o dia fica VERMELHO com o motivo, sem apagar o que já foi gravado
-- (um "ok" de ontem não vira falso por uma consulta de hoje que caiu). Só o servidor chama.
create or replace function public.legal_intimacoes_falha(p jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.legal_intimation_sync (tenant_id, alvo, dia, count_fonte, count_gravado, ok, detalhe)
  values ((p->>'tenant_id')::uuid, p->>'alvo', (p->>'dia')::date, 0,
          (select count(*) from public.legal_intimations i
            where i.tenant_id = (p->>'tenant_id')::uuid and i.alvo = p->>'alvo' and i.data_disponibilizacao = (p->>'dia')::date),
          false, left(p->>'detalhe', 300))
  on conflict (tenant_id, alvo, dia) do update set ok = false, detalhe = excluded.detalhe, updated_at = now();
end $$;
revoke all on function public.legal_intimacoes_falha(jsonb) from public, anon, authenticated;
grant execute on function public.legal_intimacoes_falha(jsonb) to service_role;

insert into supabase_migrations.schema_migrations (version, name) values ('0113', 'legal_captura_grava_o_formato_do_nucleo') on conflict do nothing;
commit;

-- ===== 0114_legal_prazo_confirmacao_so_advocacia.sql =====
begin;

-- docs/101 T4: quem é de estágio cria prazo, mas não confirma (0109 já tira a confirmação no INSERT). A
-- recusa no UPDATE morava só no serviço (`server/advocacia/prazos.ts`); pela API do Supabase, com o token
-- da própria pessoa, um UPDATE direto em `confirmed_by` passaria. A trava vai para o banco, mesmo desenho
-- da 0110 (rascunho), com código próprio para o servidor traduzir sem confundir com a RLS (42501).
create or replace function public.legal_prazo_confirmacao_so_advocacia()
returns trigger language plpgsql set search_path = public as $$
declare
  v_estagio boolean;
begin
  if old.confirmed_by is null and new.confirmed_by is not null and current_user = 'authenticated' then
    select coalesce(p.legal_role = 'estagio', false) into v_estagio
      from public.professionals p where p.tenant_id = new.tenant_id and p.user_id = auth.uid() limit 1;
    if coalesce(v_estagio, false) then
      raise exception 'Quem é de estágio não confirma prazo: peça à advocacia.' using errcode = 'LGL01';
    end if;
  end if;
  return new;
end $$;

create trigger legal_deadlines_confirmacao before update on public.legal_deadlines
  for each row execute function public.legal_prazo_confirmacao_so_advocacia();

insert into supabase_migrations.schema_migrations (version, name) values ('0114', 'legal_prazo_confirmacao_so_advocacia') on conflict do nothing;
commit;

-- ===== 0115_legal_privilegios_minimos.sql =====
begin;

-- docs/101 T1.10: privilégio mínimo nas tabelas do pacote Advocacia (defesa em profundidade).
--
-- O padrão do Supabase dá a `anon` e `authenticated` TODOS os privilégios de tabela (inclusive DELETE e
-- TRUNCATE), e quem barra é a RLS. Até aqui, o que impedia apagar uma linha jurídica era só a AUSÊNCIA de
-- política de DELETE: uma política escrita por engano amanhã abriria a porta. E TRUNCATE não passa pela
-- RLS: a PostgREST não o expõe, mas o privilégio não tem por que existir.
--
-- Depois desta migration:
--  * `anon` não tem nada nas tabelas jurídicas (nenhuma tela pública lê dado de escritório);
--  * `authenticated` não apaga nem trunca nenhuma; nada no pacote se apaga (estado, nunca DELETE);
--  * as tabelas que só o servidor ou um gatilho grava (trilha, histórico do prazo, alertas, captura,
--    sugestão) ficam só de leitura para `authenticated`; quem grava é `service_role` ou função definer.
do $$
declare
  t text;
  tabelas text[] := array[
    'legal_access_log', 'legal_case_meetings', 'legal_case_members', 'legal_cases', 'legal_checklist_items',
    'legal_checklist_template_items', 'legal_checklist_templates', 'legal_corporate_changes', 'legal_deadline_alerts',
    'legal_deadline_changes', 'legal_deadlines', 'legal_document_links', 'legal_document_versions', 'legal_documents',
    'legal_entities', 'legal_holidays', 'legal_intimation_suggestions', 'legal_intimation_sync', 'legal_intimations',
    'legal_ownerships', 'legal_persons'];
  so_servidor text[] := array[
    'legal_access_log', 'legal_deadline_changes', 'legal_deadline_alerts', 'legal_intimation_sync',
    'legal_intimation_suggestions'];
begin
  foreach t in array tabelas loop
    execute format('revoke all on public.%I from anon', t);
    execute format('revoke delete, truncate on public.%I from authenticated', t);
  end loop;
  foreach t in array so_servidor loop
    execute format('revoke insert, update on public.%I from authenticated', t);
  end loop;
end $$;

insert into supabase_migrations.schema_migrations (version, name) values ('0115', 'legal_privilegios_minimos') on conflict do nothing;
commit;

-- ===== 0116_legal_membros_sem_segundo_fator.sql =====
begin;

-- docs/101 §15: o `/api/health` acusa (amarelo) escritório do pacote Advocacia com membro ativo sem segundo
-- fator verificado há mais de N dias. O pacote exige aal2 em toda tela (0102); membro sem fator não entra,
-- e o escritório costuma descobrir no dia do prazo.
--
-- `auth.mfa_factors` não passa pela PostgREST, então a leitura é uma função definer que devolve só
-- contagem por tenant (nenhum e-mail, nenhum id de usuário). Executável apenas pela `service_role`: é o
-- cliente do health (`withNovoTenant`), e nenhum usuário precisa disso.
create or replace function public.legal_membros_sem_segundo_fator(p_dias int default 7)
returns table (tenant_id uuid, sem_fator int)
language sql stable security definer set search_path = public, auth as $$
  select m.tenant_id, count(*)::int
  from public.memberships m
  join public.tenants t on t.id = m.tenant_id
  join public.professions p on p.id = t.profession_id
  where p.pacote = 'advocacia'
    and m.active
    and m.created_at < now() - make_interval(days => greatest(p_dias, 0))
    and not exists (select 1 from auth.mfa_factors f where f.user_id = m.user_id and f.status = 'verified')
  group by m.tenant_id
$$;

revoke all on function public.legal_membros_sem_segundo_fator(int) from public, anon, authenticated;
grant execute on function public.legal_membros_sem_segundo_fator(int) to service_role;

insert into supabase_migrations.schema_migrations (version, name) values ('0116', 'legal_membros_sem_segundo_fator') on conflict do nothing;
commit;

