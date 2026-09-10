-- =====================================================================
-- CICLO · RLS: recorta `cycle_predictions` e `package_uses` nas operações que o
--          app de fato faz (migration 0081) — lote 2.1 do `docs/57`
--
-- Mesma régua da `0080`: **a capacidade é comprovadamente morta?** Nenhum caminho
-- do app usa. Tirar capacidade morta não tem como quebrar nada — `delete`/`update`
-- barrado por RLS devolve zero linhas em silêncio, então só entra o que a análise
-- de chamador prova seguro.
--
-- A `0001:688-709` aplica `for all using (has_tenant(tenant_id))` a 25 tabelas.
-- A `0073`/`0075`/`0080` já recortaram `tickets`, `ticket_items`, `professionals`,
-- `services`, `products`, `commissions`, `payments`, `stock_moves`, `appointments`.
-- Estas duas são o lote seguinte, e são as mais fáceis de defender.
--
-- ## `cycle_predictions` — leitura por tenant, escrita só do Motor
--
-- Medido em 2026-09-09 (`grep -rn "from('cycle_predictions')" src`):
--   - ESCRITA: `registrarPrevisoes` (upsert) e `resolverPrevisoes` (update) em
--     `server/services/previsao.ts`. Os DOIS chamadores — `api/cron/recompute-cycles`
--     e `api/v1/cycles/recompute` — usam `withNovoTenant` (service_role), que passa
--     por cima da RLS. Nenhuma escrita pelo cliente do usuário.
--   - LEITURA: `prestacaoDeContasDoMotor`, chamada por `admin/mes/page.tsx` e
--     `admin/recuperar/page.tsx` (Server Components, cliente do usuário). Essa
--     precisa de SELECT.
--
-- Então: SELECT por `has_tenant`, e nada mais. É o desenho append-only que a `0064`
-- já documentou no cabeçalho ("a linha é escrita UMA vez... e nunca mais muda"),
-- agora com a RLS concordando — um membro que chamasse o PostgREST direto não
-- reescreve nem apaga previsão.
--
-- ## `package_uses` — leitura e inserção, sem update/delete
--
-- Medido: a ÚNICA operação no `src/` é `db.from('package_uses').insert(...)` em
-- `consumirSessao` (`server/services/pacotes.ts`), chamada por
-- `POST /api/v1/packages/[id]/use` com o cliente do usuário (`comanda:own`). Zero
-- `update`, zero `delete`, zero leitura pelo app. O consumo de sessão é
-- append-only por natureza — desfazer é movimento compensatório, não `DELETE`
-- (mesma lógica de `stock_moves` e da inviolável nº 11).
--
-- SELECT fica em `has_tenant` também: não custa nada, e a hora que alguma tela
-- listar "as sessões que a cliente usou" ela já funciona.
-- =====================================================================

-- ── cycle_predictions ────────────────────────────────────────────────
drop policy if exists cycle_predictions_tenant_all on public.cycle_predictions;

create policy cycle_predictions_select on public.cycle_predictions
  for select using (public.has_tenant(tenant_id));

-- Sem INSERT/UPDATE/DELETE: com RLS forçada, ausência de política é negação. As
-- escritas do Motor passam por `service_role`, que ignora a RLS. É o mesmo
-- desenho de `audit_log`.

-- ── package_uses ─────────────────────────────────────────────────────
drop policy if exists package_uses_tenant_all on public.package_uses;

create policy package_uses_select on public.package_uses
  for select using (public.has_tenant(tenant_id));

create policy package_uses_insert on public.package_uses
  for insert with check (public.has_tenant(tenant_id));

-- Sem UPDATE/DELETE: nenhum caminho do app os usa, e consumo de sessão não se
-- desfaz apagando a linha.
