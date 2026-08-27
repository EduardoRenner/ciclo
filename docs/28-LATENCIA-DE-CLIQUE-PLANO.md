# 28 — Por que o botão demora, e o plano para consertar

**Sintoma relatado (Eduardo, 2026-08-27):** "demora muito pra clicar no botão e efetuar ação".

Investigado no código, não por palpite. O diagnóstico abaixo mede **idas de rede em série** —
é isso que o dedo sente, não CPU e não tamanho de bundle.

## 1. O que acontece hoje quando alguém toca "Confirmar" na agenda

`src/app/admin/agenda/detalhe.tsx:86` chama `POST /api/v1/appointments/{id}/confirm` e, no fim,
`onAtualizado()` — que em `agenda.tsx:171` e `hoje.tsx:231` faz `router.refresh()`. As duas coisas
correm **dentro do mesmo `useTransition`**, então o `pendente` do botão só solta quando a página
inteira terminou de ser re-renderizada no servidor.

A conta de idas de rede ao Supabase (sa-east-1), em série:

| # | Onde | Chamada |
|---|------|---------|
| 1 | `src/middleware.ts:153` | `auth.getUser()` — servidor de auth |
| 2 | `src/server/auth/session.ts:21` (via `contextoAtual`) | `auth.getUser()` **de novo** |
| 3 | `src/server/auth/tenant.ts` | `select` em `memberships` |
| 4 | `src/server/http/idempotency.ts` | `insert` em `idempotency_keys` |
| 5–6 | `src/server/services/agendamentos.ts` | `select` + `update` do agendamento |
| 7 | `idempotency.ts` | `update` gravando a resposta |
| 8 | `src/server/audit/write.ts` | `insert` em `audit_log` |

**8 idas só para a mutação.** Aí começa o `router.refresh()`:

| # | Onde | Chamada |
|---|------|---------|
| 9 | `middleware.ts` | `auth.getUser()` **pela terceira vez** |
| 10–11 | `page.tsx` → `contextoAtual` | `getUser()` + `memberships` **de novo** |
| 12 | `hoje/page.tsx:31` | `select` em `tenants` |
| 13+ | `Promise.all` de `resumo-hoje`/`acoes`/`atribuicao` | (essas já são paralelas — ok) |

**Total: ~13 idas em série por clique.**

## 2. O multiplicador: a função roda no hemisfério errado

`vercel.json` não declara `regions`. Sem isso a Vercel executa as funções em `iad1`
(Washington, DC). O Supabase deste projeto é `sa-east-1` (São Paulo). **Cada uma das 13 idas
atravessa ~7.600 km**: ~120–160 ms de RTT em vez dos ~5–15 ms de mesma região.

13 × 140 ms ≈ **1,8 s de espera pura**, antes de qualquer trabalho útil. É exatamente o
"demora muito".

## 3. Consertos, em ordem de retorno por risco

### P0-a — Fixar a região das funções em `gru1` (São Paulo)
Uma linha em `vercel.json`. Derruba cada ida de ~140 ms para ~10 ms. **Sozinho, corta ~90% do
tempo.** Risco: nenhum — só muda onde a função executa.

### P0-b — Deduplicar sessão e tenant por requisição
`sessaoAtual()` e `contextoAtual()` não usam `cache()` do React, então cada chamada dentro do
mesmo request refaz `getUser()` + `memberships`. Envolver com `cache()` elimina 2 idas por
requisição de API e 2 por render de página. Risco: baixo — `cache()` é por requisição, não
vaza entre usuários. Cuidado: `contextoAtual(req)` recebe um `Request` novo a cada chamada, então
a chave de cache precisa ser o `x-tenant-id` resolvido, não o objeto.

### P0-c — Soltar o botão antes do `router.refresh()`
Hoje o spinner cobre mutação **+** re-render. Tirando o `refresh` de dentro da transição, o toast
e o fechamento do sheet acontecem assim que a mutação responde; a lista atualiza logo atrás.
Percepção cai pela metade mesmo sem tocar em rede.

### P1-a — `auth.getUser()` do middleware não precisa rodar em toda rota
O matcher pega tudo. Para `/api/*` o middleware valida sessão que a própria rota vai validar de
novo — ida de rede duplicada em 100% das chamadas. O middleware existe ali só pelo CSP e pelo
`Cache-Control`; a renovação de token só interessa a navegação de tela. Separar as duas coisas
tira 1 ida de toda chamada de API.

