-- O painel da carteira (`/admin/clientes`) calculava ticket médio e taxa de retorno trazendo
-- TODAS as linhas de `clients` do tenant para somar no Node. Num salão com 10 mil clientes isso
-- é 10 mil linhas por carregamento de tela, para exibir quatro números — e ainda esbarraria no
-- teto de 1000 linhas por `.select()` do PostgREST (a mesma armadilha do TICKET-036), devolvendo
-- média errada em silêncio a partir do milésimo cliente.
--
-- `security_invoker = true` é obrigatório: sem ele a view roda com o dono e fura a RLS,
-- entregando o resumo de todo mundo (armadilha registrada no CLAUDE.md).
create view v_carteira_resumo with (security_invoker = true) as
select
  tenant_id,
  count(*)                                                         as total,
  count(*) filter (where created_at >= date_trunc('month', now())) as novos_mes,
  count(*) filter (where visits_count > 1)                         as com_retorno,
  coalesce(sum(ltv_cents), 0)                                      as ltv_total,
  coalesce(sum(visits_count), 0)                                   as visitas_total
from clients
where deleted_at is null
group by tenant_id;
