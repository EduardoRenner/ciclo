-- TICKET-040: view derivada, sem tabela nova — visits_count/ltv_cents/last_visit_at já existem
-- em `clients` (o job diário do app é que os mantém frescos, ver src/server/services/segmentos.ts).
-- security_invoker: a view roda com o privilégio de quem consulta, então a RLS de `clients`
-- continua valendo — sem isso a view furaria o isolamento entre tenants.
create or replace view v_client_segments with (security_invoker = true) as
select
  c.*,
  (c.birth_date is not null and extract(month from c.birth_date) = extract(month from current_date)) as is_aniversariante,
  (
    c.visits_count = 1
    and not exists (
      select 1 from appointments a
      where a.client_id = c.id and a.tenant_id = c.tenant_id and a.status in ('pending', 'confirmed', 'arrived')
    )
  ) as is_primeira_visita_sem_retorno,
  -- top 25% de LTV do próprio tenant, entre quem já teve visita — "alto" é relativo ao salão,
  -- não um valor fixo em reais (um salão de bairro e um spa premium não têm o mesmo "alto").
  (c.visits_count > 0 and percent_rank() over (partition by c.tenant_id order by c.ltv_cents) >= 0.75) as is_ticket_alto
from clients c
where c.deleted_at is null;
