-- CICLO · BL-46 (`.claude/ciclo/autonomous-backlog.md`) — RPC em lote para fechar previsões
--
-- Medido em 2026-09-27 (`tests/integration/ciclo.test.ts`, `'resolverPrevisoes isolado'`): o laço
-- por linha de `resolverPrevisoes` (`server/services/previsao.ts`) leva 17,6ms por previsão — 5 mil
-- previsões abertas levam 87,8s para fechar. Um tenant com ~3.400 previsões fechando no mesmo dia
-- (ex.: depois de uma campanha de recuperação bem-sucedida trazendo muita gente de volta na mesma
-- semana) já estouraria o teto de 60s que o job inteiro promete.
--
-- A parte cara não é DECIDIR quem fechou — isso continua em TypeScript, em memória, contra o
-- `historicoPorCombinacao` que o recálculo já montou (mudar isso para SQL duplicaria a regra "a
-- primeira visita ESTRITAMENTE depois da que originou a previsão" num segundo lugar, a mesma
-- armadilha de "duas cópias da mesma fórmula" já registrada nesta base). A parte cara é a IDA DE
-- REDE: uma por linha. Esta função troca N idas por 1, recebendo o lote já decidido.
--
-- ## Por que `security invoker` (o padrão da casa, não o mais conveniente)
--
-- Mesmo raciocínio da `0034` (`debitar_carteira`): esta função só precisa do privilégio de quem
-- chama. `resolverPrevisoes` roda sempre com `service_role` (dentro do job noturno e das duas
-- portas de "quem já atendo"/importação, nunca por uma rota de usuário direto) — `service_role`
-- ignora RLS por desenho (`BYPASSRLS`), então `security invoker` não abre mão de proteção nenhuma
-- aqui e ainda deixa a política `cycle_predictions_tenant_all` (`0064`) como a última linha de
-- defesa, caso um dia alguém chame isto fora do caminho de hoje.
--
-- ## Por que a trava (`resolved_at is null`) continua dentro do `UPDATE`, não some
--
-- É o CAS (compare-and-swap) que já existia por linha: duas execuções simultâneas do job (corrida
-- real, não hipotética — dois cron disparando perto um do outro, ou o recálculo síncrono de
-- `concluirAgendamento` correndo junto do noturno) só podem fechar cada previsão UMA vez. Um
-- `UPDATE ... WHERE id = ANY(...)` simples, sem a condição, perderia essa garantia — é exatamente o
-- erro que o achado original do BL-46 avisava para não cometer.
create or replace function public.resolver_previsoes_em_lote(p_tenant_id uuid, p_atualizacoes jsonb)
returns int
language plpgsql
volatile
set search_path = public
as $$
declare
  v_agora timestamptz := now();
  v_count int;
begin
  with entrada as (
    select
      (elem->>'id')::uuid as id,
      (elem->>'actual_return_on')::date as actual_return_on
    from jsonb_array_elements(p_atualizacoes) as elem
  )
  update public.cycle_predictions cp
  set actual_return_on = entrada.actual_return_on,
      resolved_at = v_agora
  from entrada
  where cp.id = entrada.id
    and cp.tenant_id = p_tenant_id
    and cp.resolved_at is null;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

comment on function public.resolver_previsoes_em_lote(uuid, jsonb) is
  'Fecha em UMA ida de rede as previsões já decididas em memória (server/services/previsao.ts). p_atualizacoes é um array de {id, actual_return_on}; devolve quantas linhas realmente mudaram (a trava resolved_at is null continua por linha, para duas execuções simultâneas não contarem a mesma duas vezes). BL-46.';

-- Privilégio mínimo: nenhuma rota de usuário chama isto, só o caminho de `service_role`.
revoke execute on function public.resolver_previsoes_em_lote(uuid, jsonb) from public, anon, authenticated;
grant  execute on function public.resolver_previsoes_em_lote(uuid, jsonb) to service_role;
