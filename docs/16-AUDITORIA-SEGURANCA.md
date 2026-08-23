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

---

## 9 · Fases C e D — Autenticação, sessão, MFA e RBAC (concluídas)

### 9.1 · Verificado e CORRETO

| Item | Evidência |
|---|---|
| **`getUser()` em vez de `getSession()`** | A distinção que mais derruba app Supabase: `getSession()` lê o JWT do cookie e **acredita nele**; `getUser()` manda o token ao servidor de auth conferir a assinatura. Cookie é coisa que o cliente escreve. O projeto usa `getUser()`, com o porquê comentado. |
| **MFA nas rotas certas** | `exigirAal2()` em exatamente quatro: exportar dado do cliente, eliminar cliente, abrir o **cofre de saúde**, e remover fator de MFA (esta última fecha o "desligo o MFA sem provar que sou eu"). |
| **`aal` lido do Supabase, não de flag própria** | `getAuthenticatorAssuranceLevel().currentLevel` — `currentLevel` (o fator foi provado **nesta sessão**), não `nextLevel` (apenas está cadastrado). A confusão entre os dois é o erro clássico aqui. |
| **RBAC resolve contradição da spec pela leitura restritiva** | `EXCLUSIVAS_DO_DONO` tira `client:export` do curinga do manager, com o motivo escrito: "exportar a base é a carteira inteira saindo pela porta, e o erro de negar demais se conserta com um clique do dono". |
| **Acesso ao cofre é auditado** | `abrirFicha` grava em `vault_access_log` com ator, IP e user-agent. Ler ficha de saúde nunca é silencioso. |
| **Duas camadas declaradas** | O comentário do `rbac.ts` diz: "A checagem de permissão é a primeira das duas camadas: a segunda é a política de RLS no banco. Se só uma existir, está errado." |

---

### 9.2 · S3 · `restrict_professional_view` protege só a agenda — BAIXO (latente)

**Confirmado.**

O papel `professional` recebe `appointment:own`, `client:own`, `vault:own`, `comanda:own`. O
`own` é, pelo comentário do próprio `rbac.ts`, "o alcance" — e **"quem recebe `own` ainda precisa
filtrar pelo próprio profissional na consulta"**.

Medido:

1. **Nenhuma das ~30 rotas captura o retorno de `exigirPermissao`.** Todas descartam o escopo, então
   `own` nunca vira filtro. Verificado uma a uma.
2. **`restrict_professional_view` é lida em UM lugar só** — `can_see_appointment()`, na 0001 —
   e essa função guarda apenas a tabela `appointments`.
3. **A RLS de `clients`, `health_records` e `tickets` é a política genérica** (`has_tenant(tenant_id)`):
   qualquer membro do tenant passa, independente do papel.

**Cenário (atacante A6, insider com papel limitado).** O dono liga "restringir visão do
profissional" esperando que cada profissional veja só o que é seu. A **agenda** de fato restringe.
Mas o mesmo profissional continua alcançando `GET /api/v1/clients` (base inteira, com anotações e
preferências) e `GET /api/v1/clients/{id}/vault` (**ficha de saúde de qualquer cliente**). A
configuração promete mais do que entrega.

**Por que BAIXO, e não médio:**
- A configuração **não é exposta em nenhuma tela** (varredura em `src/app` e `src/server`: zero
  ocorrências). Hoje só dá para ligá-la mexendo no banco direto — ou seja, **ninguém está sendo
  enganado agora**.
- O padrão é `false` (`coalesce(..., false)`), então a expectativa corrente é mesmo "todo mundo vê
  tudo", que é razoável num salão pequeno.
- O acesso ao cofre exige MFA **e** fica registrado em `vault_access_log`.
- É dentro do mesmo tenant — não vaza dado de outro salão.

**O risco real é de amanhã:** no dia em que alguém construir o botão dessa configuração (é uma
feature natural de pedir), vai entregar uma trava que só funciona pela metade — e sobre ficha de
saúde.

**Correção proposta (NÃO aplicada — depende de decisão de negócio).** Antes de expor a
configuração, decidir o que significa "meu cliente": quem eu já atendi alguma vez? nos últimos N
meses? Só depois disso dá para implementar, e o certo é nas duas camadas — filtro na consulta
**e** política de RLS — como o próprio `rbac.ts` manda. Inventar essa regra numa auditoria seria
exatamente o que o §19 do prompt de design proíbe.

---

## 10 · Pendente

Fases E (resto da superfície pública), F (injeção/SSRF), G (cofre/cifragem), H (webhooks/replay),
I (service worker), J (CSP), K (dinheiro/idempotência), L (dependências), M (LGPD), N (infra).
