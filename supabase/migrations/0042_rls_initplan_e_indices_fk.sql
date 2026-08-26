-- =====================================================================
-- CICLO · Duas correções de performance de banco achadas na auditoria
-- completa de 2026-08-26 (`docs/26`). Nenhuma muda comportamento: as
-- políticas continuam autorizando exatamente as mesmas linhas, e índice
-- não altera resultado de consulta.
--
-- Vieram do `get_advisors(performance)`, eixo que nenhuma auditoria
-- anterior tinha olhado — 88 avisos, dos quais estes dois grupos são os
-- que escalam mal.
-- =====================================================================

-- ---------------------------------------------------------------------
-- PARTE 1 · `auth.uid()` reavaliado POR LINHA (4 políticas)
--
-- `auth.uid()` e `auth.role()` são STABLE, mas escritos soltos no `using`
-- o planejador os trata como referência à linha corrente e reexecuta a
-- cada tupla avaliada. Envolvidos num subselect escalar viram InitPlan:
-- avaliados UMA vez por consulta, e o resultado é reusado.
--
-- É reescrita mecânica — o predicado é idêntico. A que mais pesa é
-- `profiles_same_tenant`, cujo predicado é um EXISTS com auto-join em
-- `memberships`: hoje esse join roda por linha de `profiles`.
--
-- Por que não fazer o mesmo com `has_tenant(...)`/`tenant_role(...)`: as
-- duas recebem a coluna da linha como argumento, então dependem DA LINHA
-- e não podem virar InitPlan. Elas já são `stable`, que é o que dá para
-- fazer por elas.
-- ---------------------------------------------------------------------

drop policy if exists profiles_self on public.profiles;
create policy profiles_self on public.profiles for all
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

drop policy if exists profiles_same_tenant on public.profiles;
create policy profiles_same_tenant on public.profiles for select
  using (exists (
    select 1 from public.memberships a join public.memberships b on a.tenant_id = b.tenant_id
    where a.user_id = (select auth.uid()) and a.active and b.user_id = profiles.id and b.active
  ));

drop policy if exists push_subscriptions_self on public.push_subscriptions;
create policy push_subscriptions_self on public.push_subscriptions for all
  using (user_id = (select auth.uid()) and public.has_tenant(tenant_id))
  with check (user_id = (select auth.uid()) and public.has_tenant(tenant_id));

drop policy if exists modules_leitura_autenticada on public.modules;
create policy modules_leitura_autenticada on public.modules for select
  using ((select auth.role()) = 'authenticated');

-- ---------------------------------------------------------------------
-- PARTE 2 · 62 chaves estrangeiras sem índice que as cubra
--
-- O mecanismo de `on delete cascade`/`set null` do Postgres busca a
-- tabela filha SÓ pela coluna da FK. Sem índice com essa coluna no
-- PREFIXO, cada linha apagada no pai vira varredura sequencial da filha.
--
-- Isto já derrubou este banco uma vez: a migration 0021 nasceu porque
-- apagar um tenant com 10 mil clientes travava em `statement timeout`.
-- Ela consertou TRÊS casos — os que doeram naquele dia. Ficaram 62.
--
-- Por que indexar todas, e não escolher as "que vão crescer": escolher a
-- dedo foi exatamente o que produziu esta dívida. O critério vira
-- julgamento, o julgamento envelhece, e ninguém revisita. A regra
-- "FK tem índice" é enunciável, verificável e guardada por teste
-- (`fk_sem_indice_report()` abaixo). O custo de escrita de um índice em
-- tabela de 6 linhas é irrelevante; o de uma varredura sequencial em
-- tabela de 300 mil não é.
--
-- Chama atenção que SETE tabelas tinham `tenant_id` sem índice
-- (`campaigns`, `quote_items`, `service_products`, `service_categories`,
-- `subscription_plans`, `package_uses`, `professional_services`): além do
-- cascade, `tenant_id` é a coluna que toda política de RLS filtra.
-- ---------------------------------------------------------------------

