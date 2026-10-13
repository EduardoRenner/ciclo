-- APR-028: contagem de 10 mil agendamentos como `authenticated`, dono e profissional (visão restrita).
-- Tudo dentro de uma transação desfeita no fim: o banco local volta como estava.
\set T '''b037d051-7fcc-465c-8653-c6ea69554527'''
begin;
update public.tenants set settings = coalesce(settings,'{}'::jsonb) || '{"restrict_professional_view": true}' where id = :T;
insert into public.appointments (tenant_id, service_id, professional_id, starts_at, ends_at, status)
select :T, '38e29c65-27e6-44ca-9249-528ec1fed1df', '5ebc52dc-4894-443e-b598-59fb80954ced',
       timestamptz '2020-01-01' + (g * interval '1 hour'), timestamptz '2020-01-01' + (g * interval '1 hour') + interval '30 min', 'done'
from generate_series(1, 10000) g;
select 'linhas do tenant', count(*) from public.appointments where tenant_id = :T;
set local role authenticated;
set local request.jwt.claims = '{"sub":"5fc3fb25-7724-488e-b7fe-a3af402462e7","role":"authenticated"}';
select 'dono vê', count(*) from public.appointments where tenant_id = :T;
explain (analyze, timing off, summary on) select count(*) from public.appointments where tenant_id = :T;
explain (analyze, timing off, summary on) select count(*) from public.appointments where tenant_id = :T;
explain (analyze, timing off, summary on) select count(*) from public.appointments where tenant_id = :T;
explain (analyze, timing off, summary on) select count(*) from public.appointments where tenant_id = :T;
explain (analyze, timing off, summary on) select count(*) from public.appointments where tenant_id = :T;
set local request.jwt.claims = '{"sub":"57833674-d906-433c-aeaf-bafe7e706831","role":"authenticated"}';
select 'profissional vê', count(*) from public.appointments where tenant_id = :T;
explain (analyze, timing off, summary on) select count(*) from public.appointments where tenant_id = :T;
explain (analyze, timing off, summary on) select count(*) from public.appointments where tenant_id = :T;
explain (analyze, timing off, summary on) select count(*) from public.appointments where tenant_id = :T;
explain (analyze, timing off, summary on) select count(*) from public.appointments where tenant_id = :T;
explain (analyze, timing off, summary on) select count(*) from public.appointments where tenant_id = :T;
rollback;
