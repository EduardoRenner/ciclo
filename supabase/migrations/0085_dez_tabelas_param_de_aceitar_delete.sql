-- =====================================================================
-- CICLO · dez tabelas param de aceitar DELETE pelo PostgREST (migration 0085)
--
-- Terceiro e maior lote do mesmo aperto seguro que a `0080` inaugurou e a `0084`
-- continuou: **tirar capacidade morta**. Nenhuma régua de papel muda aqui.
-- `select`, `insert` e `update` seguem exatamente como estavam, em
-- `has_tenant(tenant_id)`. Some só o DELETE, e só onde não existe caminho de app
-- que dependa dele.
--
-- ## Como "morta" foi estabelecido, e por que dá para confiar
--
-- Não por leitura tabela a tabela, que é como se erra. Pelo lado contrário:
-- enumerei **todos os 17 `.delete()` do `src/`** e atribuí cada um à sua tabela.
-- As tabelas que aparecem nessa lista ficaram DE FORA deste lote:
--
--   portfolio_photos(3) · push_subscriptions(2) · idempotency_keys(2) · time_off
--   ticket_items · tenants · tenant_modules · service_products · message_templates
--   media · health_records · business_hours
--
-- Um dos 17 não tinha tabela literal: `lgpd.ts:296` faz `db.from(tabela).delete()`
-- num laço sobre `TABELAS_APAGADAS = ['client_notes','waitlist','portfolio_photos']`.
-- Foi o que quase passou batido, e é por isso que a contagem (17 no total, 16
-- atribuídos) importou mais que a leitura.
--
-- `client_notes` está nesse laço — mas `eliminarCliente` roda por `withTenant` e
-- `withNovoTenant`, os dois service_role, que não passam por RLS. Continua neste
-- lote, com a justificativa certa: morta **para o cliente do usuário**, viva para
-- o erase. `waitlist` fica de fora por outro motivo (ver no fim).
--
-- ## O que NÃO muda, e é decisão consciente
--
-- Nada de estreitar por papel. A matriz do `docs/58` continua sendo decisão do
-- dono, pelo motivo registrado em `DECISOES.md` na 0084: escolher papel errado
-- esvazia tela sem erro nenhum.
-- =====================================================================

-- ---------------------------------------------------------------------
-- A base de clientes. O produto promete que "a base é sua"; o PostgREST
-- discordava. Apagar cliente é `deleted_at` (soft delete) em todo o código, e o
-- erase da LGPD ANONIMIZA a linha em vez de removê-la, para o vínculo fiscal
-- sobreviver sem o vínculo pessoal. Nenhum `.delete()` em `clients` existe.
-- ---------------------------------------------------------------------
drop policy if exists clients_tenant_all on public.clients;
create policy clients_select on public.clients for select using (public.has_tenant(tenant_id));
create policy clients_insert on public.clients for insert with check (public.has_tenant(tenant_id));
create policy clients_update on public.clients for update using (public.has_tenant(tenant_id)) with check (public.has_tenant(tenant_id));

-- ---------------------------------------------------------------------
-- Histórico de mensagens. É o que prova o que foi enviado para quem — e o que
-- responde "essa cliente recebeu a campanha?". Só insert e update de status.
-- ---------------------------------------------------------------------
drop policy if exists messages_tenant_all on public.messages;
create policy messages_select on public.messages for select using (public.has_tenant(tenant_id));
create policy messages_insert on public.messages for insert with check (public.has_tenant(tenant_id));
create policy messages_update on public.messages for update using (public.has_tenant(tenant_id)) with check (public.has_tenant(tenant_id));

-- ---------------------------------------------------------------------
-- Campanhas enviadas. Mesma família do histórico: some a campanha, some a
-- explicação de por que aquelas mensagens saíram.
-- ---------------------------------------------------------------------
drop policy if exists campaigns_tenant_all on public.campaigns;
create policy campaigns_select on public.campaigns for select using (public.has_tenant(tenant_id));
create policy campaigns_insert on public.campaigns for insert with check (public.has_tenant(tenant_id));
create policy campaigns_update on public.campaigns for update using (public.has_tenant(tenant_id)) with check (public.has_tenant(tenant_id));

-- ---------------------------------------------------------------------
-- Anotações da recepção sobre a cliente. Apagada de propósito pelo erase da
-- LGPD (`TABELAS_APAGADAS`), que roda como service_role — fora do alcance desta
-- política. Pelo cliente da sessão, só insert e select.
-- ---------------------------------------------------------------------
drop policy if exists client_notes_tenant_all on public.client_notes;
create policy client_notes_select on public.client_notes for select using (public.has_tenant(tenant_id));
create policy client_notes_insert on public.client_notes for insert with check (public.has_tenant(tenant_id));
create policy client_notes_update on public.client_notes for update using (public.has_tenant(tenant_id)) with check (public.has_tenant(tenant_id));

