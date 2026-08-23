-- Auditoria de segurança de 2026-08-23, achado S12 (BAIXO).
--
-- `claim_jobs` só reivindicava `queued` e `failed`. Marcava `running`, gravava `locked_at` — e
-- **`locked_at` nunca era lido por ninguém** (uma única ocorrência nas migrations: a escrita).
-- Uma função serverless que estourasse o tempo, fosse derrubada por deploy no meio do lote ou
-- morresse de memória deixava o job em `running` para sempre. Nada o pegava de volta, e o
-- `verificarSaude` também não o via: ele contava só `queued`/`failed`. Trabalho sumia em
-- silêncio, que é o oposto do que o §7 pede.
--
-- ## Por que `attempts + 1` só para o reivindicado
--
-- Em Postgres, o `SET` de um UPDATE enxerga os valores ANTIGOS da linha — então
-- `case when status = 'running'` distingue quem está voltando de um worker morto de quem está
-- sendo reivindicado normalmente. Incrementar para todos duplicaria a contagem, porque
-- `finish_job` já incrementa em `failed`/`dead`.
--
-- ## Por que `attempts < max_attempts` no filtro
--
-- Worker que morre não chama `finish_job`, então o único lugar que conta a tentativa é aqui. Sem
-- esse teto, um job que derruba o worker toda vez seria reivindicado para sempre, derrubando um
-- worker por rodada. Com ele, o job para de ser reivindicado depois de esgotar as tentativas —
-- e aí fica visível pelo alerta novo de `verificarSaude`, que passou a olhar `running` velho.
-- Deixar parado e visível é melhor que reivindicar em laço; some em silêncio é o que não pode.
create or replace function public.claim_jobs(p_limit int default 50)
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
    where (status in ('queued', 'failed') and run_after <= now())
       or (status = 'running' and locked_at < now() - interval '15 minutes' and attempts < max_attempts)
    order by run_after
    limit p_limit
    for update skip locked
  )
  returning *;
$$;

revoke all on function public.claim_jobs(int) from public, anon, authenticated;
grant execute on function public.claim_jobs(int) to service_role;
