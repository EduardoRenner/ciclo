# 57 · Plano de execução autônoma — o que falta pro CICLO cobrar do primeiro cliente

Escrito em 2026-09-09, depois de a CI de `main` ser recuperada e o repo tornado público. É o
playbook para uma sessão ir seguindo PR por PR **sem re-investigar**. Cada PR abaixo tem: arquivos,
o que faz, testes, critério de pronto, e o check da CI que decide.

---

## Como o loop funciona

O repo é público → **a CI roda de graça em todo PR**, e o job `Banco e RLS` sobe um Supabase
efêmero do zero, aplica TODAS as migrations do disco e roda `test:integration` + `test:rls`. **A CI
é o banco de teste com schema completo.** Não precisa de Docker local nem do DEV alinhado.

```
1. pega o próximo PR da fila
2. implementa
3. local: pnpm typecheck && pnpm lint && pnpm test:unit && pnpm build   (o que não precisa de banco)
4. git push → abre o PR → a CI roda a suíte COMPLETA
5. verde → "pronto pra merge", segue. vermelho → conserta, empurra, volta ao 4.
6. quando o Eduardo aparecer: ele mergeia os verdes em lote e roda `supabase db push`
7. rebase do que sobrou (git merge origin/main — resolve o append de DECISOES sozinho), re-verifica
```

## Portões de segurança (todo PR)

1. **Nunca mergear.** Deploy em produção é decisão humana.
2. **Migration restritiva → PR próprio**, com bloco no cabeçalho listando o que foi conferido
   linha a linha (ver `docs/DECISOES.md` 2026-09-08/09 — o padrão das 0073/0075/0079/0080).
3. **Toda guarda nova vista reprovando** (mutação), registrada no corpo do PR.
4. **Zero migration destrutiva** (drop column, rewrite de dado). Só aditiva ou
   remoção-de-capacidade-comprovadamente-morta.
5. **Asserção de RLS olha o ESTADO pelo cliente admin, nunca o `error`** — sob RLS um
   `update`/`delete` sem linha permitida devolve **sucesso com zero linhas**. E o fixture tem que
   nascer com valor que permita a asserção FALHAR (o "0 vs 0" que quase passou na 0075).
6. **Código de dinheiro:** valor conferido contra o catálogo (`valorConfereComDegrau`, já existe),
   webhook idempotente, assinatura `x-signature` verificada e testada com vetor conhecido.
7. **Nenhuma escrita minha no banco de produção.** Migration = arquivo no PR; o Eduardo aplica.

---

## BLOCO 0 — destravar (Eduardo, ~5 min)