create index if not exists appointment_series_created_by_idx on public.appointment_series (created_by);
create index if not exists appointment_series_service_id_idx on public.appointment_series (service_id);
create index if not exists appointments_created_by_idx on public.appointments (created_by);
create index if not exists appointments_service_id_idx on public.appointments (service_id);
create index if not exists business_hours_professional_id_idx on public.business_hours (professional_id);
create index if not exists campaigns_tenant_id_idx on public.campaigns (tenant_id);
create index if not exists client_cycles_service_id_idx on public.client_cycles (service_id);
create index if not exists client_notes_appointment_id_idx on public.client_notes (appointment_id);
create index if not exists client_notes_author_id_idx on public.client_notes (author_id);
create index if not exists client_notes_client_id_idx on public.client_notes (client_id);
create index if not exists client_reviews_client_id_idx on public.client_reviews (client_id);
create index if not exists client_subscriptions_client_id_idx on public.client_subscriptions (client_id);
create index if not exists client_subscriptions_plan_id_idx on public.client_subscriptions (plan_id);
create index if not exists clients_user_id_idx on public.clients (user_id);
create index if not exists commissions_professional_id_idx on public.commissions (professional_id);
create index if not exists commissions_ticket_item_id_idx on public.commissions (ticket_item_id);
create index if not exists consents_client_id_idx on public.consents (client_id);
create index if not exists health_records_client_id_idx on public.health_records (client_id);
create index if not exists invites_invited_by_idx on public.invites (invited_by);
create index if not exists loyalty_entries_appointment_id_idx on public.loyalty_entries (appointment_id);
create index if not exists loyalty_entries_client_id_idx on public.loyalty_entries (client_id);
create index if not exists loyalty_entries_created_by_idx on public.loyalty_entries (created_by);
create index if not exists media_appointment_id_idx on public.media (appointment_id);
create index if not exists media_client_id_idx on public.media (client_id);
create index if not exists media_consent_id_idx on public.media (consent_id);
create index if not exists media_created_by_idx on public.media (created_by);
create index if not exists messages_client_id_idx on public.messages (client_id);
create index if not exists package_uses_appointment_id_idx on public.package_uses (appointment_id);
create index if not exists package_uses_package_id_idx on public.package_uses (package_id);
create index if not exists package_uses_tenant_id_idx on public.package_uses (tenant_id);
create index if not exists packages_client_id_idx on public.packages (client_id);
create index if not exists packages_service_id_idx on public.packages (service_id);
create index if not exists payments_appointment_id_idx on public.payments (appointment_id);
create index if not exists payments_client_id_idx on public.payments (client_id);
create index if not exists payments_ticket_id_idx on public.payments (ticket_id);
create index if not exists professional_services_service_id_idx on public.professional_services (service_id);
create index if not exists professional_services_tenant_id_idx on public.professional_services (tenant_id);
create index if not exists professionals_user_id_idx on public.professionals (user_id);
create index if not exists quote_items_tenant_id_idx on public.quote_items (tenant_id);
create index if not exists quotes_converted_appointment_id_idx on public.quotes (converted_appointment_id);
create index if not exists quotes_created_by_idx on public.quotes (created_by);
create index if not exists service_categories_tenant_id_idx on public.service_categories (tenant_id);
create index if not exists service_products_product_id_idx on public.service_products (product_id);
create index if not exists service_products_tenant_id_idx on public.service_products (tenant_id);
create index if not exists services_category_id_idx on public.services (category_id);
create index if not exists stock_moves_created_by_idx on public.stock_moves (created_by);
create index if not exists stock_moves_product_id_idx on public.stock_moves (product_id);
create index if not exists subscription_plans_tenant_id_idx on public.subscription_plans (tenant_id);
create index if not exists tenant_modules_modulo_idx on public.tenant_modules (modulo);
create index if not exists ticket_items_product_id_idx on public.ticket_items (product_id);
create index if not exists ticket_items_professional_id_idx on public.ticket_items (professional_id);
create index if not exists ticket_items_service_id_idx on public.ticket_items (service_id);
create index if not exists ticket_items_ticket_id_idx on public.ticket_items (ticket_id);
create index if not exists tickets_appointment_id_idx on public.tickets (appointment_id);
create index if not exists tickets_client_id_idx on public.tickets (client_id);
create index if not exists tickets_created_by_idx on public.tickets (created_by);
create index if not exists tickets_professional_id_idx on public.tickets (professional_id);
create index if not exists time_off_professional_id_idx on public.time_off (professional_id);
create index if not exists waitlist_client_id_idx on public.waitlist (client_id);
create index if not exists waitlist_professional_id_idx on public.waitlist (professional_id);
create index if not exists waitlist_service_id_idx on public.waitlist (service_id);
create index if not exists wallet_entries_client_id_idx on public.wallet_entries (client_id);

-- ---------------------------------------------------------------------
-- PARTE 3 · a guarda, no mesmo desenho da 0005
--
-- Sem isto a Parte 2 é conserto de uma vez só: a próxima tabela nasce com
-- FK sem índice e a dívida recomeça — foi o que aconteceu depois da 0021.
-- O PostgREST não expõe o catálogo, então a descoberta passa por função,
-- exatamente como `tenant_rls_report()` faz para o teste de isolamento.
--
-- Casa por PREFIXO de propósito: um índice composto `(tenant_id, x)` NÃO
-- serve para uma busca só por `x`, e foi precisamente essa confusão que
-- causou o timeout da 0021.
-- ---------------------------------------------------------------------

create or replace function public.fk_sem_indice_report()
returns table (
  tabela      text,
  constraint_name text,
  colunas     text[]
)
language sql
stable
security definer
set search_path = public
as $$
  with fk as (
    select c.conrelid::regclass::text as tabela,
           c.conname::text as constraint_name,
           array_agg(a.attname order by k.ord) as colunas
    from pg_constraint c
    join lateral unnest(c.conkey) with ordinality k(attnum, ord) on true
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum
    where c.contype = 'f' and c.connamespace = 'public'::regnamespace
    group by c.conrelid, c.conname
  ),
  idx as (
    select i.indrelid::regclass::text as tabela,
           (select array_agg(a.attname order by k.ord)
              from unnest(i.indkey::int[]) with ordinality k(attnum, ord)
              join pg_attribute a on a.attrelid = i.indrelid and a.attnum = k.attnum) as colunas
    from pg_index i
  )
  select fk.tabela, fk.constraint_name, fk.colunas
  from fk
  where not exists (
    select 1 from idx
    where idx.tabela = fk.tabela
      and idx.colunas[1:array_length(fk.colunas, 1)] = fk.colunas
  )
  order by fk.tabela, fk.constraint_name;
$$;

-- Mesma restrição da 0005: introspecção de catálogo não é dado de produto.
-- Também evita criar uma função `security definer` alcançável por `anon`,
-- que é o aviso que o `get_advisors` levanta e que esta auditoria conferiu.
revoke all on function public.fk_sem_indice_report() from public, anon, authenticated;
grant execute on function public.fk_sem_indice_report() to service_role;
