-- Agente B · custo da RLS por linha em appointments/clients (banco LOCAL, só leitura, transações com rollback)
-- Q2 baseline sem RLS (postgres) e com RLS (authenticated, dono demo-salao-encanto)
\timing on
-- sem RLS (postgres ignora RLS por ser dono): linha de base do custo da consulta
explain (analyze, costs off, summary on) select count(*) from appointments where tenant_id='320d83de-611f-48e1-9761-570863fbb10b';
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"6dbcfc89-aca4-4a6e-adcd-29f9d590400a","role":"authenticated"}', true) \g /dev/null
explain (analyze, costs off, summary on) select count(*) from appointments where tenant_id='320d83de-611f-48e1-9761-570863fbb10b';
rollback;
-- Q3 projeção em 10.014 linhas (tenant sintético ciclo-328f57e3 criado por outro agente): predicado por linha × initplan
begin;
select set_config('request.jwt.claims', '{"sub":"6dbcfc89-aca4-4a6e-adcd-29f9d590400a","role":"authenticated"}', true) \g /dev/null
explain (analyze, costs off, summary on) select count(*) from appointments a where a.tenant_id=(select id from tenants where slug='ciclo-328f57e3');
explain (analyze, costs off, summary on) select count(*) from appointments a where a.tenant_id=(select id from tenants where slug='ciclo-328f57e3') and has_tenant('320d83de-611f-48e1-9761-570863fbb10b'::uuid) and can_see_appointment('320d83de-611f-48e1-9761-570863fbb10b'::uuid, a.professional_id);
-- alternativa: avaliar a pertença UMA vez (initplan) em vez de por linha
explain (analyze, costs off, summary on) select count(*) from appointments a where a.tenant_id=(select id from tenants where slug='ciclo-328f57e3') and (select has_tenant('320d83de-611f-48e1-9761-570863fbb10b'::uuid)) and (select can_see_appointment('320d83de-611f-48e1-9761-570863fbb10b'::uuid, null));
rollback;
-- Q5 has_tenant(tenant_id) por linha
begin;
select set_config('request.jwt.claims', '{"sub":"6dbcfc89-aca4-4a6e-adcd-29f9d590400a","role":"authenticated"}', true) \g /dev/null
explain (analyze, costs off, summary on) select count(*) from clients c where c.tenant_id=(select id from tenants where slug='ciclo-328f57e3') and has_tenant(c.tenant_id);
explain (analyze, costs off, summary on) select count(*) from appointments a where a.tenant_id=(select id from tenants where slug='ciclo-328f57e3') and has_tenant(a.tenant_id);
rollback;
