-- CICLO · a fila de recuperação passa a ser ordenada por LUCRO, não por receita
--
-- ## O que muda, e por que não é a mesma coisa
--
-- `client_cycles.value_at_risk_cents` é `preço × probabilidade de voltar` (`core/cycle/valor-em-risco.ts`).
-- É a receita parada — o número que a tela "Recuperar receita" soma e mostra, e que ordena a fila.
--
-- O `docs/48` C3 pede outra ordem: *"quem sumiu, quanto essa pessoa deixa de LUCRO por ano, e
-- quanto custa trazê-la de volta"*. E a diferença não é cosmética. Um serviço de R$ 200 com 60% de
-- comissão e R$ 30 de produto deixa R$ 50 para o salão; um de R$ 80 sem comissão e sem insumo deixa
-- R$ 80. Ordenar por receita põe o primeiro no topo da lista de quem chamar — e o dono gasta o
-- WhatsApp do dia com quem vale menos.
--
-- Isso só passou a ser calculável agora: até a `0066`/`I-02` o material valia zero para todo
-- serviço de todo tenant, e a comissão vivia só congelada em comandas já fechadas.
--
-- ## Por que uma coluna NOVA, e não a substituição da antiga
--
-- Mesmo motivo da `0065` (`cycle_days_observado` ao lado de `cycle_days`): as duas respondem
-- perguntas diferentes e as duas continuam sendo feitas. "Quanto de receita está parado" é o número
-- que a tela inicial anuncia; "quanto de lucro vale chamar" é o que ordena a fila. Sobrescrever
-- faria o total anunciado encolher da noite para o dia, sem explicação, na cara de quem paga.
--
-- ## O que NÃO entra na conta, e é dito de propósito
--
-- A taxa da maquininha. Ela depende da forma de pagamento, que numa visita FUTURA ninguém sabe —
-- e escolher uma média seria inventar. O lucro esperado fica, portanto, um pouco otimista, do
-- tamanho de uma taxa de cartão. Vale para todas as linhas igualmente, então a ORDEM, que é o que
-- este número existe para decidir, não muda por causa disso.

alter table client_cycles
  add column profit_at_risk_cents bigint not null default 0;

comment on column client_cycles.value_at_risk_cents is
  'Receita parada: preço do serviço × probabilidade de voltar. É o número que a tela inicial anuncia.';
comment on column client_cycles.profit_at_risk_cents is
  'Lucro parado: (preço − comissão − material) × probabilidade de voltar. É o número que ORDENA a fila de recuperação. Sem a taxa da maquininha, que depende da forma de pagamento de uma visita que ainda não aconteceu. Ver docs/48 C3.';

-- Espelha o índice que já existe para `value_at_risk_cents`: a fila passa a ser lida por esta
-- coluna, e sem o índice a ordenação vira varredura na tabela mais quente do Motor.
create index client_cycles_lucro_em_risco_idx
  on client_cycles (tenant_id, state, profit_at_risk_cents desc);

-- A view que a tela lê precisa expor a coluna nova, senão o número existe e não chega em lugar
-- nenhum — a mesma classe de defeito que este documento inteiro persegue.
--
-- `security_invoker = true` é OBRIGATÓRIO e está aqui de novo de propósito: `create or replace
-- view` NÃO herda as opções da definição anterior. Sem repetir, a view voltaria a rodar com os
-- privilégios do dono e furaria a RLS de `client_cycles` — a armadilha nomeada no `CLAUDE.md`.
create or replace view v_recover_revenue with (security_invoker = true) as
select
  cc.tenant_id,
  cc.client_id,
  c.name        as client_name,
  c.phone_e164,
  cc.service_id,
  s.name        as service_name,
  cc.state,
  cc.late_days,
  cc.predicted_on,
  cc.value_at_risk_cents,
  cc.last_campaign_at,
  -- A coluna nova vai NO FIM, e isso não é gosto: `create or replace view` só aceita colunas
  -- ACRESCENTADAS ao final. Inserir no meio (aqui, antes de `last_campaign_at`) devolve
  -- `ERROR: cannot change name of view column "last_campaign_at" to "profit_at_risk_cents"
  -- (SQLSTATE 42P16)` — o Postgres compara posição por posição e lê a inserção como renomeação.
  -- A alternativa seria `drop view` + `create view`, que derruba quem depende dela.
  cc.profit_at_risk_cents
from client_cycles cc
join clients  c on c.id = cc.client_id and c.deleted_at is null
join services s on s.id = cc.service_id
where cc.state in ('due','late','at_risk','lost')
-- A ordem de saída da view deixa de ser a da tela: quem decide é `quemRecuperar`, com o lucro.
-- Mantida por receita aqui só para não mudar o contrato de quem lê a view direto.
order by cc.value_at_risk_cents desc;
