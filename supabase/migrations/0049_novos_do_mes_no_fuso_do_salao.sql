-- "Novos este mês" passa a contar o mês DO SALÃO, não o do servidor.
--
-- Mesmo defeito da 0048, na view vizinha: `date_trunc('month', now())` é avaliado no fuso da
-- SESSÃO, e a sessão do PostgREST é UTC (medido: `current_setting('TimeZone')` = 'UTC').
--
-- Em Brasília (UTC-3), uma cliente cadastrada às 22h do dia 31 já está no mês seguinte para o
-- servidor. Ela some da contagem de "novos" do mês que o salão acabou de fechar e aparece no
-- seguinte — exatamente no momento em que a dona olha o número para saber como foi o mês.
--
-- Quarta aparição da classe neste projeto: `v_daily_cash` foi abandonada por isso,
-- `receitaAtribuidaAoCiclo` foi corrigida em 28/08, `v_client_segments` na 0048, e esta ficou.
--
-- O `join tenants` é seguro sob `security_invoker` pela política `tenants_select` (0001,
-- `has_tenant(id)`), e o único leitor (`crm.ts`) consulta com o cliente do usuário.
--
-- `drop` + `create` porque a lista de colunas muda de origem (ganha o join); nada depende desta
-- view e a migration roda em transação.
drop view if exists v_carteira_resumo;

create view v_carteira_resumo with (security_invoker = true) as
select
  c.tenant_id,
  count(*)                                                    as total,
  -- O SEGUNDO `at time zone` não é redundância, é o conserto.
  --
  -- `date_trunc('month', now() at time zone tz)` devolve um `timestamp` SEM fuso — o relógio de
  -- parede do salão. Comparar isso com `created_at`, que é `timestamptz`, faz o Postgres
  -- reinterpretar o relógio de parede no fuso da SESSÃO (UTC) e devolve o defeito pela porta dos
  -- fundos. Medido antes de aplicar:
  --
  --   date_trunc('month', now() at time zone 'America/Sao_Paulo')                  -> 2026-08-01 00:00 (ingênuo)
  --   ... at time zone 'America/Sao_Paulo'                                          -> 2026-08-01 03:00+00  = 1º/08 00h NO SALÃO  ✓
  --   date_trunc('month', now())  (o jeito antigo)                                  -> 2026-08-01 00:00+00  = 31/07 21h no salão  ✗
  count(*) filter (
    where c.created_at >= (date_trunc('month', now() at time zone t.timezone) at time zone t.timezone)
  )                                                           as novos_mes,
  count(*) filter (where c.visits_count > 1)                  as com_retorno,
  coalesce(sum(c.ltv_cents), 0)                               as ltv_total,
  coalesce(sum(c.visits_count), 0)                            as visitas_total
from clients c
join tenants t on t.id = c.tenant_id
where c.deleted_at is null
group by c.tenant_id;
