-- =====================================================================
-- CICLO · pg_cron como segunda rede, independente do GitHub (migration 0087)
--
-- O Motor de Ciclo (`recompute-cycles`) já quebrou DUAS VEZES por causa da mesma dependência: o
-- `schedule` do GitHub Actions não rodou por horas (billing da conta, ou atraso de 5-6,5h medido
-- em `docs/23`/`docs/24`), e como NENHUM workflow executa, nem o job "vigia" que checa o
-- heartbeat dispara — a queda é silenciosa por definição, não por defeito de código.
--
-- Este arquivo NÃO substitui `.github/workflows/cron.yml`. É uma SEGUNDA rede, que roda dentro do
-- próprio Postgres do projeto e não depende de nenhuma conta de terceiro. Se o GitHub cair, o
-- pg_cron continua rodando; se o pg_cron falhar por algum motivo do lado do Supabase, o GitHub
-- continua cobrindo. As duas rotas já são seguras contra disparo duplicado: `recompute-cycles` e
-- `segments` fazem upsert por PK (TICKET-036) — rodar duas vezes no mesmo dia é desperdício de
-- CPU, não incorreção.
--
-- ## Por que só estas duas rotas
--
-- As mesmas que `.github/workflows/cron.yml` chama de "jobs seguros": só calculam e gravam no
-- próprio banco, nenhuma fala com o mundo externo. `reminders`/`campaigns` (que mandam mensagem de
-- verdade) ficam de fora aqui pelo mesmo motivo que ficam de fora do `schedule` do GitHub — ligar
-- isso é decisão do dono, não linha de infraestrutura.
--
-- ## Por que o segredo não está aqui, e o que fica pendente pra você fazer
--
-- Regra 10 do CLAUDE.md: segredo nunca no repositório. Os dois valores que o job precisa
-- (`CRON_BASE_URL`, `CRON_SECRET`) ficam no Vault do Supabase, e ESTA MIGRATION NÃO OS CRIA — só
-- lê pelo nome. Sem eles, o `cron.schedule` abaixo roda e falha silenciosamente (a chamada HTTP
-- não encontra segredo, `net.http_post` não dispara) — inofensivo, mas também inútil.
--
-- **Passo manual, uma vez, no SQL Editor do Supabase (nunca num arquivo versionado):**
--
--   select vault.create_secret('https://seuciclo.com.br', 'cron_base_url');
--   select vault.create_secret('<o mesmo valor de CRON_SECRET da Vercel>', 'cron_secret');
--
-- Sem isso aplicado, esta migration é inerte — mesmo desenho do Mercado Pago e do webhook do
-- WhatsApp: o código pode ir antes da credencial e ficar parado até ela existir.
-- =====================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- `cron` e `net` nascem em schemas próprios; `postgres` (quem aplica migration) já tem acesso.
-- Sem grant a mais: os jobs abaixo rodam como o dono do schema `cron`, que é quem os agenda.

select cron.schedule(
  'ciclo_recompute_cycles',
  -- A cada hora, minuto 20 — não precisa coincidir com o GitHub. Os dois são independentes de
  -- propósito: se coincidissem, uma falha que afetasse "o minuto X" derrubaria as duas redes juntas.
  '20 * * * *',
  $$
  select net.http_get(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'cron_base_url' limit 1) || '/api/cron/recompute-cycles',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret' limit 1)
    ),
    timeout_milliseconds := 300000
  );
  $$
);

select cron.schedule(
  'ciclo_recompute_segments',
  '50 * * * *',
  $$
  select net.http_get(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'cron_base_url' limit 1) || '/api/cron/segments',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret' limit 1)
    ),
    timeout_milliseconds := 300000
  );
  $$
);

-- ---------------------------------------------------------------------
-- Só para o teste-guarda enxergar o agendamento: `cron` não é schema que o PostgREST expõe
-- (`supabase/config.toml`: só `public`/`graphql_public`), e adicionar uma dependência nova
-- (`pg`) só para uma consulta administrativa seria desproporcional.
--
-- FUNÇÃO, não view — de propósito, e por causa de outra guarda desta casa
-- (`tests/unit/design/view-nao-fura-a-rls.test.ts`): TODA `create view` neste repositório precisa
-- de `security_invoker = true`, sem exceção, porque é o jeito de uma view sobre dado de TENANT não
-- vazar entre salões. Aqui o problema é o oposto: `cron.job` tem RLS por `username` (só o dono do
-- job enxerga o próprio), e COM `security_invoker` o `service_role` — que não é quem agendou o
-- job — veria a consulta vazia. Mesmo padrão de `migracoes_aplicadas()` (migration `0062`):
-- `security definer`, acesso restrito por `grant`/`revoke`, não por RLS.
-- ---------------------------------------------------------------------
create or replace function public.status_do_cron_do_motor()
returns table (jobname text, schedule text, active boolean)
language sql
stable
security definer
set search_path = pg_catalog, cron
as $$
  select jobname, schedule, active
  from cron.job
  where jobname like 'ciclo_%'
$$;

revoke all on function public.status_do_cron_do_motor() from public;
revoke all on function public.status_do_cron_do_motor() from anon;
revoke all on function public.status_do_cron_do_motor() from authenticated;
grant execute on function public.status_do_cron_do_motor() to service_role;
