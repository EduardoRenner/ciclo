# 01 · ESPECIFICAÇÃO TÉCNICA

Tudo aqui é **decisão travada**. Não reabra a discussão; se discordar, implemente assim mesmo e abra uma nota em `docs/DECISOES.md`.

---

### 1. Stack (final)

| Camada | Escolha | Versão alvo | Por quê |
|---|---|---|---|
| Runtime | Node 22 LTS | | |
| Framework | **Next.js 15 (App Router)** | 15.x | PWA + SSR na página pública (SEO local) + um só deploy |
| Linguagem | **TypeScript strict** | 5.6+ | `strict: true`, `noUncheckedIndexedAccess: true` |
| UI | **Tailwind CSS + shadcn/ui** | | Velocidade + acessibilidade pronta |
| Banco | **PostgreSQL 15+ (Supabase)** | | RLS, Realtime, Auth e Storage no mesmo lugar |
| Acesso a dados | **`@supabase/supabase-js`** no servidor, com JWT do usuário | | RLS aplica automaticamente |
| Migrations | **Supabase CLI** (`supabase/migrations/*.sql`) | | SQL puro, versionado, revisável |
| Validação | **Zod** | | Um schema serve para runtime e tipo |
| Estado de servidor | **TanStack Query** | v5 | Cache, retry, offline, optimistic update |
| Formulários | React Hook Form + Zod resolver | | |
| Datas | **Temporal polyfill** ou `date-fns-tz` | | Fuso horário sem gambiarra |
| Testes | **Vitest** (unit) + **Playwright** (e2e) | | |
| Pagamentos | **Asaas** (Pix, cartão, split, sandbox bom) | | Abstraído por `PaymentProvider` |
| Mensageria | **WhatsApp Cloud API** (Meta) | | Abstraído por `MessagingProvider` |
| Storage | **Supabase Storage** bucket privado | | Signed URL de 5 min |
| Filas/Jobs | **Tabela `job_queue` + `pg_cron` + Edge Function** | | Zero infra extra no MVP |
| Erros | Sentry (com scrubbing agressivo) | | |
| Produto | PostHog (self-host ou cloud UE/BR) | | |
| Deploy | Vercel + Supabase **São Paulo** | | Latência e argumento de soberania |
| Package manager | **pnpm** | | |

#### O que NÃO usar

- ❌ ORM pesado (Prisma/TypeORM) — atrapalha RLS e políticas. Use supabase-js + SQL.
- ❌ tRPC — o PWA precisa de fila offline, e fila offline precisa de REST. Ver §4.
- ❌ Redis no MVP — `job_queue` no Postgres resolve até ~10 mil contas.
- ❌ `localStorage` para dado sensível. IndexedDB só para fila de mutações e cache não sensível.
- ❌ Server Actions para escrita crítica — não dá para reenfileirar offline.

---

### 2. Multi-tenancy

#### 2.1 Modelo

**Pooled multi-tenant**: um banco, uma schema, `tenant_id` em toda tabela de negócio. Isolamento por **RLS no Postgres**, não por filtro na aplicação.

```
auth.users (Supabase)
    └── profiles (1:1)
            └── memberships (N:N com tenants, com papel)
                    └── tenants
                            └── todo o resto (tenant_id NOT NULL)
```

Um usuário pode pertencer a vários tenants (barbeiro que atende em dois lugares). O **tenant ativo** vem do cookie `ciclo_tenant`, mas **o servidor sempre revalida** que existe `membership` ativo — nunca confie no cookie.

#### 2.2 As políticas

Toda tabela segue este padrão. A função helper faz o trabalho:

```sql
create or replace function public.has_tenant(t uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.memberships m
    where m.tenant_id = t and m.user_id = auth.uid() and m.active
  );
$$;
```

```sql
alter table appointments enable row level security;

create policy appointments_select on appointments for select
  using ( public.has_tenant(tenant_id) and public.can_see_appointment(tenant_id, professional_id) );

create policy appointments_write on appointments for all
  using ( public.has_tenant(tenant_id) )
  with check ( public.has_tenant(tenant_id) );
```

`can_see_appointment` implementa a regra "profissional só vê a própria agenda quando o dono ativou essa trava".

#### 2.3 O perigo do `service_role`

A chave `service_role` **ignora RLS**. Ela só pode ser usada em worker/webhook, e **sempre** através deste wrapper:

```ts
// src/server/db/with-tenant.ts
export async function withTenant<T>(
  tenantId: string,
  fn: (db: SupabaseClient) => Promise<T>
): Promise<T> {
  if (!isUuid(tenantId)) throw new Error('withTenant: tenantId inválido');
  const db = createServiceClient();
  await db.rpc('set_tenant_context', { t: tenantId }); // SET LOCAL app.tenant_id
  try {
    return await fn(db);
  } finally {
    await db.rpc('clear_tenant_context');
  }
}
```

Regra de lint customizada: `createServiceClient()` só pode ser importado dentro de `src/server/db/with-tenant.ts` e `supabase/functions/**`. Em qualquer outro lugar, o build quebra.

#### 2.4 Teste obrigatório de isolamento

`tests/rls/isolation.test.ts` roda no CI e faz, **para cada tabela com `tenant_id`**:

1. Cria tenant A e tenant B com um registro cada.
2. Autentica como usuário do tenant A.
3. Tenta `select`, `update` e `delete` no registro de B.
4. **Espera 0 linhas / erro.** Se retornar qualquer coisa, o build falha.

O teste descobre as tabelas por introspecção (`information_schema`), então **tabela nova é coberta automaticamente** — inclusive se o dev esquecer.

---

### 3. Autenticação e autorização

#### 3.1 Login

| Público | Método (MVP) |
|---|---|
| Profissional / dono | E-mail + senha (Supabase Auth, senha ≥ 10 chars, verificação contra lista de vazadas via k-anonymity do HIBP) |
| Profissional (V1.1) | OTP por WhatsApp |
| Cliente final | Magic link por e-mail **ou** código de 6 dígitos por WhatsApp |
| Booking público | Sem login (só telefone + nome) |

#### 3.2 MFA

TOTP nativo do Supabase (AAL2). **Obrigatório** para papel `owner` e `finance` — se não tiver, o app força o cadastro no próximo login. Ações sensíveis exigem AAL2 na hora:

- exportar base de clientes
- trocar conta bancária de recebimento
- alterar percentual de comissão
- eliminar dados de cliente (LGPD)

#### 3.3 RBAC

```ts
export const PERMISSIONS = {
  owner:        ['*'],
  manager:      ['appointment:*','client:*','service:*','inventory:*','report:read','professional:read'],
  professional: ['appointment:own','client:own','vault:own','comanda:own'],
  reception:    ['appointment:*','client:read','client:create','comanda:create'],
  finance:      ['payment:*','commission:*','report:*'],
} as const;
```

Checagem em **duas camadas**: `requirePermission()` no handler **e** política RLS no banco. Se só uma existir, está errado.

---

### 4. Caminho de escrita e offline

#### 4.1 Por que REST e não Server Actions

O app precisa funcionar no 4G ruim de um subsolo. Isso exige **fila de mutações persistente** no cliente, que precisa serializar a requisição — e Server Action não serializa. Portanto:

- **Leitura:** Server Components (rápido, SEO) + TanStack Query no cliente para dado que muda.
- **Escrita:** sempre `POST/PATCH/DELETE` em `/api/v1/*` via o cliente `apiFetch()`.

#### 4.2 A fila offline

```ts
// src/lib/api-client.ts (resumo do comportamento)
1. Toda mutação recebe um Idempotency-Key (uuid v4 gerado no cliente).
2. Se online  → envia; em erro de rede, enfileira.
3. Se offline → grava em IndexedDB (store `mutations`) e aplica optimistic update.
4. Ao voltar online (evento `online` + retry exponencial), drena a fila EM ORDEM.
5. Resposta 409 (conflito) → marca o item como "precisa da sua atenção" e mostra
   um card na UI com as duas versões. Nunca descarta em silêncio.
6. Resposta 4xx que não seja 409/429 → descarta e notifica o usuário.
```

**Regra:** o servidor é a fonte da verdade. O cliente só pode agendar offline em slot que ele já sabia estar livre; o servidor revalida e pode recusar com 409.

#### 4.3 Idempotência no servidor

```sql
create table idempotency_keys (
  key text primary key,
  tenant_id uuid not null,
  endpoint text not null,
  request_hash text not null,
  response_status int,
  response_body jsonb,
  created_at timestamptz default now()
);
```

Fluxo: se a chave existe **e** o `request_hash` bate → devolve a resposta gravada. Se existe com hash diferente → `422 IDEMPOTENCY_KEY_REUSED`. Retenção: 7 dias.

