-- CICLO · "quem sumiu" por sujeito: o animal em dia não esconde o outro que sumiu (AUT-101 passo 4, C-025)
--
-- A regra da 0121: cliente com QUALQUER ciclo em dia sai da fila ("já vem, não incomodar"). Com sujeito,
-- isso escondia a perda: a Mel tomou banho ontem, o Thor sumiu há 2 meses, e o tutor saía da fila
-- inteiro (o mesmo dano que o C-003 mediu na série única). Agora o ciclo em dia só tira da fila o MESMO
-- sujeito. Na beleza o sujeito é nulo em tudo, `is not distinct from` casa nulo com nulo, e a regra é
-- idêntica à da 0121.
--
-- Colunas novas SÓ no fim (`create or replace view` não aceita coluna no meio) e `security_invoker`
-- repetido (não é herdado). `v_clientes_a_recuperar` depende desta e não muda.

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
  cc.sample_size,
  cc.subject_id,
  sj.name as subject_name
from public.client_cycles cc
join public.clients c on c.id = cc.client_id and c.deleted_at is null and not coalesce(c.whatsapp_opt_out, false)
join public.services s on s.id = cc.service_id and s.active
left join public.subjects sj on sj.tenant_id = cc.tenant_id and sj.id = cc.subject_id
where cc.state in ('due', 'late', 'at_risk', 'lost')
  and cc.predicted_on is not null
  and not exists (
    select 1
    from public.client_cycles saudavel
    join public.services s2 on s2.id = saudavel.service_id and s2.active
    where saudavel.tenant_id = cc.tenant_id
      and saudavel.client_id = cc.client_id
      and saudavel.subject_id is not distinct from cc.subject_id
      and saudavel.state = 'on_track'
  );

revoke all on public.v_quem_sumiu from anon, authenticated;
grant select on public.v_quem_sumiu to authenticated;
