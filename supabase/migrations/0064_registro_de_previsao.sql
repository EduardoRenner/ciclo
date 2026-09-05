-- CICLO · o Motor passa a guardar o que previu, ANTES de saber o resultado
--
-- ## Por que esta tabela existe (docs/45 e docs/46)
--
-- `client_cycles` é upsert por `(tenant_id, client_id, service_id)`: a cada execução do
-- `recompute-cycles`, `predicted_on` é sobrescrito e a previsão anterior some. Não existe, em
-- nenhum lugar do repositório, registro do que o Motor disse antes de o resultado acontecer.
--
-- Isso é jogar fora o único ativo do produto que o tempo protege. A pesquisa do `45` mediu:
--
-- - `personal_cycle_days`, `predicted_on`, `state`, `value_at_risk_cents` **parecem** fosso e não
--   são — um concorrente com anos de histórico de agendamento parado deriva os quatro em batch;
-- - **previsão confrontada com o que aconteceu depois NÃO é reconstruível**, porque previsão feita
--   depois do fato não é previsão. Nem 12 anos de histórico bruto produzem essa série.
--
-- E o `46` §Fase 3 reformulou qual poder é esse, depois de o red team quase derrubar a ideia: não é
-- efeito de rede (nesse campo o líder vence por volume, por definição), é **custo de troca por
-- salão**. Cadência é por pessoa dentro de um salão; quem chega amanhã tem zero para AQUELE salão,
-- mesmo com dado de mil outros.
--
-- ## O grão: uma linha por VISITA, não por dia
--
-- A chave natural é `(tenant, cliente, serviço, last_visit_on)` — "depois desta visita, quando o
-- Motor esperava a pessoa de volta?". O `recompute-cycles` roda todo dia; sem essa unicidade, cada
-- cliente geraria 365 linhas idênticas por ano. Com ela, o job diário é idempotente: `on conflict
-- do nothing` e pronto.
--
-- E a unicidade é o que torna a série honesta: a linha é escrita UMA vez, na primeira vez que o
-- Motor viu aquela visita, e nunca mais muda. Reescrever a previsão depois seria a mesma coisa que
-- não registrar nada.
--
-- ## `algo_version`, e por que ela não é zelo excessivo
--
-- Se `computeCycle` mudar, comparar previsão velha com nova é comparar coisas diferentes, e a
-- série vira lixo silencioso na primeira melhoria do Motor — a classe de defeito que esta base
-- persegue. A versão fica gravada em cada linha, para que qualquer análise possa separar as eras.
--
-- ## O que NÃO tem aqui
--
-- Nada de dado de saúde, nada de conteúdo de mensagem, nada que cruze tenant. São datas e inteiros
-- do próprio estabelecimento.

create table cycle_predictions (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references tenants(id) on delete cascade,
  client_id           uuid not null references clients(id) on delete cascade,
  service_id          uuid not null references services(id) on delete cascade,

  -- A visita que originou a previsão. É parte da chave: uma previsão por visita.
  last_visit_on       date not null,

  -- O que o Motor disse, e quando disse.
  predicted_on        date not null,
  predicted_at        timestamptz not null default now(),
  personal_cycle_days int not null check (personal_cycle_days > 0),
  -- O palpite do serviço na época. Guardado junto porque é ele que a calibração corrige — sem
  -- isso, não dá para saber depois se o erro veio do padrão ou do histórico da pessoa.
  default_cycle_days  int not null check (default_cycle_days > 0),
  algo_version        int not null,

  -- Preenchidos quando o resultado passa a ser conhecido. Nulos = ainda em aberto.
  actual_return_on    date,
  resolved_at         timestamptz,

  constraint cycle_predictions_uma_por_visita unique (tenant_id, client_id, service_id, last_visit_on),
  -- Resultado antes da previsão é dado corrompido, não cliente pontual.
  constraint cycle_predictions_retorno_depois_da_visita check (actual_return_on is null or actual_return_on >= last_visit_on)
);

-- A consulta da calibração: por serviço, as previsões já resolvidas.
create index cycle_predictions_calibracao_idx
  on cycle_predictions (tenant_id, service_id, resolved_at)
  where resolved_at is not null;

-- A consulta da resolução: por cliente/serviço, as ainda em aberto.
create index cycle_predictions_abertas_idx
  on cycle_predictions (tenant_id, client_id, service_id)
  where resolved_at is null;

alter table cycle_predictions enable row level security;
alter table cycle_predictions force row level security;

-- Mesmo padrão-blanket da 0001 (`tenant_tables`): a tabela não tem trava por papel além do que a
-- rota já confere, e nada aqui é público.
create policy cycle_predictions_tenant_all on cycle_predictions
  for all
  using (public.has_tenant(tenant_id))
  with check (public.has_tenant(tenant_id));

comment on table cycle_predictions is
  'Append-only: o que o Motor de Ciclo previu, na data em que previu, antes de o resultado ser conhecido. Uma linha por visita. Ver docs/46.';
comment on column cycle_predictions.algo_version is
  'Versão de computeCycle que produziu a previsão. Sem ela, a série mistura eras do algoritmo e vira lixo silencioso.';
