-- CICLO · reivindicar só alguns tipos de job, quando quem chama pede (docs/105-ciclo/C-024)
--
-- `claim_jobs` reivindica job de QUALQUER tipo, e o worker de produção continua assim de propósito: job
-- de tipo sem tratador morre com o erro escrito, nunca fica parado em silêncio (`job-queue.test.ts`).
-- O parâmetro novo existe para os testes: rodando em paralelo, os workers de `job-queue.test.ts`
-- reivindicavam o job de fixture de `health.test.ts` (causa medida, comentário lá), e as duas suítes
-- piscavam. Com `p_kinds`, cada teste reivindica só os tipos dele.
--
-- EQUIVALENTE para quem não passa tipos: `p_kinds` nulo = qualquer tipo, exatamente como antes. O código
-- antigo (`rpc('claim_jobs', { p_limit })`) segue funcionando durante o deploy. A função antiga é
-- removida no MESMO arquivo: duas versões com `p_limit` deixariam a chamada por nome ambígua no PostgREST.

drop function public.claim_jobs(int);

create function public.claim_jobs(p_limit int default 50, p_kinds text[] default null)
returns setof job_queue
language sql
volatile
security definer
set search_path = public
as $$
  update job_queue
  set status = 'running',
      locked_at = now(),
      attempts = case when status = 'running' then attempts + 1 else attempts end,
      last_error = case when status = 'running'
                        then 'reivindicado por timeout: o worker anterior não terminou'
                        else last_error end
  where id in (
    select id from job_queue
    where ((status in ('queued', 'failed') and run_after <= now())
        or (status = 'running' and locked_at < now() - interval '15 minutes' and attempts < max_attempts))
      and (p_kinds is null or kind = any (p_kinds))
    order by run_after
    limit p_limit
    for update skip locked
  )
  returning *;
$$;

revoke all on function public.claim_jobs(int, text[]) from public, anon, authenticated;
grant execute on function public.claim_jobs(int, text[]) to service_role;