### P1-b — Trilha de auditoria fora do caminho crítico
`writeAudit` é o último `insert` antes de responder e ninguém espera por ele na tela. Em
Vercel isso é `waitUntil()`. **Não pode virar fire-and-forget silencioso** — o erro precisa
continuar chegando ao log (`docs/21`, falha silenciosa).

### P1-c — Trocar `router.refresh()` por atualização local onde o dado é conhecido
A resposta de `/confirm` já devolve o agendamento atualizado. Trocar o estado da linha na lista
resolve sem re-render de servidor nenhum. Vale para agenda, hoje e ficha do cliente.

### P2 — Medir, não adivinhar
Sem número não dá para saber se melhorou. `src/lib/observability` já existe: carimbar duração
por rota no envelope de log de `handler.ts` e olhar as 5 rotas mais lentas.

## 4. Ordem de execução

1. P0-a, P0-b, P0-c — juntos, é a maior parte do ganho e nenhum muda regra de negócio.
2. Medir de novo em produção antes de seguir.
3. P1-a e P1-b só se o número ainda incomodar.
4. P1-c por tela, começando por agenda e hoje.

## 5. O que **não** é a causa

- Não é bundle nem CPU do celular: o tempo é de rede em série.
- Não é `TransicaoDeTela` — ela anima entrada de rota, não bloqueia clique.
- Não é a fila offline: `apiFetch` só enfileira quando a rede falha.
- Se o teste foi em `pnpm dev`, some ainda a compilação sob demanda do Next — que **não** existe
  em produção. Medir em produção antes de concluir qualquer coisa.

---

## 6. Segunda rodada (27/08) — o que a região não explicava

Com `gru1` no ar, as páginas públicas mediram TTFB de **150–300 ms quentes** — mas a **primeira**
requisição de cada série media **850 ms a 1,3 s**. A diferença entre quente e frio é cold start,
não distância. E este produto tem tráfego baixo: quase toda visita é um cold start.

### O achado

`src/instrumentation.ts` importava `@sentry/nextjs` no topo e chamava `Sentry.init()` em todo
runtime de servidor. Medido:

| Medida | Antes | Depois |
|---|---|---|
| `require('@sentry/nextjs')` | **~500 ms** por cold start | não acontece |
| Trace de uma rota de `/api/v1` | **11,43 MB** (120 arquivos) | **1,81 MB** (105) |
| Chunk compartilhado de toda rota | 1,58 MB, dominado por `@sentry`+`@opentelemetry` | some |
| `.next/server` | 52 MB | 19 MB |

E do outro lado da balança, nada: **`vercel env ls production` não tem `SENTRY_DSN`**. O SDK
subia, instalava auto-instrumentação de OpenTelemetry em cima de todo `http` de saída — inclusive
de toda chamada ao Supabase — e não mandava um evento sequer.

É a mesma correção que `instrumentation-client.ts` recebeu em 26/08 (`import()` gated por DSN,
129 kB de 188 kB de First Load JS), aplicada ao lado que ficou de fora. O lado do servidor era o
caro: no cliente o custo é download uma vez; no servidor é **500 ms em todo cold start**.

### O conserto

- `src/instrumentation.ts`: `import()` dinâmico, condicionado a `SENTRY_DSN`. `onRequestError`
  continua exportado de forma síncrona (o Next lê o módulo para achar o gancho) e vira no-op sem
  DSN — que é o que `init({ dsn: undefined })` já era na prática.
- `next.config.ts`: `withSentryConfig` só embrulha quando existe DSN. É ele que injeta a
  auto-instrumentação no grafo do servidor; sem isso o SDK não sai do bundle nem com o
  `import()` dinâmico.

**Pegadinha registrada:** o DSN é lido em tempo de *build*. Criar a variável na Vercel não liga o
Sentry sozinho — precisa de um deploy novo.

---

## 7. Terceira rodada (27/08) — 19 MB de libvips na tela inicial

Com o Sentry fora, medi a jornada **autenticada** de verdade contra produção (usuário de teste
descartável, cookie de sessão real, seis requisições por rota):

