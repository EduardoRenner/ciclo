-- =====================================================================
-- CICLO · o relatório de RLS passa a enxergar a base inteira (migration 0076)
--
-- Achado da auditoria de 2026-09-08.
--
-- A `0005` criou `tenant_rls_report()` para que "uma tabela nova sem política
-- seja detectada sem ninguém lembrar de editar o teste". Só que ela fazia
-- `join pg_attribute ... attname = 'tenant_id'` — um JOIN, não um LEFT JOIN.
-- Toda tabela SEM a coluna `tenant_id` simplesmente não aparecia no relatório,
-- e o teste de isolamento, que descobre o que verificar a partir dele, nunca
-- ficava sabendo que ela existe.
--
-- É a guarda cega de RAIZ: a varredura não olha onde o defeito pode morar, e
-- o teste passa verde por não ter olhado. Uma tabela nova sem `tenant_id` e sem
-- RLS não reprovaria nada — nem o teste de isolamento, nem o build.
--
-- Medido em produção antes desta migration: NOVE tabelas invisíveis
-- (`cron_heartbeats`, `modules`, `profession_services`, `professions`,
-- `profiles`, `rate_limits`, `tenants`, `vertical_packs`, `webhook_events`).
-- Todas com RLS habilitada e forçada, então o estado de hoje está certo — o
-- defeito não é o que já existe, é o que ninguém veria entrar.
--
-- `drop` antes de `create`: mudar o tipo de retorno de uma função é a única
-- alteração que `create or replace` recusa (42P13).
-- =====================================================================

drop function if exists public.tenant_rls_report();

create or replace function public.tenant_rls_report()
returns table (
  table_name    text,
  rls_enabled   boolean,
  rls_forced    boolean,
  policy_count  int,
  -- A coluna nova. O teste precisa da distinção porque as duas classes têm
  -- regras diferentes: com `tenant_id`, a tabela tem que ter política e é
  -- testada contra o outro tenant; sem `tenant_id`, ela é do servidor e a
  -- ausência de política é o desenho, desde que RLS esteja forçada.
  has_tenant_id boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.relname::text,
    c.relrowsecurity,
    c.relforcerowsecurity,
    (select count(*)::int from pg_policies p
      where p.schemaname = 'public' and p.tablename = c.relname),
    exists (
      select 1 from pg_attribute a
      where a.attrelid = c.oid
        and a.attname = 'tenant_id'
        and a.attnum > 0
        and not a.attisdropped
    )
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
  order by c.relname;
$$;

revoke all on function public.tenant_rls_report() from public, anon, authenticated;
grant execute on function public.tenant_rls_report() to service_role;
