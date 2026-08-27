-- Achado do advisor de performance do Supabase (multiple_permissive_policies), 27/08/2026.
-- `memberships_write` era `for all` — o que inclui SELECT — coexistindo com `memberships_select`,
-- que já cobre toda leitura permitida. Todo `select` em `memberships` pagava DUAS avaliações de
-- política em vez de uma: `has_tenant(tenant_id)` (memberships_select) OU
-- `tenant_role(tenant_id) = 'owner'` (memberships_write) — e as duas funções, por sua vez,
-- fazem cada uma sua própria subconsulta em `memberships`. `memberships` é a tabela que
-- `contextoAtual()` consulta em TODA requisição autenticada (docs/28-LATENCIA-DE-CLIQUE-PLANO.md).
--
-- A troca é segura porque é uma implicação lógica, não uma suposição: `tenant_role(tenant_id) =
-- 'owner'` só é verdadeiro quando existe uma membership ativa do usuário atual nesse tenant com
-- role='owner' — e isso já satisfaz `has_tenant(tenant_id)` (que só exige membership ativa,
-- qualquer role). Ou seja: toda linha que `memberships_write` deixava passar por SELECT já
-- passava por `memberships_select`. Restringir `memberships_write` para
-- insert/update/delete não tira visibilidade de ninguém — só para de pedir a mesma pergunta duas
-- vezes.
--
-- Verificado por `tests/rls/memberships-write-policy.test.ts`, com clientes autenticados de
-- verdade (não service_role): owner continua podendo inserir/atualizar/apagar; membro sem cargo
-- de dono continua bloqueado nas mesmas três operações; e a leitura (SELECT) continua idêntica
-- para os dois, porque `memberships_select` nunca mudou.

drop policy if exists memberships_write on memberships;

create policy memberships_insert on memberships for insert
  with check (public.tenant_role(tenant_id) = 'owner');

create policy memberships_update on memberships for update
  using (public.tenant_role(tenant_id) = 'owner')
  with check (public.tenant_role(tenant_id) = 'owner');

create policy memberships_delete on memberships for delete
  using (public.tenant_role(tenant_id) = 'owner');
