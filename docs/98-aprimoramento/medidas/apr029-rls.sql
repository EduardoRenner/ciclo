-- APR-029: soma de 10 mil ticket_items como `authenticated`, dono e profissional (visão restrita).
-- Transação desfeita no fim.
\set T '''b037d051-7fcc-465c-8653-c6ea69554527'''
\set P '''5ebc52dc-4894-443e-b598-59fb80954ced'''
begin;
update public.tenants set settings = coalesce(settings,'{}'::jsonb) || '{"restrict_professional_view": true}' where id = :T;
create temp table novos on commit drop as
  select gen_random_uuid() as id from generate_series(1, 2000);
insert into public.tickets (id, tenant_id, professional_id, total_cents) select id, :T, :P, 5000 from novos;
insert into public.ticket_items (tenant_id, ticket_id, service_id, professional_id, description, unit_price_cents, total_cents)
select :T, n.id, '38e29c65-27e6-44ca-9249-528ec1fed1df', :P, 'Corte', 1000, 1000 from novos n, generate_series(1, 5);
select 'itens do tenant', count(*) from public.ticket_items where tenant_id = :T;
grant select on novos to authenticated;
set local role authenticated;
set local request.jwt.claims = '{"sub":"5fc3fb25-7724-488e-b7fe-a3af402462e7","role":"authenticated"}';
select 'dono soma', count(*), sum(total_cents) from public.ticket_items where tenant_id = :T;
explain (analyze, timing off, summary on) select sum(total_cents) from public.ticket_items where tenant_id = :T;
explain (analyze, timing off, summary on) select sum(total_cents) from public.ticket_items where tenant_id = :T;
explain (analyze, timing off, summary on) select sum(total_cents) from public.ticket_items where tenant_id = :T;
explain (analyze, timing off, summary on) select sum(total_cents) from public.ticket_items where tenant_id = :T;
explain (analyze, timing off, summary on) select sum(total_cents) from public.ticket_items where tenant_id = :T;
set local request.jwt.claims = '{"sub":"57833674-d906-433c-aeaf-bafe7e706831","role":"authenticated"}';
select 'profissional soma', count(*), sum(total_cents) from public.ticket_items where tenant_id = :T;
explain (analyze, timing off, summary on) select sum(total_cents) from public.ticket_items where tenant_id = :T;
explain (analyze, timing off, summary on) select sum(total_cents) from public.ticket_items where tenant_id = :T;
explain (analyze, timing off, summary on) select sum(total_cents) from public.ticket_items where tenant_id = :T;
explain (analyze, timing off, summary on) select sum(total_cents) from public.ticket_items where tenant_id = :T;
explain (analyze, timing off, summary on) select sum(total_cents) from public.ticket_items where tenant_id = :T;
select 'profissional comandas', count(*) from public.tickets where tenant_id = :T;
explain (analyze, timing off, summary on) select count(*) from public.tickets where tenant_id = :T;
rollback;
