-- =====================================================================
-- CICLO · a carteira da cliente é livro-razão, e a RLS não sabia (migration 0083)
--
-- A `0080` fechou `stock_moves` com este mesmo raciocínio, e a `0081`/`0082`
-- fecharam as cinco tabelas append-only de capacidade morta. **`wallet_entries`
-- ficou de fora das três** — e é a única delas que guarda DINHEIRO da cliente.
--
-- Medido em 2026-09-10, contra o fonte inteiro (`src/`, `scripts/`, `supabase/`,
-- `tests/`):
--
--   `wallet_entries_tenant_all` → `for all using (has_tenant(tenant_id))`
--
-- e `authenticated` tem GRANT de UPDATE e DELETE (`0038`). Ou seja, hoje qualquer
-- membro ativo do tenant — `professional`, `reception`, qualquer um — pode falar
-- direto com o PostgREST e:
--
--   * `DELETE /rest/v1/wallet_entries?client_id=eq.<x>` — apagar o extrato de
--     crédito de uma cliente. O saldo é `sum(amount_cents)`: apagar os débitos
--     ressuscita dinheiro que já foi gasto; apagar os créditos evapora dinheiro
--     que a cliente pagou. Nos dois casos sem deixar rastro, porque o rastro ERA
--     a linha apagada.
--   * `PATCH` numa linha, trocando `amount_cents` — imprimir crédito do nada.
--
-- Isso contorna as duas travas que existem, e as duas foram construídas de
-- propósito: a `0034` (`debitar_carteira`) tornou o débito atômico justamente
-- para o saldo nunca ficar negativo, e a inviolável nº 11 do `CLAUDE.md` diz
-- "nunca delete ... registro de auditoria; use estado/compensação". Um livro-razão
-- em que a linha some não é livro-razão.
--
-- ## Por que é capacidade comprovadamente morta
--
-- Varredura do repositório inteiro por `wallet_entries` — não sobrou um único
-- `update` nem `delete`:
--
--   * `pacotes.ts:143`  — `select amount_cents` (o saldo é a SOMA das linhas).
--   * `pacotes.ts:150`  — `insert` (crédito: sinal virado crédito, cortesia).
--   * `0034` `debitar_carteira` — `insert` de linha negativa, dentro da transação
--     que trava a linha da cliente. É `security invoker`: a RLS de INSERT abaixo
--     continua valendo inteira para ela.
--   * `lgpd.ts:194`     — o mapa de redação registra `reason: 'preserva'`, e o
--     `eliminarCliente` **não toca** em `wallet_entries`: registro financeiro
--     fica, por obrigação de guarda. Não há UPDATE de anonimização a proteger.
--
-- Nenhuma tela, nenhuma rota, nenhum job, nenhum seed apaga ou altera uma linha
-- de carteira. Tirar as duas capacidades não quebra caminho nenhum — é o aperto
-- mais seguro que existe, igual ao da `0080`.
--
-- ## O que este arquivo NÃO faz
--
-- Não mexe em QUEM lê nem em QUEM credita. `select` e `insert` seguem em
-- `has_tenant(tenant_id)`, exatamente como estavam: recepção lançar cortesia e
-- profissional consultar saldo na comanda continuam funcionando igual. A régua
-- por papel dessas duas operações é decisão de produto e está no `docs/58`, com
-- as outras. Aqui só some o que ninguém usa e que só serve para destruir prova.
-- =====================================================================

drop policy if exists wallet_entries_tenant_all on public.wallet_entries;

create policy wallet_entries_select on public.wallet_entries
  for select using (has_tenant(tenant_id));

create policy wallet_entries_insert on public.wallet_entries
  for insert with check (has_tenant(tenant_id));

-- Sem política de UPDATE e sem política de DELETE: com RLS forçada, ausência de
-- política é negação. Mesmo desenho de `stock_moves` (0080), `cycle_predictions`
-- (0081) e `loyalty_entries` (0082) — e o mesmo de `audit_log`, que nunca teve
-- política nenhuma.
