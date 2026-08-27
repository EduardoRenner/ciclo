# 02 · CONTRATOS DE API

Base: `/api/v1`. Tudo JSON, `Content-Type: application/json`. Textos de erro em pt-BR.

---

### 1. Convenções

#### Envelope de resposta

```jsonc
// sucesso
{ "data": { ... }, "meta": { "requestId": "req_01H..." } }

// sucesso paginado
{ "data": [ ... ], "meta": { "requestId": "...", "nextCursor": "eyJ...", "total": 312 } }

// erro
{ "error": { "code": "SLOT_TAKEN", "message": "Esse horário acabou de ser reservado.",
             "details": { "alternatives": ["2026-08-20T18:00:00Z"] } },
  "meta": { "requestId": "..." } }
```

#### Headers

| Header | Quando | Observação |
|---|---|---|
| `Authorization: Bearer <jwt>` | rotas autenticadas | JWT do Supabase |
| `X-Tenant-Id` | rotas autenticadas | Servidor **revalida** o membership; nunca confia |
| `Idempotency-Key` | **obrigatório** em POST/PATCH/DELETE | UUID v4 gerado no cliente |
| `X-Client-Version` | sempre | para forçar atualização de PWA antigo |

#### Códigos de erro (lista fechada — não invente novos sem adicionar aqui)

| Code | HTTP | Significado |
|---|---|---|
| `UNAUTHENTICATED` | 401 | Sem sessão válida |
| `MFA_REQUIRED` | 401 | Ação sensível exige AAL2 |
| `FORBIDDEN` | 403 | Sem permissão para o papel |
| `TENANT_MISMATCH` | 403 | Recurso é de outro tenant |
| `NOT_FOUND` | 404 | |
| `VALIDATION_ERROR` | 422 | `details.fields` com erro por campo |
| `SLOT_TAKEN` | 409 | Horário ocupado; devolve alternativas |
| `INVALID_TRANSITION` | 422 | Transição de estado ilegal |
| `IDEMPOTENCY_KEY_REUSED` | 422 | Mesma chave, payload diferente |
| `DEPOSIT_REQUIRED` | 402 | Precisa pagar sinal para confirmar |
| `PAYMENT_FAILED` | 402 | |
| `RATE_LIMITED` | 429 | `Retry-After` no header |
| `PLAN_LIMIT` | 402 | Estourou limite do plano |
| `OPT_OUT` | 422 | Cliente pediu para não receber mensagem |
| `VAULT_LOCKED` | 423 | Cofre exige reautenticação |
| `ASSISTANT_UNAVAILABLE` | 503 | Assistente sem credencial ou provedor fora do ar (docs/26 §4.4) |
| `INTERNAL` | 500 | Nunca vazar stack trace |

#### Paginação
Cursor opaco (`?cursor=&limit=`), limite padrão 50, máximo 200. Nunca offset em lista grande.

---

### 2. Endpoints

#### 2.1 Autenticação e conta

```
POST   /api/v1/auth/signup            { email, password, fullName, phone }
POST   /api/v1/auth/login             { email, password }        → { session, tenants[] }
POST   /api/v1/auth/logout
POST   /api/v1/auth/password/forgot   { email }                    → sempre 200, sem dizer se o e-mail existe
POST   /api/v1/auth/password/reset    { password }                 (sessão do link de recuperação)
POST   /api/v1/auth/mfa/enroll                                    → { qrCode, secret }
POST   /api/v1/auth/mfa/verify        { code }
GET    /api/v1/me                                                 → { profile, memberships[], activeTenant }
POST   /api/v1/onboarding             { businessName, vertical, slug, timezone }
                                      → cria tenant + aplica pack + gera DEK
```

#### 2.2 Agenda

```
GET  /api/v1/appointments?from=&to=&professionalId=&status=
GET  /api/v1/availability?serviceId=&professionalId=&date=&days=7
     → { slots: [{ startsAt, endsAt, professionalId }] }

POST /api/v1/appointments
  body: { clientId?, clientDraft?: {name, phone}, serviceId, professionalId,
          startsAt, origin, note? }
  201  → { appointment, deposit?: { paymentId, pixQr, pixCopyPaste, expiresAt } }
  409  SLOT_TAKEN  details.alternatives = 3 horários mais próximos

PATCH  /api/v1/appointments/:id       { startsAt?, professionalId?, note? }   (remarcar)
POST   /api/v1/appointments/:id/confirm
POST   /api/v1/appointments/:id/arrive
POST   /api/v1/appointments/:id/complete    → cria/retorna a comanda
POST   /api/v1/appointments/:id/no-show
DELETE /api/v1/appointments/:id       { reason, canceledBy }
```

