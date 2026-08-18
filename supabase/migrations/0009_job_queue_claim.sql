-- TICKET-029 · "SELECT ... FOR UPDATE SKIP LOCKED" (§7) só é atômico se o
-- select-e-trava e o update forem uma operação só — duas idas separadas do
-- PostgREST (um SELECT, depois um UPDATE por id) reabrem a janela de corrida
-- que o SKIP LOCKED existe para fechar. Por isso a reivindicação vira função:
-- o UPDATE ... WHERE id IN (SELECT ... FOR UPDATE SKIP LOCKED) roda inteiro
-- dentro de uma transação do banco.

create or replace function public.claim_jobs(p_limit int default 50)
returns setof job_queue
language sql
volatile
security definer
set search_path = public
as $$
  update job_queue
  set status = 'running', locked_at = now()
  where id in (
    select id from job_queue
    where status in ('queued', 'failed') and run_after <= now()
    order by run_after
    limit p_limit
    for update skip locked
  )
  returning *;
$$;

-- Só o worker (service_role) reivindica job. Nunca via PostgREST de cliente.
revoke all on function public.claim_jobs(int) from public, anon, authenticated;

create or replace function public.finish_job(p_id bigint, p_status job_status, p_error text default null)
returns void
language sql
volatile
security definer
set search_path = public
as $$
  update job_queue
  set status = p_status,
      last_error = coalesce(p_error, last_error),
      -- backoff exponencial com teto de 1h: 1, 2, 4, 8, 16min, depois trava em 60min.
      run_after = case when p_status = 'failed'
                       then now() + (least(60, power(2, attempts)) * interval '1 minute')
                       else run_after end,
      attempts = case when p_status in ('failed', 'dead') then attempts + 1 else attempts end
  where id = p_id;
$$;

revoke all on function public.finish_job(bigint, job_status, text) from public, anon, authenticated;
