-- TICKET-058: `/api/health` precisa saber quando cada job cron rodou pela última vez com
-- sucesso — `send_reminders` roda direto (não passa por `job_queue`, ver comentário na rota),
-- então não há linha nenhuma lá para checar "sem execução em 30 min" (J129). Tabela pequena e
-- global (não por tenant: é sinal de operação da plataforma, não dado de negócio de ninguém).
create table cron_heartbeats (
  kind         text primary key,
  last_run_at  timestamptz not null default now()
);

alter table cron_heartbeats enable row level security;
alter table cron_heartbeats force row level security;
-- só o service_role escreve (via withNovoTenant) e só /api/health lê (mesmo caminho) — nenhuma
-- política pra authenticated/anon: não é dado de tenant nenhum pra expor.
revoke all on cron_heartbeats from anon, authenticated;
