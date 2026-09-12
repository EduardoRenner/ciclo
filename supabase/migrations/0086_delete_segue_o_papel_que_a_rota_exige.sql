-- =====================================================================
-- CICLO · o DELETE passa a exigir o mesmo papel que a rota (migration 0086)
--
-- Fecha o lote 2.3 do `docs/58`. As duas anteriores (`0084`, `0085`) tiraram
-- capacidade MORTA, que é aperto sem risco. Esta mexe em capacidade VIVA — e por
-- isso a régua não foi escolhida, foi DERIVADA.
--
-- ## De onde sai cada papel, e por que isso não é opinião
--
-- O `docs/58` marcava a matriz como "decisão do dono". Ela já estava decidida:
-- toda rota que apaga já chama `exigirPermissao(ctx.papel, ...)`. A RLS só passa
-- a concordar com a autorização que o app aplica desde sempre. Nenhum caminho
-- legítimo muda; o que fecha é o atalho pelo PostgREST, que ignora a rota.
--
--   tabela             rota que apaga                       exige                papéis
--   ─────────────────  ───────────────────────────────────  ───────────────────  ──────────────
--   portfolio_photos   (via revogarConsentimento)           client:update        owner, manager
--   message_templates  message-templates/[id]               client:update        owner, manager
--   service_products   services/[id]/consumption            service:update       owner, manager
--   business_hours     professionals/[id]/business-hours    professional:update  owner
--   time_off           time-off/[id]                        professional:update  owner
--   tenant_modules     tenant/modules                       tenant:update        owner
--
-- Três ficam em OWNER porque `rbac.ts` dá a `manager` o `professional:read` (não
-- o `:update`) e nenhum `tenant:*`. Não é aperto novo: é o que a rota já recusa.
--
-- ## media: capacidade morta, descoberta tarde
--
-- Ficou de fora da `0085` por excesso de cautela — a varredura contou "1 delete"
-- e eu não rastreei qual. Rastreado agora: é o do erase (`lgpd.ts:287`,
-- service_role). No app, remover foto é SOFT delete (`media.ts:46`, `update
-- deleted_at`). Entra aqui sem política de DELETE nenhuma, como as dez da `0085`.
--
-- ## portfolio_photos: três deletes, só um pelo cliente da sessão
--
-- `portfolio.ts:27` e `portfolio-upload.ts:85` rodam por `withTenant`
-- (service_role) — conferido: as duas funções nem recebem `db`. O único que passa
-- por RLS é `consentimentos.ts:151`, dentro de `revogarConsentimento`, cuja rota
-- exige `client:update`. Por isso a régua é a de cliente, e não uma de portfólio.
--
-- ## Ordem de publicação
--
-- Migration RESTRITIVA, e que morde papel: vai DEPOIS do deploy, nunca antes.
-- `delete` barrado por RLS devolve "sucesso, zero linhas", não erro — um erro de
-- régua aqui não grita, ele silencia.
-- =====================================================================

-- ---------------------------------------------------------------------
-- media e client_notes · o erase é quem apaga, e a rota dele exige client:delete
--
-- Aqui eu errei primeiro e um teste me pegou, o que vale registrar.
--
-- A primeira versão desta migration tirou o DELETE de `media` INTEIRO, com o
-- raciocínio de "capacidade morta": no app, remover foto é soft delete
-- (`media.ts:46`) e o erase roda por service_role. Está certo sobre produção e
-- errado sobre o produto. `tests/integration/lgpd.test.ts` guarda uma propriedade
-- deliberada — *"a limpeza do storage é autossuficiente mesmo se alguém chamar
-- `eliminarCliente` FORA da rota"* — e chama o serviço com um cliente de SESSÃO
-- de propósito. Com `media` sem política de delete, a linha sobrevivia.
--
-- O conserto certo não era afrouxar o teste (é assim que proteção morre calada),
-- era seguir a própria regra desta migration com mais fidelidade: a régua espelha
-- a rota, e a rota do erase (`clients/[id]/erase`) exige `client:delete` — que em
-- `rbac.ts` é owner + manager. Continua fechado para `professional` e `reception`,
-- que é o buraco que importava.
--
-- `client_notes` entra junto pelo mesmo motivo: ela está em `TABELAS_APAGADAS`
-- (`lgpd.ts`), a mesma lista de `media`, e a `0085` a deixou sem DELETE nenhum.
-- Nenhum teste cobria esse caminho — ele teria quebrado em silêncio no dia em que
-- alguém chamasse o erase fora da rota.
-- ---------------------------------------------------------------------
drop policy if exists media_tenant_all on public.media;
create policy media_select on public.media for select using (public.has_tenant(tenant_id));
create policy media_insert on public.media for insert with check (public.has_tenant(tenant_id));
create policy media_update on public.media for update using (public.has_tenant(tenant_id)) with check (public.has_tenant(tenant_id));
create policy media_delete on public.media for delete
  using (public.has_tenant(tenant_id) and public.tenant_role(tenant_id) in ('owner', 'manager'));