**Regra de remarcação:** validar de novo disponibilidade e política de antecedência. Se houver sinal pago e a remarcação for do profissional, o sinal segue para o novo horário automaticamente.

#### 2.3 Clientes e CRM

```
GET    /api/v1/clients?q=&segment=&tag=&cursor=
POST   /api/v1/clients                { name, phone, email?, birthDate?, source?, tags? }
GET    /api/v1/clients/:id            → ficha 360° (sem cofre)
PATCH  /api/v1/clients/:id
DELETE /api/v1/clients/:id            soft delete
POST   /api/v1/clients/import         multipart CSV → { imported, skipped, errors[] }
POST   /api/v1/clients/merge          { keepId, mergeId }   (duplicadas)
GET    /api/v1/clients/:id/timeline?cursor=
POST   /api/v1/clients/export         🔐 AAL2 + auditado + 1×/mês
```

#### 2.4 Motor de Ciclo

```
GET  /api/v1/cycle/recover?state=&limit=
     → { totalValueCents, count, items: [{ clientId, name, phone, serviceName,
                                            state, lateDays, valueCents, lastCampaignAt }] }
POST /api/v1/cycle/recover/send
     body: { clientIds: [], mode: 'ai' | 'template', templateId?, offerSlots?: bool }
     → { queued, skipped: [{ clientId, reason: 'opt_out' | 'rate_limited' }] }
POST /api/v1/cycle/recompute          (admin/dev; em prod é job)
```

#### 2.5 Comanda e pagamento

```
POST   /api/v1/tickets                        { clientId?, appointmentId?, professionalId }
POST   /api/v1/tickets/:id/items              { serviceId? | productId?, qty, unitPriceCents?, professionalId? }
DELETE /api/v1/tickets/:id/items/:itemId
PATCH  /api/v1/tickets/:id                    { discountCents?, tipCents? }
POST   /api/v1/tickets/:id/close              → calcula custo, comissão, baixa estoque
POST   /api/v1/tickets/:id/pay                { method, amountCents, installments? }
                                              → pix: { pixQr, pixCopyPaste, expiresAt }
POST   /api/v1/tickets/:id/refund             { amountCents, reason }  🔐
GET    /api/v1/cash/daily?date=
GET    /api/v1/cash/summary?month=
```

#### 2.6 Estoque

```
GET  /api/v1/products?lowStock=true
POST /api/v1/products
POST /api/v1/products/:id/moves       { kind, qty, unitCostCents?, note? }
GET  /api/v1/products/alerts          → ponto de pedido + validade
```

#### 2.7 Cofre e LGPD

```
GET    /api/v1/clients/:id/vault           🔐 AAL2 → descriptografa e registra acesso
PUT    /api/v1/clients/:id/vault           { formKey, answers: {} }
POST   /api/v1/clients/:id/consents        { kind, version, granted, signatureBase64? }
DELETE /api/v1/clients/:id/consents/:kind  (revogar)
POST   /api/v1/clients/:id/media           multipart → strip EXIF, bucket privado
GET    /api/v1/media/:id/url               → signed URL 5 min (registra acesso)
GET    /api/v1/clients/:id/data-export     → JSON + PDF (direito de acesso/portabilidade)
POST   /api/v1/clients/:id/erase           🔐 anonimiza; mantém o que a lei exige
GET    /api/v1/clients/:id/vault-log       trilha de acesso, visível ao dono
```

#### 2.8 Público (sem autenticação — endurecer!)

```
GET  /api/v1/public/:slug                        → perfil, serviços, profissionais
GET  /api/v1/public/:slug/availability?serviceId=&date=
POST /api/v1/public/:slug/book                   { serviceId, professionalId?, startsAt,
                                                   name, phone, captchaToken }
     → { appointmentId, deposit?: {...} }
POST /api/v1/public/:slug/confirm/:token         (link do WhatsApp)
GET  /api/v1/public/:slug/anamnesis/:token       (cliente preenche antes de chegar)
```

**Proteções obrigatórias nessas rotas:**
- hCaptcha invisível + honeypot
- rate limit: 5 req/min por IP, 3 agendamentos por telefone por dia, 20 por IP por dia
- telefone validado (E.164 + DDD brasileiro válido)
- nunca expor `clientId`, telefone de outra pessoa ou lista de clientes
- resposta idêntica para "telefone já existe" e "telefone novo" (evita enumeração)