---

### 5. Algoritmos de negócio (implemente em `src/core/`, sem I/O)

#### 5.1 Cálculo de horários disponíveis

```ts
/**
 * Entrada: dia, profissional, serviço, dados já carregados.
 * Saída: lista de horários de início disponíveis.
 */
function availableSlots(input: {
  date: PlainDate;
  timezone: string;               // do tenant
  businessHours: Interval[];      // expediente do profissional naquele dia da semana
  timeOff: Interval[];            // folgas, almoço, feriado
  appointments: Interval[];       // agendamentos existentes (status != canceled/no_show)
  serviceDuration: number;        // minutos
  bufferBefore: number;           // minutos (higienização/preparo)
  bufferAfter: number;
  slotGranularity: number;        // 15 min por padrão, configurável por tenant
  minLeadTimeMinutes: number;     // antecedência mínima (padrão 120)
  maxAdvanceDays: number;         // até quando dá pra marcar (padrão 60)
  now: Instant;
}): Instant[]
```

Regras:
1. Bloco ocupado = `[inicio - bufferBefore, fim + bufferAfter]`.
2. Um slot é válido se `[inicio, inicio + duracao]` cabe inteiro dentro do expediente **e** não intersecta nenhum bloco ocupado (com buffers de ambos os lados).
3. Descartar slots que começam antes de `now + minLeadTimeMinutes`.
4. Horário de verão: **nunca** some minutos em timestamp local; converta para instante UTC antes de comparar. Dia com transição de fuso pode ter 23 ou 25 horas — o algoritmo tem que funcionar assim mesmo. **Existe teste para isso.**
5. Se o serviço permite paralelismo (ex.: secagem de esmalte com outra cliente), respeite `service.parallel_capacity` (padrão 1).

#### 5.2 Detecção de conflito (no servidor, à prova de corrida)

Não confie em `SELECT` seguido de `INSERT`. Use **constraint de exclusão** no Postgres:

```sql
alter table appointments
  add column period tstzrange
    generated always as (tstzrange(starts_at, ends_at, '[)')) stored;

alter table appointments
  add constraint appointments_no_overlap
  exclude using gist (
    professional_id with =,
    period with &&
  ) where (status in ('pending','confirmed','arrived'));
```

Se a constraint violar, o handler devolve `409 SLOT_TAKEN` com os 3 horários alternativos mais próximos. Isso elimina agendamento duplo mesmo com duas clientes clicando no mesmo segundo.

#### 5.3 Motor de Ciclo

```ts
function computeCycle(input: {
  history: { date: PlainDate }[];   // atendimentos concluídos daquele cliente naquele serviço, ordem cronológica
  defaultCycleDays: number;         // do serviço (vem do pack da vertical)
  today: PlainDate;
}): { personalCycleDays: number; predictedDate: PlainDate; lateDays: number; state: CycleState }
```

**Regras (v1 — determinístico e explicável, sem ML):**

```
1. gaps = diferenças em dias entre atendimentos consecutivos
2. descartar gaps > 3 × defaultCycleDays  (sumiu e voltou: não é ritmo, é exceção)
3. se sobraram 0 gaps  → personalCycleDays = defaultCycleDays
   se sobraram 1-2     → média ponderada: 0.6 × mediana(gaps) + 0.4 × defaultCycleDays
   se sobraram 3+      → mediana dos últimos 5 gaps
4. personalCycleDays = clamp(resultado, 0.5 × default, 2.5 × default)
5. predictedDate = ultimoAtendimento + personalCycleDays
6. lateDays = today - predictedDate
7. estado:
      lateDays < -3            → on_track
      -3 ≤ lateDays ≤ 0        → due          (janela de retorno)
      1 ≤ lateDays ≤ 10        → late
      11 ≤ lateDays ≤ 30       → at_risk
      lateDays > 30            → lost
8. Se já existe agendamento futuro para esse cliente+serviço → estado = on_track (não incomodar).
```

**Onde roda:** job `recompute_cycles` às 03:00 do fuso do tenant, gravando em `client_cycles`. Também recalcula em tempo real quando um atendimento é concluído.

**Valor em risco** (o número da tela "Recuperar receita"):
```
valorParado = Σ (preço atual do serviço × probabilidade de recuperação)
  probabilidade por estado: due 0.85 · late 0.65 · at_risk 0.35 · lost 0.12
```
Mostrar sempre arredondado para baixo, em reais inteiros. Nunca prometer mais do que entrega.

