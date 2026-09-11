-- =====================================================================
-- CICLO · dado de saúde e consentimento não se apagam pelo PostgREST (0084)
--
-- Fecha o lote 2.3 do `docs/58-RLS-LOTE-2-3-MATRIZ.md` na parte que NÃO depende
-- de decisão do dono. A `0080` fez isto para `stock_moves` e `appointments` e
-- registrou, com todas as letras, por que `health_records` ficou de fora:
--
--   "`health_records` é o exemplo vivo: o erase da LGPD apaga a ficha de saúde
--    com o cliente do USUÁRIO, então apertar ali às cegas transformaria
--    'direito ao esquecimento' em `rowsRemoved: 0` com HTTP 200. Fica registrado
--    para quando houver banco de dev para verificar."
--
-- Duas coisas mudaram desde então, e as duas foram conferidas antes desta linha
-- ser escrita:
--
--   1. O passo de CÓDIGO do `docs/58` (§Caminho recomendado, item 1) já foi
--      feito em 2026-09-09: `clients/[id]/erase/route.ts` passou a chamar
--      `eliminarCliente` por `withTenant` (service_role), e o docstring da rota
--      diz exatamente que foi para este aperto não alcançar o erase.
--   2. Existe banco de dev, e o teste que acompanha esta migration exercita o
--      erase DEPOIS do aperto — que é a verificação que a `0080` pediu.
--
-- ## Por que é seguro: a capacidade que sai está morta
--
-- Conferido linha a linha no fonte, 2026-09-10:
--
--   * `health_records` — o ÚNICO `.delete()` do projeto está em `lgpd.ts:291`,
--     dentro de `eliminarCliente`. Essa função tem dois chamadores, e os dois
--     rodam como service_role: `withTenant` na rota de erase e `withNovoTenant`
--     no cron `lgpd-retention`. Nenhum caminho do app apaga ficha de saúde pelo
--     cliente da sessão.
--   * `consents` — não existe `.delete()` em `consents` em lugar nenhum do
--     código. Revogar é UPDATE de `revoked_at` (`consentimentos.ts`), e é assim
--     que tem que ser: consentimento revogado é PROVA de que foi concedido um
--     dia, e apagar a linha destrói a prova que a LGPD pede.
--
-- Tirar capacidade morta é o aperto mais seguro que existe — não há caminho para
-- quebrar. `select`, `insert` e `update` seguem exatamente como estavam.
--
-- ## O que esta migration deliberadamente NÃO faz
--
-- O `docs/58` também propõe estreitar por PAPEL (`vault:own` para a anamnese,
-- `client:*` para consentimento). Isso NÃO entra aqui, e a razão é a mesma que a
-- `0080` deu para adiar: escolher papel errado quebra o app de um jeito que não
-- grita. Exemplo concreto medido: `fichaDoCliente` (`crm.ts`) monta a ficha com
-- `statusConsentimentos`; se `select` em `consents` virasse `client:read`, um
-- `professional` (que tem `client:own`, não `client:read`) abriria a ficha com a
-- seção de consentimentos VAZIA — sem erro, sem aviso, parecendo "essa cliente
-- não consentiu nada".
--
-- O próprio `docs/58` marca a régua de papéis como **decisão do dono** ("o
-- `professional` deve mesmo ler/escrever a anamnese?"). Decisão pendente não
-- vira migration.
-- =====================================================================

-- ---------------------------------------------------------------------
-- health_records — dado de saúde, categoria especial da LGPD
-- ---------------------------------------------------------------------
drop policy if exists health_records_tenant_all on public.health_records;

create policy health_records_select on public.health_records
  for select using (public.has_tenant(tenant_id));

create policy health_records_insert on public.health_records
  for insert with check (public.has_tenant(tenant_id));

-- `update` é metade do `upsert` que salva a anamnese (`anamnese.ts`); sem ela,
-- editar uma ficha existente falharia.
create policy health_records_update on public.health_records
  for update using (public.has_tenant(tenant_id)) with check (public.has_tenant(tenant_id));

-- sem DELETE: o erase da LGPD e o cron de retenção são service_role.

-- ---------------------------------------------------------------------
-- consents — o registro de consentimento
-- ---------------------------------------------------------------------
drop policy if exists consents_tenant_all on public.consents;

create policy consents_select on public.consents
  for select using (public.has_tenant(tenant_id));

create policy consents_insert on public.consents
  for insert with check (public.has_tenant(tenant_id));

-- Revogar é UPDATE (`revoked_at`), e o erase redige `ip`/`user_agent` na linha.
create policy consents_update on public.consents
  for update using (public.has_tenant(tenant_id)) with check (public.has_tenant(tenant_id));

-- sem DELETE: consentimento revogado continua sendo prova de que existiu.