create policy client_notes_delete on public.client_notes for delete
  using (public.has_tenant(tenant_id) and public.tenant_role(tenant_id) in ('owner', 'manager'));

-- ---------------------------------------------------------------------
-- client:update / service:update → owner + manager
-- ---------------------------------------------------------------------
drop policy if exists portfolio_photos_tenant_all on public.portfolio_photos;
create policy portfolio_photos_select on public.portfolio_photos for select using (public.has_tenant(tenant_id));
create policy portfolio_photos_insert on public.portfolio_photos for insert with check (public.has_tenant(tenant_id));
create policy portfolio_photos_update on public.portfolio_photos for update using (public.has_tenant(tenant_id)) with check (public.has_tenant(tenant_id));
create policy portfolio_photos_delete on public.portfolio_photos for delete
  using (public.has_tenant(tenant_id) and public.tenant_role(tenant_id) in ('owner', 'manager'));

drop policy if exists message_templates_tenant_all on public.message_templates;
create policy message_templates_select on public.message_templates for select using (public.has_tenant(tenant_id));
create policy message_templates_insert on public.message_templates for insert with check (public.has_tenant(tenant_id));
create policy message_templates_update on public.message_templates for update using (public.has_tenant(tenant_id)) with check (public.has_tenant(tenant_id));
create policy message_templates_delete on public.message_templates for delete
  using (public.has_tenant(tenant_id) and public.tenant_role(tenant_id) in ('owner', 'manager'));

-- O delete da ficha de consumo é "troca o conjunto": apaga as linhas do serviço e
-- reinsere logo abaixo (`ficha-de-consumo.ts`). Sem ele, salvar a ficha quebra.
drop policy if exists service_products_tenant_all on public.service_products;
create policy service_products_select on public.service_products for select using (public.has_tenant(tenant_id));
create policy service_products_insert on public.service_products for insert with check (public.has_tenant(tenant_id));
create policy service_products_update on public.service_products for update using (public.has_tenant(tenant_id)) with check (public.has_tenant(tenant_id));
create policy service_products_delete on public.service_products for delete
  using (public.has_tenant(tenant_id) and public.tenant_role(tenant_id) in ('owner', 'manager'));

-- ---------------------------------------------------------------------
-- professional:update e tenant:update → owner
-- ---------------------------------------------------------------------
drop policy if exists business_hours_tenant_all on public.business_hours;
create policy business_hours_select on public.business_hours for select using (public.has_tenant(tenant_id));
create policy business_hours_insert on public.business_hours for insert with check (public.has_tenant(tenant_id));
create policy business_hours_update on public.business_hours for update using (public.has_tenant(tenant_id)) with check (public.has_tenant(tenant_id));
create policy business_hours_delete on public.business_hours for delete
  using (public.has_tenant(tenant_id) and public.tenant_role(tenant_id) = 'owner');

drop policy if exists time_off_tenant_all on public.time_off;
create policy time_off_select on public.time_off for select using (public.has_tenant(tenant_id));
create policy time_off_insert on public.time_off for insert with check (public.has_tenant(tenant_id));
create policy time_off_update on public.time_off for update using (public.has_tenant(tenant_id)) with check (public.has_tenant(tenant_id));
create policy time_off_delete on public.time_off for delete
  using (public.has_tenant(tenant_id) and public.tenant_role(tenant_id) = 'owner');

drop policy if exists tenant_modules_tenant_all on public.tenant_modules;
create policy tenant_modules_select on public.tenant_modules for select using (public.has_tenant(tenant_id));
create policy tenant_modules_insert on public.tenant_modules for insert with check (public.has_tenant(tenant_id));
create policy tenant_modules_update on public.tenant_modules for update using (public.has_tenant(tenant_id)) with check (public.has_tenant(tenant_id));
create policy tenant_modules_delete on public.tenant_modules for delete
  using (public.has_tenant(tenant_id) and public.tenant_role(tenant_id) = 'owner');

-- ---------------------------------------------------------------------
-- `waitlist` segue em `for all`, como a `0085` explica: é o controle positivo do
-- arnês de RLS. Quem for apertá-la move o controle para outra tabela permissiva
-- NO MESMO PR, ou todas as asserções negativas do arquivo ficam vazias de uma vez.
-- ---------------------------------------------------------------------