#### 5.4 Score de risco de falta (v1: regras, não ML)

```
score = 0.10 (base)
  + 0.25  se já faltou alguma vez            + 0.15 por falta adicional (máx +0.30)
  + 0.15  se é a primeira visita
  + 0.10  se agendou com mais de 14 dias de antecedência
  + 0.10  se não confirmou até 12h antes
  + 0.10  se o horário é depois das 18h ou aos sábados
  - 0.20  se pagou sinal
  - 0.15  se é assinante do clube
  - 0.10  se tem 5+ atendimentos concluídos sem falta
score = clamp(score, 0.02, 0.95)
```

Uso: `score ≥ 0.45` → sinal obrigatório no booking público; `≥ 0.60` → mostra alerta ⚡ na agenda e envia lembrete extra. Guardar o score e as features usadas em `appointments.risk_features` (jsonb) para depois treinar o modelo de verdade com dado real.

#### 5.5 Comanda e preço

```
subtotalItens   = Σ (preco_unitario × quantidade)
desconto        = valor fixo OU percentual (nunca os dois na mesma linha)
total           = subtotalItens - desconto + gorjeta
custoMaterial   = Σ (consumo do serviço × custo médio do produto)   [ver 5.6]
taxaAdquirencia = por método de pagamento, tabela em tenant_settings
comissao        = ver 5.7
lucroReal       = total - custoMaterial - taxaAdquirencia - comissao
```

Arredondamento: tudo em centavos, `Math.round` na divisão de percentual, e a **diferença de arredondamento sobra para o estabelecimento**, nunca para o cliente. Existe teste de "soma das partes = total".

#### 5.6 Estoque

- Custo do produto: **média móvel ponderada** (recalcula a cada entrada). Não usar FIFO no MVP.
- Baixa: ao **fechar** a comanda (não ao abrir), gera `stock_moves` do tipo `out` para cada item da ficha de consumo.
- Estorno: cancelar comanda fechada gera movimento `in` compensatório — nunca deleta o movimento original.
- Alerta de recompra: `estoque_atual ≤ ponto_pedido` **ou** `dias_de_cobertura < 7`, onde `dias_de_cobertura = estoque_atual / consumo_médio_diário_dos_últimos_30_dias`.
- Validade: alerta em D-30 e bloqueio de uso em D+0 (com override registrado em auditoria).

#### 5.7 Comissão (MVP: só percentual simples)

```
base = total do item  (ou total - custoMaterial, conforme tenant_settings.commission_base)
comissao = round(base × percentual)
percentual: do vínculo profissional×serviço, senão do profissional, senão do tenant
```
Guardar sempre o **percentual usado no momento**, congelado na linha — mudar a regra depois não pode alterar histórico.

#### 5.8 Sinal (depósito)

| Evento | Regra |
|---|---|
| Cobrança | Percentual ou valor fixo por serviço; padrão 30%, mínimo R$ 10 |
| Prazo | Pix expira em 30 min; sem pagamento, o slot é liberado automaticamente |
| Atendimento realizado | Sinal vira crédito na comanda |
| Cancelamento pela cliente com > 24h | Vira crédito na carteira (não devolve em dinheiro no MVP) |
| Cancelamento com < 24h ou falta | Sinal é retido — política configurável e exibida antes do pagamento |
| Cancelamento pelo profissional | Devolução integral, automática |

Reserva do slot fica com status `pending` e `hold_expires_at`. Job `expire_holds` roda a cada 2 minutos.

---

### 6. Máquinas de estado

#### Agendamento
```
              ┌──────────────► canceled
              │                    ▲
pending ──► confirmed ──► arrived ──► done
   │            │                     │
   │            └────► no_show        └──► (gera comanda)
   └──► expired (hold do sinal venceu)
```
Transições ilegais devolvem `422 INVALID_TRANSITION`. A tabela de transições permitidas vive em `src/core/scheduling/state.ts` e tem teste exaustivo.

#### Comanda
```
open ──► closed ──► paid
  │         │
  └──► canceled  └──► refunded (parcial ou total)
```

#### Pagamento
```
pending ──► paid ──► refunded
   │
   ├──► failed ──► (retry) ──► pending
   └──► expired
```

---

### 7. Jobs

