-- CICLO · perfil e nota do cliente (docs/95 E3)
--
-- Uma linha por cliente com o resultado de `core/crm/nota-do-cliente.ts`: a nota (0 a 100), a
-- classe (Ouro, Prata, Bronze), o perfil (Fiel, Regular, Novo, Atrasado, Faltante, Sumido) e as
-- PARTES da conta, para a tela mostrar o porquê. Serve para ORDENAR a fila de chamadas do dono;
-- nunca para negar atendimento.
--
-- Estado atual, não histórico: o cálculo é diário e determinístico a partir de `appointments`,
-- `client_cycles` e `clients`, então guardar uma linha por dia só cresceria a tabela sem informação
-- nova. `algo_version` diz com que versão da conta a nota foi feita.
--
-- Escrita só pelo servidor (rotina diária, `service_role`): sem política de INSERT/UPDATE/DELETE,
-- e com RLS forçada a ausência de política é negação. Leitura por quem é do salão.
--
-- Aditiva: o código no ar não lê nem escreve. Sobe antes do deploy.

create table client_scores (
  tenant_id    uuid not null references tenants(id) on delete cascade,
  client_id    uuid not null references clients(id) on delete cascade,
  score        smallint not null check (score between 0 and 100),
  tier         text not null check (tier in ('ouro', 'prata', 'bronze')),
  profile      text not null check (profile in ('fiel', 'regular', 'novo', 'atrasado', 'faltante', 'sumido')),
  parts        jsonb not null default '[]'::jsonb,
  algo_version integer not null,
  computed_at  timestamptz not null default now(),
  primary key (tenant_id, client_id)
);

create index client_scores_tenant_score_idx on client_scores (tenant_id, score desc);
create index client_scores_client_id_idx on client_scores (client_id);

alter table client_scores enable row level security;
alter table client_scores force row level security;

create policy client_scores_select on client_scores
  for select using (public.has_tenant(tenant_id));

comment on table client_scores is
  'docs/95 E3: nota (0-100), classe e perfil de cada cliente, com as partes da conta. Estado atual, recalculado todo dia pelo servidor. Só ordena a fila do dono.';