| Rota | 1ª (fria) | mediana (quente) |
|---|---|---|
| `/admin/hoje` | **1.870 ms** | 391 ms |
| `/admin/agenda` | 258 ms | 355 ms |
| `/admin/clientes` | 215 ms | 216 ms |
| `/api/v1/clients` | 497 ms | 177 ms |

Quente estava aceitável. **Frio, não** — e este produto tem tráfego baixo: quase toda visita
começa fria.

### O achado

O que o Vercel empacota com cada rota:

| Rota | Antes | Depois |
|---|---|---|
| `/admin/clientes` | 23,51 MB | 3,75 MB |
| `/admin/hoje` | **23,40 MB** | **3,64 MB** |
| `/admin/clientes/[id]` | 23,38 MB | 3,62 MB |
| `/admin/campanhas/nova` | 23,38 MB | 3,62 MB |
| mediana de todas as rotas | 1,80 MB | 0,76 MB |

**19,2 MB eram `@img/*`** — o libvips nativo que o `sharp` carrega. Sete rotas o empacotavam;
**uma** processa imagem de verdade (`POST /api/v1/clients/{id}/media`). Nas outras seis ele
entrava de carona por um caminho de import de uma linha:

```
admin/hoje/page.tsx → crm.ts → media.ts → sharp
```

`crm.ts` importa de `media.ts` a função `listarMediaDoCliente`, que é **só um `select`**. Ela
morava no mesmo arquivo do upload, e isso bastava.

### Duas tentativas que não resolveram (registradas para não se repetirem)

1. **`import()` dinâmico dentro de `fazerUploadMedia`.** Tira o custo de *carregar* o binário
   (~53 ms quentes, muito mais num cold start), mas não o de *empacotar*: o tracing do Next segue
   `import()` também — e com razão, ele não sabe se a chamada vai acontecer.
2. **`outputFileTracingExcludes` no `next.config.ts`.** As chaves são **glob**, e `[id]` em glob
   é classe de caractere ("um `i` ou um `d`"), não segmento dinâmico. Uma chave com colchete tirou
   o `sharp` de **todas** as rotas — inclusive da que faz upload, o que quebraria o envio de foto
   em produção com módulo não encontrado. Sem colchete, nenhuma chave casava com nada. Foi pego
   pela verificação, não em produção.

### O conserto

Separar o arquivo: `media-upload.ts` (upload + `sharp`) e `media.ts` (só consultas). Quem
consulta não tem caminho nenhum até o binário — correto por construção, sem depender de glob.

`tests/unit/server/sharp-so-onde-precisa.test.ts` anda o grafo de imports e responde "dá para
chegar no `sharp` a partir daqui?". Não procura a string `sharp` num arquivo: o defeito nunca
esteve no arquivo que importa, e sim no **caminho** até ele — uma guarda por string passaria com
o defeito de volta. Verificada por mutação nas duas direções: religar `crm.ts` ao upload quebra
6 testes; tirar o `sharp` da rota de upload quebra 1.

---

## 8. Quarta rodada (27/08) — o que a medição desmentiu

Medido em produção depois do conserto do `sharp`, com sessão real:

| Rota | 1ª (fria) | mediana (quente) |
|---|---|---|
| `/admin/hoje` | 1.706 ms | **293 ms** (era 391) |
| `/admin/agenda` | 246 ms | 232 ms (era 355) |
| `/admin/clientes` | 213 ms | 246 ms |
| `/api/v1/clients` | 559 ms | 168 ms (era 177) |

E então a medição desmentiu uma suposição que eu estava prestes a otimizar. Bati em **oito telas
diferentes**, uma vez cada, nenhuma delas visitada antes:

```
/admin/caixa            1036 ms   ← a única fria
/admin/estoque           296 ms
/admin/recuperar         253 ms
/admin/series            224 ms
/admin/orcamentos        226 ms
/admin/campanhas         182 ms
/admin/config            221 ms
/admin/config/servicos   184 ms
```

**Não é uma função fria por tela.** É *uma* instância compartilhada: paga-se o cold start uma vez
por período de ociosidade, e daí em diante toda tela responde em 180–300 ms. O sintoma real é
"a primeira coisa que eu faço depois de um tempo parado demora ~1 s; o resto vai".

