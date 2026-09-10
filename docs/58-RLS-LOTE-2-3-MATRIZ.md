# 58 · RLS lote 2.3 — a matriz de papéis, e o que precisa de decisão

Levantado em 2026-09-09. Os lotes 2.1 (`0081`) e 2.2 (`0082`) fecharam o que era **capacidade
comprovadamente morta** (nenhum caminho do app usa). As tabelas abaixo NÃO são assim: cada uma tem
uma régua de papel a escolher, e **escolher errado quebra o app sem gritar** — `delete`/`update`
barrado por RLS devolve zero linhas, não erro (`docs/DECISOES.md` 2026-09-09).

## Método (o mesmo dos lotes anteriores)

Para cada tabela: `grep -rn "from('X')" src` → para cada operação, subir a cadeia de chamada até a
rota ou o Server Component e ver o cliente:
- `withNovoTenant` / `withTenant` = `service_role` → **ignora a RLS**, a política não governa isso.
- `criarClienteDoUsuario()` = cliente do usuário → **a RLS aplica**, e é aqui que a régua importa.

A régua é o `src/server/auth/rbac.ts` (`PERMISSIONS`), papel por papel — nunca `can_see_ticket`
(que libera `reception`).

---

## Grupo A — precisa de decisão do dono (e alguns, de mudança de código antes)

### `health_records` (dado de saúde, categoria especial LGPD)

| Operação | Onde | Permissão | Cliente |
|---|---|---|---|
| `upsert` (salvar anamnese) | `POST /api/v1/clients/[id]/vault` | `vault:own` + `exigirAal2()` | usuário |
| `select` (abrir ficha, alerta) | `GET /api/v1/clients/[id]/vault` | `vault:own` + `exigirAal2()` | usuário |
| `delete` (erase LGPD) | `POST /api/v1/clients/[id]/erase` | `client:delete` + `exigirAal2()` | usuário |

`vault:own` = `owner` + `professional`. `client:delete` = `owner` + `manager` (`client:*`).

**O que a `0077` já fez:** tirou `ciphertext`/`iv`/`auth_tag`/`alert_label` do `grant` de
`anon`/`authenticated`. Então hoje `reception`/`manager` que chamasse o PostgREST direto pega a
LINHA (metadado: "cliente X tem ficha de saúde"), mas **não o conteúdo cifrado nem o rótulo**.

**A armadilha:** o erase apaga `health_records` com o **cliente do usuário** (`client:delete`).
Se a política de `delete` for `vault:own` (owner+professional), o `manager` fazendo o erase recebe
`rowsRemoved: 0` **em silêncio** — o direito ao esquecimento falha e a tela diz sucesso.

**Caminho recomendado (2 PRs):**
1. **Código primeiro:** `eliminarCliente` (`lgpd.ts`) faz o `delete` de `health_records` (e `media`,
   `consents`) via `withTenant` (service_role), DEPOIS da checagem de permissão da rota — o mesmo
   desenho que a `0077` já usa para leitura privilegiada.
2. **Migration:** SELECT + INSERT + UPDATE por `vault:own`; sem DELETE pelo cliente do usuário (o
   erase passou a ser service_role).

**Decisão do dono:** o `professional` deve mesmo escrever/ler a anamnese (`vault:own` já diz que
sim hoje)? E o metadado "tem ficha" — `manager`/`reception` podem ver que existe? (Sugestão:
`vault:own` para tudo; `reception` não precisa saber.)

### `consents` (registro de consentimento LGPD)

| Operação | Onde | Permissão | Cliente |
|---|---|---|---|
| `insert` (conceder) | `consentimentos.ts` (via upload de mídia e rota de consentimento) | `client:update` / `service:update` | usuário |
| `update` (revogar `revoked_at`) | idem + **o erase** (`lgpd.ts:358` redige `ip`/`user_agent`) | `client:delete` no erase | usuário |
| `select` (data-export, telas) | várias | `client:export` / `client:read` | usuário |