- Mergear os PRs verdes que estiverem abertos.
- `supabase link --project-ref eqzlvthzdjnsbogymcsw && supabase db push` a cada lote mergeado.
  Alternativa permanente: criar `.github/workflows/deploy-migrations.yml` do
  `docs/runbooks/aplicar-migrations-pendentes.md` / handoff — agora que o repo é público roda de
  graça. Secrets: `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, var `SUPABASE_PROJECT_REF`.

---

## BLOCO 1 — Assinatura Mercado Pago, a metade com I/O

Núcleo puro já feito e em produção (PR #81: `src/core/billing/mercado-pago.ts` — `decidirPlano`,
`valorConfereComDegrau`, `lerNotificacaoMP`, `lerAssinatura`, formato de `tenants.settings.assinatura`).
**Sem migration** (jsonb em `settings`, decidido no #81).

### PR 1.1 — cliente da API do MP + verificação de assinatura
**Arquivos:**
- `src/server/billing/mercado-pago.ts` (novo) — confinado como `with-tenant.ts`: único lugar que lê
  `MERCADOPAGO_ACCESS_TOKEN`.
  - `criarPreapproval({ tenant, tier, payerEmail, backUrl })` → `POST {BASE}/preapproval` com
    `auto_recurring: { frequency: 1, frequency_type: 'months', transaction_amount: valorMensalEmReais(tier), currency_id: 'BRL' }`,
    `reason`, `external_reference: tenantId`, `back_url`. Devolve `{ preapprovalId, initPoint }`.
  - `consultarPreapproval(id)` → `GET {BASE}/preapproval/{id}` → `{ status, transaction_amount, external_reference }`.
  - `consultarPagamento(id)` → `GET {BASE}/v1/payments/{id}` (para o evento `payment`).
  - `verificarAssinaturaWebhook({ xSignature, xRequestId, dataId })` — HMAC-SHA256 com
    `MERCADOPAGO_WEBHOOK_SECRET` sobre o *manifest* `id:{dataId};request-id:{xRequestId};ts:{ts};`
    (o `ts` e o `v1` saem do header `x-signature: ts=...,v1=...`). Compara `timingSafeEqual`.
- `.env.example` — já tem `MERCADOPAGO_*` (PR #81).
- regra de lint `ciclo/service-client-confinado` — estender pra pegar `MERCADOPAGO_ACCESS_TOKEN`
  fora deste arquivo (espelha o que já faz com `SUPABASE_SERVICE_ROLE_KEY`).

**Testes:** `tests/unit/server/mercado-pago-assinatura-webhook.test.ts` — vetor conhecido de
`x-signature` (montar `ts`+`v1` com o segredo de teste e provar que valida; mutar 1 byte e provar
que rejeita). `fetch` mockado para os 3 GET/POST.

**Pronto quando:** `test:unit` verde; a regra de lint reprova um `MERCADOPAGO_ACCESS_TOKEN` plantado
noutro arquivo.

### PR 1.2 — service + rotas
**Arquivos:**
- `src/server/services/assinatura.ts` (novo):
  - `iniciarAssinatura(tenantId, tier, papel)` — exige `owner` (`rbac`), chama `criarPreapproval`,
    grava `settings.assinatura = { provedor:'mercado_pago', preapproval_id, plano_contratado:tier, status:'pending', atualizado_em }`, devolve `initPoint`. `audit_log` `tenant.subscription.start`.
  - `processarWebhookMP(evento)` — `lerNotificacaoMP` já normaliza. Para `subscription`:
    `consultarPreapproval`, confere `external_reference === tenantId` e
    `valorConfereComDegrau(plano_contratado, transaction_amount)` (senão: `audit_log` de suspeita e
    ignora). `decidirPlano(status, contratado, tenants.plan)` → grava `tenants.plan` + `settings.assinatura.status`
    + (se `emGraca`) `settings.assinatura.graca_ate = hoje+7d`. `audit_log` `tenant.plan.change` com `por:'webhook_mp'`.
  - `expirarGraca()` — chamada por um cron (ver Bloco 3): assinaturas `paused` com `graca_ate < hoje` → `tenants.plan = 'gratis'`.
  - Idempotência: guardar `settings.assinatura.ultimo_evento_id`; evento repetido → no-op.
- `src/app/api/v1/billing/assinar/route.ts` (novo) — `POST`, `exigirPermissao(papel, 'tenant:update')` (owner),
  Zod `{ tier: 'essencial'|'equipe'|'avancado' }`, `comIdempotencia`, devolve `{ initPoint }`.
- `src/app/api/v1/webhooks/mercado-pago/route.ts` (novo) — `POST`, **público** (fora do middleware
  de sessão, como `/api/cron/*`), lê headers `x-signature`/`x-request-id`, valida, chama
  `processarWebhookMP`. **Sempre responde 200** a evento válido mas não-reconhecido (4xx faz o MP
  retentar pra sempre). 401 só quando a assinatura não bate.
  - `naoCacheavel()` e `precisaRenovarSessao()` em `middleware.ts` já cobrem `/api/*` — conferir
    que `/api/webhooks/*` cai na mesma regra (cai: `startsWith('/api/')`).

**Testes:** `tests/integration/assinatura.test.ts` — webhook fake `authorized` → `tenants.plan`
vira o contratado; `paused` → mantém + `graca_ate`; `cancelled` → `gratis`; valor adulterado →
plano NÃO muda + linha de auditoria; evento repetido → no-op.

**Pronto quando:** `test:integration` verde na CI.

### PR 1.3 — fiação da tela `/admin/config/meu-plano`
**Arquivos:**
- `src/app/admin/config/meu-plano/page.tsx` — hoje **deliberadamente sem botão "assinar"** (o
  comentário no topo diz "Quando a cobrança existir, é aqui que ela entra"). Adicionar:
  - se `tenants.plan === 'gratis'` (ou abaixo do desejado): botões "Assinar {NOME}" → chama
    `/api/v1/billing/assinar` → `window.location = initPoint`.
  - se assinado: badge do status. `paused` → aviso "pagamento com problema, resolve até {graca_ate}"
    com link pro `init_point` do MP.
  - cancelar: link pro painel do MP do assinante (`/preapproval/{id}` não cancela via API sem
    escopo; a Fase K exige que cancelar custe os mesmos toques que assinar — um link direto serve).
- `src/lib/planos-cartoes.ts` / `CARTOES` — já existe, reusar.
- Atualizar o comentário-manifesto no topo da página (tirar "não fingir que integração está pronta").

**Testes:** `tests/unit/design/meu-plano-tem-porta-de-upgrade.test.ts` — a tela renderiza um
caminho de assinar quando `plano === 'gratis'`. (Casa com o USO — `/api/v1/billing/assinar` na
chamada, não o nome solto.)

**Depois do Bloco 1 (Eduardo):** criar `MERCADOPAGO_ACCESS_TOKEN` + `MERCADOPAGO_WEBHOOK_SECRET`
(sandbox `TEST-...` primeiro), configurar o webhook em `https://seuciclo.com.br/api/webhooks/mercado-pago`
no painel do MP, fazer 1 assinatura de teste ponta a ponta. `docs/18` §J.4 deixou o Pix Automático
"bloqueado até confirmar no sandbox" — esse é o teste.

---

## BLOCO 2 — RLS: as políticas cegas a papel

`docs/DECISOES.md` (2026-09-09) registra: a varredura achou 40 tabelas; 0073/0075/0079/0080
fecharam `tickets`, `ticket_items`, `professionals`, `services`, `products`, `commissions` (select),
`payments` (select), `stock_moves`, `appointments` (delete). **Sobram estas 26 com `_tenant_all:ALL`**
(medido em produção em 2026-09-09):

```
business_hours, campaigns, client_cycles, client_notes, client_reviews,
client_subscriptions, clients, consents, cycle_predictions, health_records,
loyalty_entries, media, message_templates, messages, monthly_profit,
package_uses, packages, portfolio_photos, professional_services,
service_categories, service_products, subscription_plans, tenant_modules,
time_off, waitlist, wallet_entries
```

### Método (o mesmo das 0075/0080 — não inventar)
Para cada tabela, **antes de escrever a migration**:
1. `grep -rn "from('<tabela>')" src` — listar TODO leitor e escritor.
2. Classificar cada caminho: passa por `withTenant`/`service_role` (RLS não toca) ou por
   `criarClienteDoUsuario()` (RLS toca)?
3. A régua é o **`src/server/auth/rbac.ts`**, papel por papel — **nunca** `can_see_ticket`
   (que libera `reception`).
4. Só apertar o que a análise prova seguro. `delete`/`update` barrado por RLS **não grita** —
   devolve zero linhas.

### Lote 2.1 — capacidade morta (baixo risco, 1 migration)
Tabelas onde o app só faz `select`/`insert` (nunca `update`/`delete` pelo cliente do usuário) —
recortar `_tenant_all` em `select`+`insert`, sem `update`/`delete` (ausência de política = negação,
igual `stock_moves` na 0080). **Confirmar cada uma pelo grep antes.** Candidatas fortes:
`cycle_predictions` (append-only por design, `0064`), `monthly_profit` (append-only, `0071` — mas
ver a ressalva do congelamento abaixo), `loyalty_entries`, `package_uses`, `client_cycles`
(o Motor reescreve via `withTenant`? conferir), `wallet_entries`.
- **Ressalva `monthly_profit`:** o `insert` é feito pela recepção com o cliente do usuário dentro
  de um `.catch()` que só avisa (`docs/DECISOES.md` 2026-09-09). Manter `insert` em `has_tenant`
  (todo papel), tirar só `update`/`delete`. E a LEITURA — profissional/recepção veem o lucro do
  salão pelo PostgREST contra `lucro-nao-vaza-para-quem-atende` — vira `select` restrito a
  `owner`/`manager`/`finance` (a mesma régua da view `v_recover_revenue`).

### Lote 2.2 — leitura sensível por papel (1 migration)
- `clients` — recepção e profissional leem legitimamente (agenda, comanda). Mas `document` (CPF),
  `address`, `emergency_contact`, `notes` (pode ter alergia)... a `0077` já tirou coluna sensível
  do grant. Conferir se sobra algo. Provável: deixar como está (o app inteiro depende).
- `consents` / `health_records` / `media` — **dado de saúde / LGPD**. `health_records` é o caso
  duro: o erase da LGPD (`clients/[id]/erase/route.ts`) apaga com o cliente do **usuário**.
  Apertar o `delete` por papel quebraria o direito ao esquecimento em silêncio. **Solução:** mover
  o erase para `withTenant` (service_role, depois da checagem de permissão da rota — o mesmo
  desenho da `0077`), e SÓ ENTÃO apertar a política. Este é um PR de 2 partes: (a) rota usa
  service_role, (b) migration aperta. Ordem importa (código antes).
- `messages` / `message_templates` / `campaigns` — conteúdo de mensagem. Quem manda campanha é
  `owner`/`manager` (`campaign:*` no rbac). Restringir `select`/`insert`/`update`/`delete` à régua
  do rbac.

### Lote 2.3 — decisão do Eduardo (matriz de papéis)
Levantar, para `health_records`, `consents`, `media`, `client_notes`, `client_reviews`,
`subscription_plans`, `client_subscriptions`: o que cada papel (`owner`/`manager`/`professional`/
`reception`/`finance`) **faz hoje** com a tabela, e mandar a matriz pro Eduardo decidir o alvo.
Só depois implementar. **Único ponto de decisão dele na Fase RLS.**

### Deixar como está, de propósito
`business_hours`, `service_categories`, `service_products`, `professional_services`, `packages`,
`time_off`, `waitlist`, `portfolio_photos`, `tenant_modules` — config compartilhada do salão que
todo papel operacional legitimamente mexe. Apertar seria fricção sem risco. **Registrar a decisão
no DECISOES** pra não voltar a olhar.

### Guarda por lote
`tests/rls/<lote>.test.ts` — ator `professional` e `reception` LOGADOS (não `owner`), asserção pelo
estado via cliente admin, fixture que pode falhar. Mutação vista reprovando. O `isolation.test.ts`
continua sendo o de ENTRE-tenant; este é o de DENTRO.

---

## BLOCO 3 — dev DB + guardas de infra

### PR 3.1 — `expirarGraca` no agendador externo
O Bloco 1 criou `expirarGraca()`. Adicionar `src/app/api/cron/expirar-graca/route.ts` (mesmo
padrão de `recompute-cycles`: `Authorization: Bearer CRON_SECRET`). Documentar no
`docs/runbooks/cron-externo.md` que precisa de um 3º job no cron-job.org (1×/dia).

### PR 3.2 — guarda de "produção atrás do código" no PR
Um passo no `ci.yml`... **não posso escrever `.github/workflows/`** (classificador). Alternativa:
`scripts/conferir-schema-prod.mjs` que bate em `https://seuciclo.com.br/api/health`, lê
`checks.schema`, e sai 1 se `ok:false`. Documentar pro Eduardo rodar / pôr num Action.

### Nota pro Eduardo — alinhar o DEV
```
supabase link --project-ref <REF-DO-DEV>   # provável: uxphfgzinnbzvejwqhia
supabase db push
```
Destrava sessões futuras rodarem `test:integration`/`test:rls` local. Não bloqueia o loop (a CI
cobre), mas some com o susto de "reprova por schema velho".

---

## BLOCO 4 — itens de produto do `docs/55` que sobraram

Levantar o `docs/55` (Fase 2/3) e o `docs/31` contra o estado atual, separar "código" de "decisão",
e fazer os de código em PRs pequenos. Não detalhado aqui porque muda conforme os Blocos 1–3 andam.

---

## Ordem e dependências

```
BLOCO 0 (Eduardo) ──┐
                     ├─► BLOCO 1 (MP): 1.1 → 1.2 → 1.3   [independente do resto]
                     ├─► BLOCO 2 (RLS): 2.1 → 2.2 → (2.3 espera Eduardo)
                     └─► BLOCO 3: 3.1 depende de 1.1/1.2 (usa expirarGraca)

Merge em lote pelo Eduardo a cada 3–5 PRs verdes. `db push` junto.
Credenciais MP/WhatsApp: só depois do Bloco 1 code estar mergeado.
```

## Para começar

O loop pode arrancar assim que o Bloco 0 estiver feito (merge dos PRs abertos + `db push`). O
primeiro alvo é **PR 1.1**.
