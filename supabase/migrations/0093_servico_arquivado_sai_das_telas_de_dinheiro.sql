-- CICLO · BL-48 (.claude/ciclo/autonomous-backlog.md), partes 2 e 3: serviço arquivado sai das
-- duas telas de dinheiro do Motor de Ciclo, não só do job noturno (migration anterior a esta, em
-- server/services/ciclo.ts, já filtrou `active = true` na leitura de `services`).
--
-- Sem isto, `v_recover_revenue` (Recuperar receita) e `v_clientes_a_recuperar` (alerta do "Hoje")
-- continuam mostrando/contando `client_cycles` de um serviço que o salão não oferece mais — a
-- profissional lê "fulana atrasada, Platinado" para um serviço tirado do catálogo há meses, e o
-- número "N clientes sumindo · R$ X em risco" da tela inicial infla com gente cujo único estado
-- não-em-dia é desse serviço fantasma.
--
-- `create or replace view` só aceita coluna NOVA no fim, e não muda a lista de colunas aqui —
-- ambas ganham só una condição de filtro. `security_invoker = true` é repetido nas duas por
-- obrigação: `create or replace view` NÃO herda as opções da definição anterior (armadilha já
-- nomeada na migration 0067 desta mesma família).
--
-- A view lista as 15 colunas da `0092` (ritmo na lista de recuperar) e mantém `and s.active`.
-- Ordem obrigatória: `0092` ANTES desta.

create or replace view public.v_recover_revenue with (security_invoker = true) as
select
  cc.tenant_id,
  cc.client_id,
  c.name        as client_name,
  c.phone_e164,
  cc.service_id,
  s.name        as service_name,
  cc.state,
  cc.late_days,
  cc.predicted_on,
  cc.value_at_risk_cents,
  cc.last_campaign_at,
  cc.profit_at_risk_cents,
  cc.personal_cycle_days,
  cc.last_visit_on,
  cc.sample_size
from public.client_cycles cc
join public.clients  c on c.id = cc.client_id and c.deleted_at is null
join public.services s on s.id = cc.service_id and s.active
where cc.state in ('due','late','at_risk','lost')
order by cc.value_at_risk_cents desc;

-- `v_clientes_a_recuperar` (0058): mesma exclusão, nos dois lados da lógica — no cálculo do que
-- CONTA como "atrasado" (o `from`/`join` principal) e no que conta como "em dia" (o `not exists`
-- correlacionado). Um cliente cujo único ciclo não-`on_track` é de serviço arquivado não pode
-- aparecer como "sumindo"; e um `on_track` de serviço arquivado não pode blindar (nem prejudicar)
-- ninguém — o serviço arquivado some da conta dos dois lados, como se nunca tivesse existido para
-- esta pergunta.
create or replace view public.v_clientes_a_recuperar
with (security_invoker = true) as
select
  cc.tenant_id,
  cc.client_id,
  max(cc.value_at_risk_cents) as maior_valor_cents,
  max(cc.late_days) as maior_atraso_dias,
  bool_or(cc.state in ('late', 'at_risk', 'lost')) as ja_atrasado
from public.client_cycles cc
join public.services s on s.id = cc.service_id and s.active
where cc.state in ('due', 'late', 'at_risk', 'lost')
  and not exists (
    select 1 from public.client_cycles saudavel
    join public.services s2 on s2.id = saudavel.service_id and s2.active
    where saudavel.tenant_id = cc.tenant_id
      and saudavel.client_id = cc.client_id
      and saudavel.state = 'on_track'
  )
group by cc.tenant_id, cc.client_id;

comment on view public.v_clientes_a_recuperar is
  'Uma linha por CLIENTE a recuperar (não por cliente×serviço). Exclui quem tem qualquer ciclo em dia, e ignora ciclo de serviço arquivado dos dois lados da conta (BL-48).';