Mesma armadilha do erase que `health_records`. **Mesmo caminho: código primeiro (erase via
service_role), migration depois.** Régua sugerida: `client:*` (owner + manager) para insert/update,
`client:read` para select.

### `media` (foto de cliente + portfólio da vitrine)

Mistura duas coisas: mídia PRIVADA de cliente (anamnese, antes/depois) e mídia PÚBLICA de portfólio
(vitrine). `media.ts` gera URL assinada, `media-upload.ts`/`portfolio-upload.ts` inserem,
`lgpd.ts` apaga no erase. **A régua tem que separar `phase` (client vs portfolio)** ou a mídima da
vitrine para de aparecer no site público. É a tabela mais entrelaçada do lote — recomendo deixá-la
por último, depois de `health_records`/`consents` estabelecerem o padrão do erase-via-service_role.

### `client_notes` (anotações da recepção sobre a cliente)

| Operação | Onde | Permissão | Cliente |
|---|---|---|---|
| `select` | `ficha.tsx` (Server Component) + `GET /api/v1/clients/[id]/notes` | `client:read` (+ `client:own` na ficha) | usuário |
| `insert` | `POST /api/v1/clients/[id]/notes` | `client:update` | usuário |

Sem `update`, sem `delete` em lugar nenhum → esses saem com segurança.

**Decisão do dono:** o `professional` deve ver as notas? O conteúdo é "número da máquina, como faz
a barba, **alergia**" — quem atende PRECISA de "como faz a barba", mas "alergia" tangencia dado de
saúde. Sugestão: SELECT por `client:read` + `client:own` (todo mundo que abre a ficha), INSERT por
`client:update` (owner+manager), sem update/delete.

### `client_reviews` (avaliação pós-atendimento)

Escrita: **anônima, por token** (`public-booking.ts` → `service_role`). Leitura: staff (qualquer)
+ a página pública do salão. → SELECT por `has_tenant`, **nada de insert/update/delete pelo membro**
(a escrita é service_role via token). Seguro, mas registra a decisão.

### `client_subscriptions` + `subscription_plans` (o clube de assinatura DO SALÃO — a cliente paga o salão)

Não confundir com `tenants.settings.assinatura` (o salão paga o CICLO). Rotas:
`subscription-plans` (`service:update` para configurar), `clients/[id]/subscription`
(`client:update` para inscrever/cancelar). → régua por `owner`/`manager`. `professional`/`reception`
não mexem em clube. Relativamente claro, mas confirmar que `reception` não precisa inscrever
cliente no clube na hora.

---

## Grupo B — fica `_tenant_all` DE PROPÓSITO (registrar no DECISOES)

Config compartilhada do salão que **todo papel operacional legitimamente cria, edita e apaga**.
Apertar por papel seria fricção sem risco de dados sensíveis:

`business_hours`, `service_categories`, `service_products`, `professional_services`, `packages`,
`time_off`, `waitlist`, `portfolio_photos`, `tenant_modules`, `message_templates`, `campaigns`,
`messages`.

- `campaigns`/`messages`/`message_templates`: conteúdo de mensagem. `campaign:*` já gate as rotas
  de envio; a tabela em si não carrega dado de cliente decifrado. Pode virar `owner`/`manager` num
  lote futuro, mas não é urgente.
- `packages`: já tem CAS anti-corrida no código; `waitlist`/`time_off`: agenda operacional.

---

## Ordem sugerida

1. **PR de código:** `eliminarCliente` faz `health_records`/`consents`/`media` delete via
   `withTenant` (service_role), depois da permissão. Sem migration ainda.
2. **PR migration 0083:** `client_notes` + `client_reviews` + `client_subscriptions` +
   `subscription_plans` (os mais claros), com a régua acima.
3. **PR migration 0084:** `health_records` + `consents` (agora que o erase é service_role).
4. **PR migration 0085:** `media` (com a separação `phase`).
5. **DECISOES:** o Grupo B fica como está, com o motivo escrito.

O dono decide: (a) `professional` vê notas? (b) `manager` vê o metadado de ficha de saúde? (c)
`reception` inscreve cliente no clube?
