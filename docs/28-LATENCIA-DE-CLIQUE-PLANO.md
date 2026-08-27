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
