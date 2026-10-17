-- APR-035 (achado E-06): "quem sumiu" contado por UMA regra, nas duas telas.
--
-- O alarme da Hoje ("N clientes estão sumindo") vinha de `v_clientes_a_recuperar` (0058), que não
-- olhava o cadastro: cliente APAGADA e quem pediu "PARAR" no WhatsApp continuavam contando, e o
-- serviço desativado também. O Recuperar vinha de `v_recover_revenue` (que exclui a apagada) com o
-- `on_track` e o opt-out filtrados em memória, cada um do seu jeito. Medido na conta importada:
-- "266 para chamar" num lugar e "261 sumindo" no outro.
--
-- `v_quem_sumiu` é a regra, linha por (cliente × serviço), com as quatro exclusões juntas:
--   · cliente apagada (`deleted_at`);
--   · quem pediu para não receber mensagem (`whatsapp_opt_out`) — não dá para chamar;
--   · quem tem QUALQUER ciclo em dia (`on_track`) em serviço ativo — está vindo;
--   · ciclo sem previsão (`predicted_on` nulo) — o Motor ainda não sabe quando ela volta.
-- O Recuperar lê dela; `v_clientes_a_recuperar` passa a agregar dela por cliente (mesmas colunas,
-- mesma ordem: view só aceita coluna nova no fim). `due` ("na hora de voltar") continua na lista
-- e fora do alarme, como a 0058 decidiu (`ja_atrasado`).
--
-- Aditiva: a view nova não muda nada até o código a usar; a troca do corpo de
-- `v_clientes_a_recuperar` só deixa o alarme MENOR e correto.

create or replace view public.v_quem_sumiu
with (security_invoker = true) as
select
  cc.tenant_id,
  cc.client_id,
  c.name as client_name,
  c.phone_e164,
  cc.service_id,
  s.name as service_name,
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
join public.clients c
  on c.id = cc.client_id
 and c.deleted_at is null
 and not coalesce(c.whatsapp_opt_out, false)
join public.services s
  on s.id = cc.service_id
 and s.active
where cc.state in ('due', 'late', 'at_risk', 'lost')
  and cc.predicted_on is not null
  and not exists (
    select 1
    from public.client_cycles saudavel
    join public.services s2 on s2.id = saudavel.service_id and s2.active
    where saudavel.tenant_id = cc.tenant_id
      and saudavel.client_id = cc.client_id
      and saudavel.state = 'on_track'
  );

comment on view public.v_quem_sumiu is
  'A regra única de "quem chamar de volta" (APR-035): sem apagada, sem opt-out, sem quem tem ciclo em dia, sem ciclo sem previsão. Uma linha por cliente × serviço.';

-- Privilégio mínimo (0117): leitura para quem está logado, nada para anon.
revoke all on public.v_quem_sumiu from anon, authenticated;
grant select on public.v_quem_sumiu to authenticated;

create or replace view public.v_clientes_a_recuperar
with (security_invoker = true) as
select
  q.tenant_id,
  q.client_id,
  max(q.value_at_risk_cents) as maior_valor_cents,
  max(q.late_days) as maior_atraso_dias,
  bool_or(q.state in ('late', 'at_risk', 'lost')) as ja_atrasado
from public.v_quem_sumiu q
group by q.tenant_id, q.client_id;

comment on view public.v_clientes_a_recuperar is
  'Uma linha por CLIENTE a recuperar, agregada de v_quem_sumiu (APR-035): a mesma regra do Recuperar.';
