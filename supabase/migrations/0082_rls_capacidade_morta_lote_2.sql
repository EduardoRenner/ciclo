-- =====================================================================
-- CICLO · RLS: `client_cycles`, `loyalty_entries` e `monthly_profit` param de
--          aceitar DELETE (e UPDATE onde ninguém faz) — lote 2.2 do `docs/57`
--
-- Mesma régua da `0080`/`0081`: só entra o que a análise de chamador prova morto.
-- `delete`/`update` barrado por RLS devolve zero linhas em silêncio, então nada
-- de SELECT/INSERT muda aqui — o risco de quebra é zero.
--
-- Medido em 2026-09-09 (`grep -rn "from('<tabela>')" src`):
--
-- ## `client_cycles` — SELECT + INSERT + UPDATE, sem DELETE
--
-- É a tabela mais quente do Motor: `upsert` (insert+update) em `ciclo.ts`, pelos
-- dois caminhos. `recomputarCiclosDoTenant` roda em `service_role` (cron + rota
-- de admin), mas `recomputarCicloDeUmAtendimento` roda pelo **cliente do
-- usuário** (`POST /api/v1/appointments/[id]/complete` → `concluirAgendamento`).
-- Então INSERT e UPDATE ficam — o upsert precisa dos dois. Só DELETE sai: nenhum
-- caminho do app apaga ciclo (o único `.delete()` está num seed, em service_role),
-- e se sumisse o Motor reconstrói na passada seguinte de qualquer forma.
--
-- ## `loyalty_entries` — SELECT + INSERT, sem UPDATE/DELETE
--
-- Livro-razão de pontos. Único par de operações no `src/`: `.select` (o extrato,
-- mostrado no cartão da cliente para qualquer papel operacional) e `.insert`
-- (`lancarPontos`, via `POST /api/v1/clients/[id]/loyalty`, cliente do usuário).
-- Ponto é resgatável — é dinheiro. Resgate é lançamento NEGATIVO, nunca edição de
-- linha; estorno seria lançamento compensatório. Editar ou apagar um lançamento
-- é fraude, e nada no app precisa disso.
--
-- ## `monthly_profit` — INSERT + SELECT, sem UPDATE/DELETE
--
-- Fechamento mensal congelado, append-only por design (`0071`: "sem `updated_at`
-- e sem caminho de UPDATE no código"). O INSERT é o congelamento, feito pelo
-- cliente do usuário quando alguém abre `/admin/mes` depois do mês fechar —
-- `docs/DECISOES` (2026-09-09) já mediu que restringir esse INSERT por papel
-- pararia o congelamento em silêncio, então ele fica em `has_tenant`. UPDATE e
-- DELETE saem: a `0071` diz em todas as letras que a linha "nunca é reescrita".
--
-- O SELECT de `monthly_profit` NÃO é apertado aqui de propósito: profissional e
-- recepção o leem pelo PostgREST contra a intenção da guarda
-- `lucro-nao-vaza-para-quem-atende`, mas `/admin/mes` também lê pelo cliente do
-- usuário, e apertar o SELECT sem antes conferir quais papéis alcançam essa rota
-- deixaria a tela com histórico vazio para alguém. Fica para o lote 2.3, com a
-- matriz de papéis.
-- =====================================================================

-- ── client_cycles ───────────────────────────────────────────────────
drop policy if exists client_cycles_tenant_all on public.client_cycles;

create policy client_cycles_select on public.client_cycles
  for select using (public.has_tenant(tenant_id));
create policy client_cycles_insert on public.client_cycles
  for insert with check (public.has_tenant(tenant_id));
create policy client_cycles_update on public.client_cycles
  for update using (public.has_tenant(tenant_id)) with check (public.has_tenant(tenant_id));
-- sem DELETE

-- ── loyalty_entries ─────────────────────────────────────────────────
drop policy if exists loyalty_entries_tenant_all on public.loyalty_entries;

create policy loyalty_entries_select on public.loyalty_entries
  for select using (public.has_tenant(tenant_id));
create policy loyalty_entries_insert on public.loyalty_entries
  for insert with check (public.has_tenant(tenant_id));
-- sem UPDATE, sem DELETE

-- ── monthly_profit ──────────────────────────────────────────────────
drop policy if exists monthly_profit_tenant_all on public.monthly_profit;

create policy monthly_profit_select on public.monthly_profit
  for select using (public.has_tenant(tenant_id));
create policy monthly_profit_insert on public.monthly_profit
  for insert with check (public.has_tenant(tenant_id));
-- sem UPDATE, sem DELETE
