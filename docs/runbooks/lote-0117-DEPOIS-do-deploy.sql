-- CICLO · migration 0117 (privilegio minimo)
-- PARA COLAR NO SQL EDITOR DO SUPABASE DE PRODUCAO (eqzlvthzdjnsbogymcsw). Rodar DEPOIS de o codigo novo estar no ar e o site responder normalmente: ela RETIRA privilegios.
--
-- ANTES DE COLAR, rode esta consulta e APAGUE deste arquivo os blocos das migrations que ela já listar
-- (a producao tinha 103 aplicadas contra 100 esperadas pelo codigo em 2026-10-08, e eu nao consigo ver
-- quais sao as 3 a mais):
--   select version, name from supabase_migrations.schema_migrations where version >= '0100' order by version;
--
-- Cada migration vai no seu proprio begin/commit e se registra no livro (`supabase_migrations.schema_migrations`,
-- formato version + name sem prefixo, o que o /api/health le). Se um bloco falhar, os anteriores ficam aplicados
-- e os seguintes NAO devem ser colados: pare e me mostre o erro.
-- Nao use `supabase db push` (docs/runbooks/publicar-a-branch-de-trabalho.md, secao 4.3).
-- Blocos neste arquivo: 0117

-- ===== 0117_privilegio_minimo.sql =====
begin;

-- docs/102 M0.3: privilégio mínimo nas tabelas do schema `public` (defesa em profundidade).
--
-- Medido em 2026-10-08 no banco local, nas 59 tabelas do CICLO base:
--  * `anon` tinha todos os privilégios de tabela em todas. Nenhum código usa `anon` em tabela: a leitura
--    pública passa por `service_role` (`public-booking.ts`) e o cliente do navegador só existe para o OAuth
--    (`login-social.tsx`). Quem segurava era só a RLS;
--  * `authenticated` tinha TRUNCATE em 58. TRUNCATE não passa pela RLS; a PostgREST não o expõe, mas o
--    privilégio não tem por que existir;
--  * 36 tabelas tinham DELETE para `authenticated` e nenhuma política de DELETE: o que impedia apagar
--    agendamento, auditoria e movimento de estoque (regra 11 do CLAUDE.md) era a AUSÊNCIA de política. Uma
--    política escrita por engano amanhã abriria a porta. Todo `.delete()` nessas tabelas roda com
--    `service_role` (`idempotency.ts`, `lgpd.ts` com `svc`, `onboarding.ts`), que não é afetado.
--
-- A regra sai do catálogo, não de uma lista escrita à mão: vale para a tabela que existir quando esta
-- migration rodar. Para as que vierem depois, os privilégios padrão param de dar `anon` e TRUNCATE, e o
-- teste `tests/rls/privilegio-minimo.test.ts` lê `privilegios_report()` e reprova tabela fora da regra.
do $$
declare
  t record;
begin
  for t in
    select c.oid, c.relname
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p')
  loop
    execute format('revoke all on public.%I from anon', t.relname);
    execute format('revoke truncate on public.%I from authenticated', t.relname);
    if not exists (
      select 1 from pg_policies p
      where p.schemaname = 'public' and p.tablename = t.relname and p.cmd in ('DELETE', 'ALL')
        and (p.roles @> array['authenticated']::name[] or p.roles @> array['public']::name[])
    ) then
      execute format('revoke delete on public.%I from authenticated', t.relname);
    end if;
  end loop;
end $$;

-- Tabela criada daqui em diante pelo dono das migrations já nasce sem `anon` e sem TRUNCATE.
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke truncate on tables from authenticated;

-- O relatório que o teste lê. Definer porque `has_table_privilege` sobre outro papel e `pg_policies` são
-- do catálogo; só a `service_role` executa (o teste usa a chave de serviço).
create or replace function public.privilegios_report()
returns table (table_name text, anon_qualquer boolean, auth_truncate boolean, auth_delete boolean, politica_de_delete boolean)
language sql stable security definer set search_path = public, pg_catalog as $$
  select
    c.relname::text,
    has_table_privilege('anon', c.oid, 'SELECT') or has_table_privilege('anon', c.oid, 'INSERT')
      or has_table_privilege('anon', c.oid, 'UPDATE') or has_table_privilege('anon', c.oid, 'DELETE')
      or has_table_privilege('anon', c.oid, 'TRUNCATE'),
    has_table_privilege('authenticated', c.oid, 'TRUNCATE'),
    has_table_privilege('authenticated', c.oid, 'DELETE'),
    exists (
      select 1 from pg_policies p
      where p.schemaname = 'public' and p.tablename = c.relname and p.cmd in ('DELETE', 'ALL')
        and (p.roles @> array['authenticated']::name[] or p.roles @> array['public']::name[])
    )
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'p')
  order by 1
$$;

revoke all on function public.privilegios_report() from public, anon, authenticated;
grant execute on function public.privilegios_report() to service_role;

insert into supabase_migrations.schema_migrations (version, name) values ('0117', 'privilegio_minimo') on conflict do nothing;
commit;