-- ---------------------------------------------------------------------
-- Avaliações. Nota que sumiu é nota ruim que sumiu — e a média deixa de
-- significar alguma coisa. Responder é UPDATE.
-- ---------------------------------------------------------------------
drop policy if exists client_reviews_tenant_all on public.client_reviews;
create policy client_reviews_select on public.client_reviews for select using (public.has_tenant(tenant_id));
create policy client_reviews_insert on public.client_reviews for insert with check (public.has_tenant(tenant_id));
create policy client_reviews_update on public.client_reviews for update using (public.has_tenant(tenant_id)) with check (public.has_tenant(tenant_id));

-- ---------------------------------------------------------------------
-- Clube e pacotes: dinheiro já pago pela cliente. Cancelar assinatura é UPDATE
-- de `status` — o `lgpd.ts` declara `client_subscriptions` como "preserva:
-- vínculo contratual, obrigação de guarda", e o erase não a toca.
-- ---------------------------------------------------------------------
drop policy if exists client_subscriptions_tenant_all on public.client_subscriptions;
create policy client_subscriptions_select on public.client_subscriptions for select using (public.has_tenant(tenant_id));
create policy client_subscriptions_insert on public.client_subscriptions for insert with check (public.has_tenant(tenant_id));
create policy client_subscriptions_update on public.client_subscriptions for update using (public.has_tenant(tenant_id)) with check (public.has_tenant(tenant_id));

drop policy if exists packages_tenant_all on public.packages;
create policy packages_select on public.packages for select using (public.has_tenant(tenant_id));
create policy packages_insert on public.packages for insert with check (public.has_tenant(tenant_id));
create policy packages_update on public.packages for update using (public.has_tenant(tenant_id)) with check (public.has_tenant(tenant_id));

drop policy if exists subscription_plans_tenant_all on public.subscription_plans;
create policy subscription_plans_select on public.subscription_plans for select using (public.has_tenant(tenant_id));
create policy subscription_plans_insert on public.subscription_plans for insert with check (public.has_tenant(tenant_id));
create policy subscription_plans_update on public.subscription_plans for update using (public.has_tenant(tenant_id)) with check (public.has_tenant(tenant_id));

-- ---------------------------------------------------------------------
-- As duas de configuração que o app quase não toca. `professional_services`
-- recebe SÓ leitura em todo o `src/` (três consultas: ciclo, clube, comanda) e é
-- de onde sai a comissão por serviço de cada profissional. `service_categories`
-- não aparece em NENHUM arquivo de aplicação — só no `types.gen.ts`.
--
-- Nos dois casos insert/update também são capacidade morta hoje; ficam abertos
-- mesmo assim, porque "não tem escritor ainda" é diferente de "não pode ter", e
-- fechar o que ainda vai nascer é como se cria trabalho de desfazer.
-- ---------------------------------------------------------------------
drop policy if exists professional_services_tenant_all on public.professional_services;
create policy professional_services_select on public.professional_services for select using (public.has_tenant(tenant_id));
create policy professional_services_insert on public.professional_services for insert with check (public.has_tenant(tenant_id));
create policy professional_services_update on public.professional_services for update using (public.has_tenant(tenant_id)) with check (public.has_tenant(tenant_id));

drop policy if exists service_categories_tenant_all on public.service_categories;
create policy service_categories_select on public.service_categories for select using (public.has_tenant(tenant_id));
create policy service_categories_insert on public.service_categories for insert with check (public.has_tenant(tenant_id));
create policy service_categories_update on public.service_categories for update using (public.has_tenant(tenant_id)) with check (public.has_tenant(tenant_id));

-- ---------------------------------------------------------------------
-- `waitlist` continua em `for all` DE PROPÓSITO, e não é esquecimento.
--
-- Ela é o controle positivo de `tests/rls/append-only-nao-se-apaga.test.ts`: um
-- arquivo que só afirma "não apagou" passa verde num arnês cego. O caso que
-- apaga da waitlist de verdade é o que prova que o teste enxerga a diferença.
-- Apertar a waitlist sem trocar o controle por outra tabela permissiva cegaria
-- todas as asserções negativas deste arquivo de uma vez.
--
-- (Ela também é apagada pelo erase da LGPD, via service_role.)
-- ---------------------------------------------------------------------
