-- =====================================================================
-- CICLO · introspecção para o teste de isolamento (migration 0005)
--
-- O TICKET-005 exige que o teste de RLS descubra as tabelas sozinho, para
-- que uma tabela nova sem política seja detectada sem ninguém lembrar de
-- editar o teste. O PostgREST não expõe o catálogo do Postgres, então a
-- descoberta passa por esta função — restrita ao service_role.
-- =====================================================================

create or replace function public.tenant_rls_report()
returns table (
  table_name   text,
  rls_enabled  boolean,
  rls_forced   boolean,
  policy_count int
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
      where p.schemaname = 'public' and p.tablename = c.relname)
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  join pg_attribute a on a.attrelid = c.oid and a.attname = 'tenant_id' and a.attnum > 0 and not a.attisdropped
  where n.nspname = 'public' and c.relkind = 'r'
  order by c.relname;
$$;

revoke all on function public.tenant_rls_report() from public, anon, authenticated;
grant execute on function public.tenant_rls_report() to service_role;
