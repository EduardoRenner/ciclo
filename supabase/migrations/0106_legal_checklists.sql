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