| Job | Agendamento | Idempotente? | O que faz |
|---|---|---|---|
| `expire_holds` | */2 min | sim | Libera slot de sinal não pago |
| `send_reminders` | */15 min | sim (chave por appointment+tipo) | D-1 às 18h e D-0 T-3h, no fuso do tenant |
| `recompute_cycles` | 03:00 diário por fuso | sim | Atualiza `client_cycles` |
| `cycle_campaigns` | 09:30 diário | sim | Dispara `due`/`late`/`at_risk` respeitando limites e opt-out |
| `stock_alerts` | 07:00 diário | sim | Ponto de pedido e validade |
| `lgpd_retention` | 04:00 diário | sim | Anonimiza/elimina o que venceu |
| `dunning` | 09:00 diário | sim | Retentativa de cobrança (V2, clube) |

**Padrão de fila:** tabela `job_queue` com `SELECT ... FOR UPDATE SKIP LOCKED LIMIT 50`, `attempts`, `run_after`, backoff exponencial, e `dead_letter` depois de 5 tentativas. `pg_cron` só enfileira; uma Edge Function consome.

**Limites de mensagem (anti-spam, protege a conta do WhatsApp):**
- máximo 1 mensagem de campanha por cliente a cada 7 dias
- máximo 3 mensagens de qualquer tipo por cliente por semana
- nada entre 21h e 8h no fuso do tenant
- opt-out respeitado sempre, inclusive em lembrete transacional se a cliente pedir

---

### 8. Cofre criptográfico (dado de saúde)

```
KEK (mestra)          → variável de ambiente / KMS, rotacionada anualmente
  └── DEK por tenant  → gerada no onboarding, guardada CIFRADA em tenant_keys
        └── registro  → AES-256-GCM, com iv e authTag próprios por registro
```

```ts
// src/server/crypto/vault.ts
encryptVault(tenantId, plaintextJson) -> { ciphertext: Buffer, iv: Buffer, tag: Buffer, keyVersion: number }
decryptVault(tenantId, record)        -> objeto
```

Regras:
- A DEK em claro vive **só em memória**, com cache de no máximo 5 minutos.
- Toda leitura do cofre grava em `vault_access_log` (quem, quando, IP, qual cliente, motivo).
- O log é **visível para o dono da conta** — é feature, não só controle.
- Suporte da CICLO **não** consegue descriptografar: o modo impersonation nunca carrega a DEK.
- Campos indexáveis (nome, telefone) **não** entram no cofre; ficam na tabela `clients` com hash para busca.

---

### 9. Convenções de código

| Assunto | Regra |
|---|---|
| Idioma | **Código, tabelas e colunas em inglês.** UI, mensagens de erro ao usuário, comentários e commits em **português**. |
| Nomes de tabela | plural, `snake_case` (`appointments`, `client_cycles`) |
| IDs | `uuid` com `gen_random_uuid()` |
| Dinheiro | `bigint` em centavos, sufixo `_cents` (`price_cents`) |
| Percentual | `int` em basis points (`commission_bps`, 3000 = 30%) |
| Datas | `timestamptz` sempre; `date` só quando não há hora |
| Soft delete | `deleted_at timestamptz`, filtrado nas políticas |
| Enum | tipo Postgres, não `text` solto |
| Erro | `AppError` com `code` estável (ver `02-API.md`), nunca string crua na UI |
| Log | JSON estruturado, sem PII, com `request_id` e `tenant_id` |
| Componente | um arquivo, export default, props tipadas, sem `React.FC` |
| Commit | `feat(agenda): impedir agendamento sobreposto (TICKET-014)` |

---

### 10. Performance (metas e como atingir)

| Métrica | Meta | Como |
|---|---|---|
| LCP na agenda (4G, Moto G) | < 2,0 s | Server Component + streaming, sem gráfico pesado no primeiro paint |
| TTI | < 1,5 s no app shell | PWA com app shell em cache |
| Consulta da agenda do dia | < 80 ms | Índice `(tenant_id, professional_id, starts_at)` |
| Tela "Recuperar receita" | < 200 ms | Tabela materializada `client_cycles`, não calcular na hora |
| Bundle inicial | < 180 KB gzip | Nada de moment/lodash inteiro; ícones tree-shaken |
| Lista de clientes | virtualizada acima de 100 itens | `@tanstack/react-virtual` |

Regra prática: **nenhuma query N+1**. Se a tela precisa de dado de 3 tabelas, faça 1 query com join ou 3 queries em paralelo — nunca uma por linha.


---

