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

