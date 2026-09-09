-- =====================================================================
-- CICLO · apagar um produto para de apagar o razão dele (migration 0079)
--
-- A inviolável nº 11 do CLAUDE.md: "Nunca delete agendamento, movimento de
-- estoque ou registro de auditoria. Use estado/compensação." A tabela de
-- armadilhas repete com estas palavras: "Deletar o movimento de estoque no
-- estorno → Gere movimento compensatório do tipo `return`."
--
-- E `stock_moves.product_id` estava `on delete cascade` desde a `0001`. Apagar
-- UM produto apagava o histórico inteiro de movimento dele — sem nenhum
-- `.delete()` no código, sem linha em `audit_log`, e sem deixar o movimento
-- compensatório que a regra manda usar no lugar. A regra existia em prosa e o
-- schema oferecia o caminho contrário.
--
-- Não é hipótese de laboratório. Medido em produção em 2026-09-09:
-- `authenticated` tem DELETE em `public.products`, e a política `products_delete`
-- da `0075` libera `owner` e `manager`. Com a anon key sendo `NEXT_PUBLIC_*`,
-- dono ou gerente apaga um produto falando direto com o PostgREST, e o razão
-- some junto. O estrago é silencioso e irreversível: `alertas-estoque` e
-- qualquer leitura de consumo passam a responder sobre um passado que mudou.
--
-- O app nunca precisou disso: `products` tem `deleted_at` e `active`, o modelo
-- da casa é apagar de mentira, e não existe rota `/api/v1/products` nenhuma.
-- Tirar o cascade não fecha porta de ninguém — só a que ninguém devia ter.
--
-- ## Por que `no action` e não `restrict`
--
-- Os dois recusam apagar o produto que ainda tem movimento. A diferença é
-- QUANDO a checagem acontece, e ela decide se o offboarding continua possível:
-- `restrict` confere na hora, `no action` confere no fim do comando.
--
-- Apagar um tenant dispara os dois cascades irmãos (`products.tenant_id` e
-- `stock_moves.tenant_id`) no mesmo comando, em ordem que o Postgres não
-- promete. Com `restrict`, apagar o produto antes do movimento estoura na hora e
-- o tenant não sai. Com `no action`, no fim do comando os movimentos já foram
-- junto e a checagem passa. `onboarding.ts:167` faz exatamente esse delete no
-- rollback de cadastro — hoje sobre tenant recém-criado e vazio, mas a diferença
-- entre as duas palavras é o que separa "protege o razão" de "trava a saída".
--
-- Ordem de implantação: esta é RESTRITIVA, e pela regra da casa a restritiva vai
-- DEPOIS do deploy do código. Aqui não há código a esperar — nenhuma linha do
-- app apaga produto —, então aplicar antes ou depois dá no mesmo.
-- =====================================================================

alter table public.stock_moves
  drop constraint stock_moves_product_id_fkey;

alter table public.stock_moves
  add constraint stock_moves_product_id_fkey
  foreign key (product_id) references public.products(id) on delete no action;
