-- TICKET-056. Endurece o que a 0015 documentou como já aplicado:
--
-- 1. `push_subscriptions_endpoint_key` era `UNIQUE (endpoint)` — global. A mesma pessoa que
--    atende em dois estabelecimentos (memberships N:N, `01-ESPEC-TECNICA §2.1`) do mesmo
--    aparelho reusa o mesmo endpoint de push (é o navegador quem decide isso, não a
--    aplicação) — a unicidade tem que ser por tenant, não global, ou a segunda inscrição
--    falha com 23505 sem motivo de negócio nenhum.
-- 2. A política `push_subscriptions_tenant_all` só checava `has_tenant(tenant_id)` — qualquer
--    membro do tenant enxergava/apagava a inscrição de push de QUALQUER OUTRO membro
--    (endpoint + chaves de outra pessoa, que dá pra mandar notificação se vazar). Inscrição
--    de push é dado de dispositivo pessoal, não de negócio do tenant — escopo tem que ser
--    também por `user_id = auth.uid()`.
alter table push_subscriptions drop constraint push_subscriptions_endpoint_key;
alter table push_subscriptions add constraint push_subscriptions_tenant_endpoint_key unique (tenant_id, endpoint);

drop policy push_subscriptions_tenant_all on push_subscriptions;
create policy push_subscriptions_self on push_subscriptions for all
  using (user_id = auth.uid() and has_tenant(tenant_id))
  with check (user_id = auth.uid() and has_tenant(tenant_id));

create index if not exists push_subscriptions_user_idx on push_subscriptions (user_id);