#### 2.9 Webhooks (entrada)

```
POST /api/webhooks/asaas       assinatura HMAC no header, janela de replay 5 min
POST /api/webhooks/whatsapp    verificação de assinatura Meta (X-Hub-Signature-256)
```

Fluxo obrigatório em ambos:
1. Validar assinatura → 401 se falhar (e **não** logar o corpo).
2. `INSERT INTO webhook_events (provider, event_id, payload)` — se violar unique, responder `200` e sair (já processado).
3. Enfileirar em `job_queue`. **Responder 200 em menos de 3 s.** Nunca processar de forma síncrona.
4. Processar no worker, com transação.

---

### 3. Interfaces de provider (portas)

Escreva contra a interface, nunca contra o SDK. Trocar Asaas por Pagar.me deve ser 1 arquivo.

```ts
// src/server/providers/payments/types.ts
export interface PaymentProvider {
  createPixCharge(i: { amountCents: number; description: string; expiresInSec: number;
                       externalId: string; payer?: { name: string; document?: string } })
    : Promise<{ chargeId: string; qrImage: string; copyPaste: string; expiresAt: Date }>;
  createCardCharge(i: { amountCents: number; installments: number; token: string;
                        externalId: string }): Promise<{ chargeId: string; status: PaymentStatus }>;
  refund(chargeId: string, amountCents?: number): Promise<void>;
  parseWebhook(raw: string, signature: string): PaymentEvent;   // lança se assinatura inválida
}

// src/server/providers/messaging/types.ts
export interface MessagingProvider {
  sendTemplate(i: { to: string; template: string; params: Record<string,string>;
                    buttons?: { id: string; label: string }[] }): Promise<{ providerId: string }>;
  sendText(i: { to: string; body: string }): Promise<{ providerId: string }>;   // só dentro da janela de 24h
  parseWebhook(raw: string, signature: string): InboundMessage | StatusUpdate;
}
```

**Fallback obrigatório:** se `MessagingProvider` falhar 3 vezes ou o template for rejeitado, cair para push (PWA) e, se não houver, e-mail. Nunca deixar o lembrete simplesmente sumir.

---

### 4. Templates de WhatsApp (submeter à aprovação da Meta antes do lançamento)

| Nome | Categoria | Corpo |
|---|---|---|
| `lembrete_24h` | UTILITY | "Oi {{1}}! Passando pra lembrar do seu horário amanhã, {{2}} às {{3}}, com {{4}}. Confirma pra mim?" · botões: *Confirmo* / *Preciso remarcar* |
| `lembrete_3h` | UTILITY | "Oi {{1}}, seu horário é hoje às {{2}}. Te espero! Endereço: {{3}}" |
| `confirmacao_agendamento` | UTILITY | "Prontinho, {{1}}! Agendado para {{2}} às {{3}}. Qualquer coisa é só chamar." |
| `sinal_pendente` | UTILITY | "Oi {{1}}! Seu horário de {{2}} fica reservado por 30 min. Pra garantir, é só pagar o sinal de {{3}} aqui: {{4}}" |
| `ciclo_janela` | MARKETING | "Oi {{1}}! Já faz {{2}} dias do seu último {{3}} — deve estar na hora. Tenho {{4}} livre, quer que eu reserve?" |
| `ciclo_atrasado` | MARKETING | "{{1}}, senti sua falta! Faz {{2}} dias. Separei alguns horários pra você: {{3}}" |
| `reconquista` | MARKETING | "Oi {{1}}, tudo bem? Você não aparece desde {{2}}. Quero muito te ver de novo — {{3}}" |
| `pedido_avaliacao` | UTILITY | "{{1}}, foi um prazer te atender! Se puder deixar sua avaliação, ajuda demais: {{2}}" |
| `aniversario` | MARKETING | "Feliz aniversário, {{1}}! 🎉 Seu presente: {{2}}, válido até {{3}}." |

**Regras:** categoria MARKETING só para quem tem `marketing_opt_in = true`. Sempre incluir forma de sair. Nunca enviar entre 21h e 8h.

---

### 5. Realtime

Usar Supabase Realtime só nestes canais (mais que isso fica caro e barulhento):

| Canal | Evento | Para quê |
|---|---|---|
| `tenant:{id}:appointments` | insert/update/delete | Agenda atualiza sozinha quando a recepção mexe |
| `tenant:{id}:payments` | update de status | Tela do Pix confirma sozinha, sem polling |

O restante usa `refetch` do TanStack Query ao focar a janela.


---

