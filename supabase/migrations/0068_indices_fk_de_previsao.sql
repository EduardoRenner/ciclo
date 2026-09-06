-- CICLO · as duas chaves estrangeiras que a `0064` deixou sem índice
--
-- A guarda `tests/rls/indices-fk.test.ts` reprovou a `0064` na CI e estava certa:
-- `cycle_predictions` tem FK para `clients` e para `services`, e nenhum dos dois índices criados
-- lá cobre essas colunas **pelo prefixo**:
--
--   · `cycle_predictions_calibracao_idx` é `(tenant_id, service_id, resolved_at)` — `service_id`
--     não é o começo, e o índice ainda é PARCIAL (`where resolved_at is not null`), então o
--     planejador não pode usá-lo para uma busca que não filtre por essa condição;
--   · `cycle_predictions_abertas_idx` é `(tenant_id, client_id, service_id)`, parcial pelo lado
--     oposto (`where resolved_at is null`). Mesmo problema, duas vezes.
--
-- O mecanismo de `on delete cascade` do Postgres busca a tabela filha **só pela coluna da FK**.
-- Sem índice com essa coluna no começo, apagar uma cliente varre `cycle_predictions` inteira — e
-- esta tabela é append-only, uma linha por visita, então ela é a que mais cresce no produto.
--
-- Foi exatamente assim que a `0021` nasceu: apagar um tenant com 10 mil clientes travava em
-- `statement timeout`. A diferença é que agora existe guarda, e ela pegou antes de doer.
--
-- Sem `tenant_id`: a FK para `tenants` já é coberta pelo prefixo de
-- `cycle_predictions_calibracao_idx`... que é parcial. Ver a nota abaixo.

create index cycle_predictions_client_fk_idx  on cycle_predictions (client_id);
create index cycle_predictions_service_fk_idx on cycle_predictions (service_id);

-- `tenant_id` é a única das três que a guarda não acusou, e o motivo é o `unique` da tabela:
-- `cycle_predictions_uma_por_visita (tenant_id, client_id, service_id, last_visit_on)` é um índice
-- TOTAL com `tenant_id` no começo. As outras duas não tinham equivalente.
