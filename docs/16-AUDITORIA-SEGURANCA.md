# 16 · AUDITORIA DE SEGURANÇA — 2026-08-23

> Em andamento. Revisão de código e configuração, **não** pentest ofensivo contra produção.
> Modelo de ameaça, escopo e regras no prompt acordado com o Eduardo.

---

## 1 · Fase A — Inventário (concluída)

| Superfície | Números |
|---|---|
| Migrations | 33 |
| Tabelas | 48 |
| Edge Functions do Supabase | **0** (menos superfície) |
| Rotas de cron | 6 |
| Rotas públicas sem sessão (`/api/v1/public/*`) | 9 usando cliente que ignora RLS |
| Funções `security definer` | 10 |
| Arquivos com `SUPABASE_SERVICE_ROLE_KEY` | 1 (`with-tenant.ts`), com regra de lint própria |

---

## 2 · Verificado e CORRETO — o que já está bem feito

Registrado com o mesmo peso dos achados: auditoria que só lista problema não informa o risco real.

| Item | Por que está correto |
|---|---|
| **RLS em 48/48 tabelas** | 25 delas por laço dinâmico na 0001 (`tenant_tables[]`), o resto individualmente. Nenhuma tabela ficou de fora. |
| **`force row level security`** | Presente junto com `enable` em toda tabela — sem isso o dono da tabela furaria a própria política. |
| **`has_tenant()`** | `security definer` **com `set search_path = public`** (sem isso seria sequestrável por schema do atacante), decide por `auth.uid()` do JWT — nunca por dado que o cliente controla — e confere `m.active`, o que revoga ex-funcionário (atacante A2). |
| **Migration 0004** | Já tinha achado e fechado uma falha crítica real: `apply_vertical_pack()` era `security definer` e o PostgREST publica toda função de `public` em `/rest/v1/rpc/` — `anon` podia escrever em qualquer tenant. Revogada, junto com `set_tenant_context`/`clear_tenant_context`. |
| **Todas as 10 funções `security definer`** | Todas com `set search_path` fixo. As 4 que continuam executáveis (`has_tenant`, `tenant_role`, `my_professional_id`, `can_see_appointment`) **precisam** ficar assim (a RLS as avalia como quem consulta) e só respondem sobre o próprio `auth.uid()`. `handle_new_user` está revogada. |
| **Nenhuma política lê `app.tenant_id`** | O `set_tenant_context` seria contornável pelo cliente; conferido que política nenhuma depende dele, e que ele está revogado de `anon`/`authenticated`. |
| **`service_role` confinado** | Um arquivo só, com regra de lint (`ciclo/service-client-confinado`) que reprova o build — não é convenção, é imposto. |
| **Tokens de link público** | HMAC-SHA256, escopo dentro da assinatura (token de lista de espera não vale como confirmação), expiração conferida e **`timingSafeEqual`** com checagem de tamanho antes. Força bruta inviável. |
| **`withTenant` documenta o que NÃO garante** | O comentário explica que `set_tenant_context` não protege nada ali e que o chamador precisa filtrar `tenant_id` — honestidade rara e que evita falsa sensação de segurança. |

---

## 3 · Achados da Fase A

### S1 · `CRON_SECRET` serve a dois domínios de confiança diferentes — **ALTO** (elevado na Fase B)

**Onde:** `src/server/services/token-assinado.ts` (assinatura) × `src/app/api/cron/*/route.ts` (autenticação).

O mesmo segredo:
1. **Autentica o Vercel Cron** chamando o app (`Authorization: Bearer $CRON_SECRET`), e
2. **Assina os tokens HMAC dos links públicos** entregues ao cliente final por WhatsApp.

**Cenário (atacante A5).** Se o segredo vazar — log, captura de tela do painel da Vercel, alguém colando num chat — o atacante não ganha só a capacidade de disparar cron. Ganha a de **forjar qualquer token público**: confirmar ou cancelar agendamento alheio, reivindicar vaga de lista de espera de outra pessoa, e **aprovar orçamento** (que vira comanda cobrável). Um vazamento vira comprometimento dos dois domínios de uma vez.

**Armadilha operacional, independente de vazamento:** rotacionar `CRON_SECRET` é higiene normal de segurança — e hoje isso **invalida silenciosamente todo link público em circulação**. Cliente que recebeu "confirme seu horário" no WhatsApp ontem clica hoje e o link não vale mais, sem ninguém entender por quê.

**Correção proposta:** segredo próprio para assinatura de link (ex.: `PUBLIC_LINK_SIGNING_KEY`), com `CRON_SECRET` ficando só para cron. Para não quebrar links em circulação na virada, `verificarTokenAssinado` aceita a chave nova **e** a antiga durante uma janela de transição.

---

### S2 · Segredo de cron comparado sem proteção de tempo — BAIXO

**Onde:** as 6 rotas de `/api/cron/*`, todas com `if (!esperado || recebido !== esperado)`.

Comparação de string com `!==` sai no primeiro byte diferente. O tempo de resposta, em tese, revela quantos bytes iniciais estão certos.

**Honestidade sobre a exploração:** atacar isso remotamente, por HTTPS, contra comparação de string em JavaScript, com o ruído de rede e da Vercel no meio, é **muito difícil** — não é um cenário realista hoje. Reporto como **baixo** por dois motivos que independem da exploração: é uma inconsistência do projeto consigo mesmo (o `token-assinado.ts`, no mesmo código, usa `timingSafeEqual` corretamente), e a correção é de uma linha.

