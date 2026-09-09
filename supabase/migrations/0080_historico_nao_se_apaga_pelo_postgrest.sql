-- =====================================================================
-- CICLO · a RLS passa a concordar com a inviolável nº 11 (migration 0080)
--
-- A `0079` fechou o caminho do CASCADE. Este fecha o caminho direto, que é mais
-- curto: falar com o PostgREST.
--
-- Medido em produção em 2026-09-09:
--
--   `stock_moves_tenant_all`  → `for all using (has_tenant(tenant_id))`
--   `appointments_delete`     → `using (has_tenant(...) and tenant_role(...) in ('owner','manager'))`
--
-- e `authenticated` tem GRANT de DELETE nas duas (`0038`). Ou seja: QUALQUER
-- membro ativo apagava movimento de estoque, e dono ou gerente apagava
-- agendamento — as duas coisas que a inviolável nº 11 nomeia com estas palavras:
-- "Nunca delete agendamento, movimento de estoque ou registro de auditoria. Use
-- estado/compensação."
--
-- `audit_log` e `vault_access_log`, as outras duas da regra, já estão certas: RLS
-- ligada e NENHUMA política, então nem leitura passa fora do service_role.
--
-- ## Por que estas duas e não as outras trinta e oito
--
-- A varredura achou 40 tabelas com política cega a papel. Estas duas entram
-- agora porque a capacidade que elas dão é **comprovadamente morta** — conferido
-- linha a linha no fonte:
--
--   * `stock_moves` recebe `select` e `insert`, nada mais (`estoque.ts:69,90,152`
--     e as três consultas de `alertas-estoque.ts`, todas leitura). O estorno já é
--     movimento compensatório `return`, como a tabela de armadilhas manda.
--   * `appointments` nunca é apagado. O `DELETE /api/v1/appointments/[id]` é
--     cancelamento — chama `cancelarAgendamento`, que faz UPDATE de estado — e o
--     erase da LGPD preserva a linha de propósito, com o vínculo técnico intacto
--     por obrigação fiscal (`TABELAS_APAGADAS` são outras três).
--
-- Tirar capacidade morta é o aperto mais seguro que existe: não há caminho para
-- quebrar. As outras 38 exigem escolher papéis, e escolher errado quebra o app
-- de um jeito que NÃO grita — `delete` barrado por RLS devolve zero linhas, não
-- erro. `health_records` é o exemplo vivo: o erase da LGPD apaga a ficha de saúde
-- com o cliente do USUÁRIO (`clients/[id]/erase/route.ts:23`), então apertar ali
-- às cegas transformaria "direito ao esquecimento" em `rowsRemoved: 0` com HTTP
-- 200. Fica registrado para quando houver banco de dev para verificar.
--
-- Insert e select seguem exatamente como estavam. Ninguém perde nada que use.
-- =====================================================================

-- ── agendamento: a única porta era esta, e ela não levava a lugar nenhum.
drop policy if exists appointments_delete on public.appointments;

-- ── movimento de estoque: o `for all` virava as quatro operações. Recorta nas
--    duas que o app realmente faz.
drop policy if exists stock_moves_tenant_all on public.stock_moves;

create policy stock_moves_select on public.stock_moves
  for select using (has_tenant(tenant_id));

create policy stock_moves_insert on public.stock_moves
  for insert with check (has_tenant(tenant_id));

-- Sem política de UPDATE e sem política de DELETE: com RLS forçada, ausência de
-- política é negação. É o mesmo desenho que já protege `audit_log`.
