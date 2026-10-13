begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"6dbcfc89-aca4-4a6e-adcd-29f9d590400a","role":"authenticated"}', true);
explain (analyze, buffers, costs off, timing on)
select a.starts_at, a.price_cents from appointments a
where a.tenant_id='320d83de-611f-48e1-9761-570863fbb10b' and a.status='done' and a.starts_at >= now()-interval '56 days' and a.starts_at < now();
explain (analyze, buffers, costs off)
select a.id, a.client_id, (select name from clients c where c.id=a.client_id) from appointments a
where a.tenant_id='320d83de-611f-48e1-9761-570863fbb10b' and a.status='done' and a.created_at >= now()-interval '90 days' and a.created_at < now();
explain (analyze, buffers, costs off) select * from resumo_central_de_acoes('320d83de-611f-48e1-9761-570863fbb10b');
rollback;
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"6dbcfc89-aca4-4a6e-adcd-29f9d590400a","role":"authenticated"}', true) \g /dev/null
\echo Q1 memberships+tenants (toda requisicao)
explain (analyze, buffers, costs off, summary on) select m.tenant_id, m.role, t.name, t.timezone, p.vocab from memberships m join tenants t on t.id=m.tenant_id left join professions p on p.slug::text=t.vertical::text where m.user_id='6dbcfc89-aca4-4a6e-adcd-29f9d590400a' and m.active;
\echo Q2 v_recover_revenue (Hoje/Recuperar)
explain (analyze, buffers, costs off, summary on) select * from v_recover_revenue where tenant_id='320d83de-611f-48e1-9761-570863fbb10b';
\echo Q3 loyalty_entries sem filtro (Hoje)
explain (analyze, buffers, costs off, summary on) select client_id, points from loyalty_entries where tenant_id='320d83de-611f-48e1-9761-570863fbb10b';
\echo Q4 cycle_predictions 12 meses (Hoje)
explain (analyze, buffers, costs off, summary on) select predicted_on, actual_return_on from cycle_predictions where tenant_id='320d83de-611f-48e1-9761-570863fbb10b' and predicted_on >= now()-interval '12 months' order by id limit 1000;
\echo Q5 tickets do mes (Caixa)
explain (analyze, buffers, costs off, summary on) select * from tickets where tenant_id='320d83de-611f-48e1-9761-570863fbb10b' and status in ('closed','paid') and closed_at >= date_trunc('month', now()) limit 1000;
\echo Q6 v_carteira_resumo (Clientes)
explain (analyze, buffers, costs off, summary on) select * from v_carteira_resumo where tenant_id='320d83de-611f-48e1-9761-570863fbb10b';
\echo Q7 v_client_segments (Clientes)
explain (analyze, buffers, costs off, summary on) select * from v_client_segments where tenant_id='320d83de-611f-48e1-9761-570863fbb10b';
\echo Q8 messages de campanha + appointments done (Campanhas)
explain (analyze, buffers, costs off, summary on) select id, client_id, starts_at from appointments where tenant_id='320d83de-611f-48e1-9761-570863fbb10b' and status='done';
rollback;