Isso reordena o que vale a pena:

- **Tamanho de bundle** rende menos do que parecia — o cold start é um só, não um por tela. (O
  conserto do `sharp` continua valendo: é ele que a instância única carrega.)
- **Idas de rede em série** rendem mais, porque são pagas em **toda** requisição.

### O conserto desta rodada

Dez telas faziam `from('tenants').select(...)` na linha seguinte ao `contextoAtual`, e em cinco
(`hoje`, `agenda`, `caixa`, `estoque`, `recuperar`) a ida era **serial e bloqueante**: o
`timezone` decide o intervalo de todas as consultas seguintes, então nada começava antes dela
voltar. Agora os quatro campos vêm de carona no `select` que já revalida o membership.

`settings` ficou de fora de propósito: é JSON que cresce por tenant, e cobrá-lo de toda
requisição para servir três telas troca uma ida de rede por bytes em todas.

### Decisão registrada: a trilha de auditoria fica no caminho crítico

O P1-b (`writeAudit` via `after()`/`waitUntil`) economizaria ~15–30 ms por mutação. **Não vale.**
`audit_log` é trilha de acesso a dado de saúde (LGPD); hoje ela é gravada **antes** de a pessoa
ver "feito". Mover para depois da resposta abre uma janela em que a operação aconteceu e a trilha
não existe. Trocar essa garantia por 15 ms é um mau negócio.

### O que sobra é infraestrutura, não código

O cold start de ~1 s se divide em boot do contêiner + runtime do Node/Next. Medido localmente
(`next start`, sem contêiner), o custo de carregar os módulos da página é ~480 ms; o resto é da
plataforma. Não há mais gordura de aplicação relevante ali — o que resolve é manter a instância
quente (Fluid Compute), que é configuração de projeto na Vercel, não código.

---

## 9. Onde chegou (27/08, medido em produção com sessão real)

Mediana de cinco requisições quentes, medidas de uma rede residencial no Brasil — **~75 ms de
cada número é a minha rede até a Vercel**, então a melhora do lado do servidor é maior em
proporção do que a tabela mostra.

| Rota | Antes (início da sessão) | Depois | |
|---|---|---|---|
| `/admin/hoje` | 391 ms | **219 ms** | −44% |
| `/admin/agenda` | 355 ms | **181 ms** | −49% |
| `/admin/clientes` | 216 ms | **202 ms** | −6% |
| `/api/v1/clients` | 177 ms | **172 ms** | −3% |

Descontada a minha rede, `/admin/hoje` saiu de ~315 ms para ~145 ms de trabalho de servidor.

**Cold start continua em ~950 ms**, uma vez por período de ociosidade — e a partir dele tudo
responde em 180–220 ms. Isso não é mais código: é boot de contêiner. Quem resolve é manter a
instância quente (Fluid Compute), que é configuração de projeto na Vercel.

### Resumo dos consertos

| # | Conserto | Medida |
|---|---|---|
| 1 | Funções em `gru1` em vez de `iad1` | ~140 ms → ~10 ms por ida ao banco |
| 2 | `cache()` em sessão e membership | −2 idas por requisição |
| 3 | `router.refresh()` fora da transição | botão solta ao responder, não ao re-renderizar |
| 4 | Sentry do servidor só com DSN | −500 ms de `require` em todo cold start; trace 11,43 → 1,81 MB |
| 5 | API não repete o `getUser()` do middleware | −1 ida em toda chamada de API |
| 6 | `sharp` só na rota que processa imagem | `/admin/hoje` 23,40 → 3,64 MB |
| 7 | Tenant de carona no membership | −1 ida **serial e bloqueante** em 5 telas |

### O que ficou de fora, e por quê

- **`writeAudit` via `after()`** (~15–30 ms/mutação): `audit_log` é trilha de acesso a dado de
  saúde e hoje é gravada antes de a pessoa ver "feito". Não vale a janela.
- **Passar o usuário do middleware para a tela por header** (~30 ms/tela): tiraria o segundo
  `getUser()`, mas o middleware roda no Edge e a tela no Node — não dá para compartilhar o
  `cache()`, e um header confiável exigiria assinatura. Superfície de segurança nova por 30 ms
  num caminho que já está em 180–220 ms.