**Correção proposta:** extrair um `compararSegredo()` com `timingSafeEqual` e usar nas 6 rotas.

---

---

## 5 · Fase B — Isolamento e superfície pública (concluída)

### 5.1 · Verificado e CORRETO

| Item | Evidência |
|---|---|
| **Rotas públicas filtram tenant** | `public-booking.ts` faz `.eq('tenant_id', tenant.id)` em **toda** consulta, com o tenant vindo do `slug` da URL. `serviceId`/`professionalId` mandados pelo cliente são sempre restringidos ao tenant — cross-tenant devolve vazio. Sem IDOR. |
| **Interpolação em filtro PostgREST não é injetável** | 6 ocorrências de `.or(\`professional_id.eq.${x}\`)`. Três recebem valor vindo do banco; as outras três recebem parâmetro que passou por `z.uuid()` na borda **e** por `profissionalDoTenant()`. Sem vulnerabilidade hoje — mas é padrão frágil: basta alguém interpolar um campo não validado ali para virar injeção de filtro. |
| **Transição de estado por token é idempotente** | `transicaoPublica` devolve cedo se já está no alvo (clique duplo não duplica) e só aceita sair de `sent`. Não filtra `tenant_id`, e está certo: o id vem de token assinado e o tenant é derivado dele. |
| **Rate limiting existe e é bem desenhado** | Global de **120/min por IP** em toda rota que usa o `rota()` (`handler.ts`), mais limites finos no agendamento público: 5/min e 20/dia por IP, **3/dia por telefone** — com o telefone **hasheado na chave**, nunca em claro. |
| **Proteção CSRF** | `origemValida()` confere `Origin` nas rotas que escrevem, comparando com o host da própria requisição (não com env fixa — o comentário registra que a primeira versão quebrou o booking em preview). Ausência de `Origin` passa, que é o caso servidor-a-servidor. |
| **`withNovoTenant` em rota autenticada** | O único caso (`appointments/[id]`) passa `ctx.tenantId` do contexto de sessão validado. Uso legítimo. |

### 5.2 · Evidência que ELEVOU o S1 de médio para alto

O mecanismo de token assinado com `CRON_SECRET` cobre **quatro** famílias de link público, não uma:

| Escopo | Validade do token | O que um token forjado faz |
|---|---|---|
| `confirmacao_agendamento` | 72h | Confirma ou **cancela** agendamento alheio |
| `avaliacao` | — | Publica avaliação em nome de outra pessoa |
| `lista_espera` | — | **Reivindica a vaga** de outra pessoa |
| `orcamento` | **180 dias** | **Aprova orçamento**, que vira comanda cobrável |

Ou seja: a segurança de toda a superfície pública sem login se reduz a um único segredo que também é a senha de cron — e o de orçamento vale meio ano.

---

## 6 · Correções aplicadas

### S1 — chave própria para link público

`PUBLIC_LINK_SIGNING_KEY` passa a assinar os links. A transição foi desenhada para **não quebrar
link já enviado por WhatsApp**:

- **Assinatura:** usa a chave nova; sem ela, cai no `CRON_SECRET` — então o deploy não quebra
  antes de a variável existir no ambiente.
- **Verificação:** aceita as duas. Token assinado ontem continua valendo até expirar sozinho.
- Depois que o link mais longo em circulação expirar (orçamento, 180 dias), `CRON_SECRET` sai da
  lista de verificação.

Detalhe que não é óbvio: a verificação confere **todas** as chaves mesmo depois de uma bater. Sair
no primeiro acerto faria o tempo de resposta revelar *qual* chave assinou — durante a transição,
isso diria a quem está sondando se o ambiente já rotacionou.

### S2 — comparação de segredo sem vazar tempo

`compararSegredo()` com `timingSafeEqual` nas 6 rotas de cron. Repetindo a honestidade do achado:
explorar timing por HTTPS contra comparação de string em JS não é cenário realista — corrigido
porque custa uma linha e o padrão certo já existia no arquivo ao lado.

**Testes:** 7 casos novos, incluindo a prova de que, depois da rotação, quem tiver só o
`CRON_SECRET` vazado **não consegue mais forjar link novo**.

---

## 7 · Falsos positivos da minha própria ferramenta (3 até aqui)

Registrados porque auditoria de segurança que não duvida do próprio instrumento produz alarme
falso com a mesma confiança que produz achado real:

| O que meu scanner disse | O que era |
|---|---|
| "25 tabelas sem RLS" | Um laço dinâmico na 0001 aplica RLS nas 25 — meu regex não via `execute format(...)` |
| "`handle_new_user` exposta" | Está revogada; procurei `revoke all` e o arquivo usa `revoke execute` |
| "Rate limiting não é usado em lugar nenhum" | É usado em toda rota; procurei `rateLimit`/`ratelimit` e a função se chama `limitador` |

---

## 8 · Pendente

Fases C (auth/sessão/MFA), D (RBAC/IDOR), E (resto da superfície pública), F (injeção/SSRF),
G (cofre/cifragem), H (webhooks/replay), I (service worker), J (CSP), K (dinheiro/idempotência),
L (dependências), M (LGPD), N (infra).
