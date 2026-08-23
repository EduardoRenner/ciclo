# 16 · AUDITORIA DE SEGURANÇA — 2026-08-23

> Fases A–N concluídas. Revisão de código e configuração, **não** pentest ofensivo contra produção.
> O que ficou sem verificação ao vivo, e por quê, está no §20 — não presuma cobertura total.
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

## 10 · Fase E — Superfície pública sem autenticação (concluída)

### 10.1 · Verificado e CORRETO

| Item | Evidência |
|---|---|
| **Os quatro escopos de token público** | `confirmacao_agendamento` (72h), `avaliacao`, `lista_espera` (20 min, casado com a janela de exclusividade da oferta) e `orcamento` (180 dias, com `quotes.valid_until` decidindo de verdade). Assinatura HMAC-SHA256 de 64 caracteres hex — força bruta não é caminho. |
| **A oferta de encaixe viaja DENTRO da assinatura** | `lista-espera.ts` codifica `{waitlistId, tenantId, serviceId, professionalId, startsAt}` e assina o conjunto. Adulterar qualquer campo invalida o token: ninguém reivindica a vaga de outra pessoa trocando um id. |
| **Duplo clique não duplica nada** | `confirm`/`cancel` devolvem o estado atual quando o agendamento já saiu de `pending`; `approve`/`reject` de orçamento conferem estado antes; a avaliação apoia-se na constraint única de `client_reviews.appointment_id` e trata o `23505` como sucesso. |
| **Corrida de dois encaixes no mesmo horário** | Não precisa de trava na aplicação: `appointments_no_overlap` recusa o segundo no banco. |
| **Honeypot que não ensina o robô** | `website` preenchido devolve `{appointmentId: null}` — a **mesma forma** do sucesso. E o campo não tem `max(0)` no Zod de propósito, senão o 422 já entregaria que o honeypot foi notado. |
| **Telefone nunca em claro na chave do limitador** | `book:tel:<sha256>` — a regra 9 aplicada até ao que só passa pela memória. |
| **Importação de CSV** | Teto de 5 MB e 5 000 linhas, `criarClienteDoUsuario()` (a RLS vale), `client:create` conferido, `audit_log` gravado. O nome do arquivo **nunca** entra em caminho — não há travessia possível. |

### 10.2 · S4 · O rate limit de produção é por instância, não global — **ALTO**

**Confirmado (código).** `src/server/services/rate-limit.ts` cai para `limitarEmMemoria` — um `Map` do processo — sempre que `UPSTASH_REDIS_REST_URL`/`TOKEN` estiverem ausentes. O próprio comentário do arquivo diz o que isso significa: *"não protege um deploy serverless com várias instâncias, que não compartilham memória"*.

Some com ele a segunda camada: `verificarCaptcha()` **devolve `true`** quando `HCAPTCHA_SECRET` não existe. Sobra o honeypot, que se burla não preenchendo um campo.

**Cenário (atacante A4, bot anônimo).** Script pega `dom-rocha`, lê `GET /api/v1/public/dom-rocha/availability` para cada serviço e dia da semana, e dispara `POST /book` em paralelo com nomes e telefones plausíveis. Cada conexão nova tende a cair numa instância diferente (ou numa recém-acordada, com o `Map` zerado), então o "5/min por IP" e o teto global de 120/min valem por instância viva, não por IP. Resultado: agenda da semana inteira esgotada por reservas fantasma, e a dona só descobre quando ninguém aparece. É o DoS de negócio do §5 do escopo, com o agravante de que o CICLO **não tem cron no plano Hobby** — não existe job que expire reserva pendente para desfazer o estrago sozinho.

**Pergunta operacional que fica aberta:** o Upstash está provisionado no Vercel? Não foi verificado (a autorização desta rodada cobriu só leitura no Supabase). O comando é `vercel env ls production | grep UPSTASH`. Se as duas variáveis existirem, este achado cai para **médio** (sobra o captcha desligado); se não existirem, fica **alto** como está.

**Correção proposta:** provisionar Upstash (é gratuito na faixa deste volume e o código já sabe usá-lo) **ou**, enquanto isso não acontecer, exigir sinal/confirmação por WhatsApp para agendamento público de quem não é cliente conhecido. E provisionar a hCaptcha, que é a camada desenhada exatamente para este ataque.

### 10.3 · S5 · "Bloquear agendamento online" tem botão na tela e não bloqueia nada — MÉDIO

**Confirmado.** `clients.online_booking_blocked` nasceu na migration 0019 com o comentário *"Cliente que sumiu 3 vezes sem avisar continua podendo marcar sozinho pelo site; isto é a trava"*. A trava é lida em três lugares — o formulário da ficha (`ficha.tsx:173`), o `PATCH` que grava (`clientes.ts:72`) e o retorno do CRM (`crm.ts:190`). **Nenhum deles é o agendamento público.** `criarAgendamentoPublico` e `criarAgendamento` não mencionam a coluna.

**Cenário (atacante A3, cliente do salão).** A dona cansa de três faltas seguidas, abre a ficha, liga "bloquear agendamento online" e vê o botão ficar aceso. A pessoa entra em `/{slug}/agendar` no dia seguinte, digita o mesmo telefone, e marca. `resolverCliente` reaproveita o cadastro existente — o mesmo cadastro que está marcado como bloqueado.

**Por que é pior que o S3 (`restrict_professional_view`).** O S3 é uma configuração sem tela: ninguém está sendo enganado hoje. Esta tem interruptor, estado visível e promessa escrita na interface.

**Correção proposta:** conferir a coluna dentro de `resolverCliente`/`criarAgendamentoPublico` (só no caminho público — a recepção continua podendo marcar por telefone, que é o comportamento que o comentário da migration descreve) e devolver uma mensagem que não denuncie o bloqueio para quem está do outro lado ("não consegui concluir pela internet, fale com o salão").

### 10.4 · S6 · `ipDe()` confia no primeiro valor de `X-Forwarded-For` — MÉDIO

**Confirmado no código; exploração não verificada.**

```ts
return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'sem-ip'
```

O valor mais à **esquerda** é o que um cliente injeta quando o proxy *acrescenta* o IP real ao final. Atrás de exatamente um proxy confiável, o valor correto é o mais à direita — ou, na Vercel, o header próprio dela.

**Cenário (A4).** Se a Vercel repassar um `X-Forwarded-For` enviado pelo cliente, trocar o header a cada requisição dá um balde novo no limitador toda vez, e os limites por IP do projeto viram enfeite: 120/min global, 5/min e 20/dia do booking. Ficaria de pé só o limite por telefone (3/dia), que é hasheado sobre um valor que o atacante também escolhe.

**Correção de uma afirmação minha, feita ao executar a correção:** a primeira versão deste achado dizia que "os de login" também cairiam. **Está errado.** `POST /api/v1/auth/login` e `.../password/forgot` não usam este limitador — eles só traduzem o `429` que o **Supabase Auth** devolve, e esse limite é do lado do servidor de auth, alheio ao IP que o CICLO calcula. Força bruta de senha nunca esteve exposta nem pelo S4 nem pelo S6.

**A honestidade sobre isto:** não confirmei o comportamento da Vercel — precisaria de uma requisição a produção, que não foi autorizada nesta rodada. Reporto assim mesmo porque a correção é boa independentemente da resposta: `x-vercel-forwarded-for` é preenchido pela borda da Vercel e documentado como não forjável, e cair para `x-real-ip` antes de `x-forwarded-for` já seria melhor que ler o primeiro elemento.

---

## 11 · Fase F — Validação e injeção (concluída)

### 11.1 · Verificado e CORRETO

| Item | Evidência |
|---|---|
| **Zero Server Actions** | `grep "'use server'"` em `src/` não devolve nada. A regra 6 do CLAUDE.md ("Server Action só em formulário simples") está satisfeita por não existir nenhuma — toda escrita passa por `/api/v1` com envelope, RBAC, idempotência e auditoria. |
| **Um único `dangerouslySetInnerHTML`, e está certo** | `[slug]/page.tsx:62` faz `JSON.stringify(...).replace(/</g, '\\u003c')` **antes** de injetar o JSON-LD, com o motivo no comentário: nome e endereço do tenant são texto livre e fechariam a tag. Sem essa linha seria XSS armazenado na página pública. |
| **Sem `eval`/`new Function`/`innerHTML`** | Varredura completa em `src/` e `public/`: a única ocorrência de `eval` é a palavra dentro de um comentário do `middleware.ts`. |
| **Sem superfície de SSRF** | As únicas chamadas `fetch()` de saída vão para host fixo (`graph.facebook.com`, `hcaptcha.com`) ou para URL vinda de variável de ambiente (Upstash). Nenhum ponto busca URL fornecida pelo usuário. |
| **Sem travessia de caminho na mídia** | `storage_key` é `{tenantId}/{randomUUID()}.webp`. O nome do arquivo enviado é descartado; o conteúdo é reprocessado pelo `sharp` (o que também derruba o EXIF com GPS). Bucket com `allowed_mime_types` fechado. |
| **Rota bodyless também valida o que recebe** | Amostradas `complete`, `time-off/[id]`, `tickets/[id]/items/[itemId]` e `consents/[id]/[kind]`: todas testam o UUID do path contra regex antes de qualquer consulta, e o `kind` contra a lista fechada. Não há rota que aceite id do path direto no banco. |

### 11.2 · S7 · Injeção de fórmula por CSV — BAIXO (latente)

**Confirmado como possível, não como explorável hoje.** `importarClientes` grava `name`, `email` e `tags` **crus**, sem passar pelo `EsquemaCliente` que o caminho de API usa (`z.string().trim().max(...)`). Uma linha com `=CMD("calc")` no nome entra no banco como está.

**Por que é baixo:** não existe nenhuma exportação em CSV no projeto — `grep "text/csv"` só acha o importador. Sem um caminho de saída, a fórmula nunca chega a uma planilha.

**O risco é de amanhã:** `/clients/[id]/data-export` (LGPD) e o extrato de comissão são exatamente onde alguém vai pedir "e em Excel?". No dia em que a primeira exportação em CSV nascer, este dado já está plantado.

**Correção proposta:** prefixar `'` em célula que comece com `=`, `+`, `-` ou `@` **na escrita da exportação** (é lá que a decisão pertence, não na importação), e aplicar o `EsquemaCliente` também no caminho do CSV — hoje o importador aceita nome de 5 MB numa linha só.

---

## 12 · Fase G — Segredos, chaves e criptografia (concluída)

### 12.1 · Verificado e CORRETO

| Item | Evidência |
|---|---|
| **O cofre é cifrado de verdade** | Não é "coluna chamada vault": envelope AES-256-GCM de duas camadas — DEK de 32 bytes por tenant, gerada no onboarding e guardada embrulhada pela KEK em `tenant_keys.dek_wrapped`; cada registro cifrado com a DEK e IV próprio de 12 bytes. Tag adulterada estoura, nunca devolve lixo em silêncio. |
| **A DEK em claro só existe em memória** | Cache de 5 minutos por tenant, nunca em disco nem em coluna. |
| **Nenhum segredo sai em resposta** | `INTERNAL` está preso na mensagem canônica — o construtor do `AppError` ignora `message` customizada nesse código, que é exatamente por onde vazaria o texto de uma exceção do Postgres. A `cause` só vai para o log do servidor. |
| **`compararSegredo`** | `timingSafeEqual` nas 6 rotas de cron, com o comentário admitindo que a exploração não era realista e que a correção entrou por consistência. |
| **`.env.example` sem valor real** | Todas as chaves vazias. `.gitignore` cobre `.env*`. O CI ainda tem um `git grep` por JWT em formato de token do Supabase, que reprova sem precisar conhecer segredo nenhum. |
| **`PHONE_HASH_SALT`** | `hashTelefone` **lança** se o sal estiver ausente, em vez de hashear sem ele — não existe caminho que compare telefone sem sal por engano. |

### 12.2 · S8 · Não existe rotação de KEK; rotacionar torna todo cofre ilegível — MÉDIO

**Confirmado.** A pergunta do escopo era: *"o `_VERSION` é usado para permitir decifrar dado antigo depois de rotacionar?"* A resposta é **não**, em três partes:

1. `abrirDekCifrada()` chama `kek()`, que lê **só** `process.env.VAULT_KEK`. Não existe `VAULT_KEK_PREVIOUS` nem lista de chaves aceitas — ao contrário do `token-assinado.ts`, que na correção do S1 fez exatamente isso para os links públicos.
2. `key_version` é **escrito** em `tenant_keys` e em `health_records`, e **nunca lido** para escolher chave. `grep key_version` confirma: só aparece em `insert`/`select` de trilha.
3. Não existe script de re-embrulho. `rewrapDek()` existe, mas para chamá-la é preciso a DEK em claro, que só sai de `abrirDekCifrada()` — que já falhou, porque a KEK mudou.

**O que acontece na prática.** Trocar `VAULT_KEK` no Vercel faz o GCM falhar na autenticação de **todo** `dek_wrapped`. Nenhuma anamnese de nenhum tenant volta a abrir. O `.env.example` já avisa em outra frase: *"Perder esta chave = perder toda anamnese do sistema"* — o que não está dito é que **rotacionar** tem o mesmo efeito que perder.

**Cenário (A5/A7).** A KEK aparece num log, numa captura de tela do painel, ou num pacote npm comprometido que leu `process.env`. A resposta de incidente correta é rotacionar. Hoje, rotacionar é destruir o dado. Ficaria a alternativa de conviver com a chave comprometida — que é a decisão que nenhum time deveria ter que tomar.

**Falsa confiança a corrigir junto:** `tests/integration/vault.test.ts:116` diz simular "a rotação anual da KEK", mas re-embrulha a DEK com a **mesma** KEK (o env não muda). O teste passa e não prova nada sobre rotação.

**Correção proposta:** aceitar `VAULT_KEK_PREVIOUS` em `abrirDekCifrada` (tenta a atual, cai para a anterior) — é o mesmo desenho já validado no S1 — e um script `scripts/rotacionar-kek.mjs` que percorre `tenant_keys`, abre com a anterior e re-embrulha com a atual, subindo `key_version`. Depois disso, um teste que troque a KEK de verdade entre escrita e leitura.

### 12.3 · Observação (sem severidade): o ciphertext não é vinculado ao registro

`encryptVault` não usa AAD. Dois registros do **mesmo** tenant são cifrados pela mesma DEK, então copiar o `ciphertext`/`iv`/`auth_tag` da cliente A para a linha da cliente B decifra sem reclamar. Não vira achado porque exige escrita direta no banco (quem tem isso já tem tudo), mas `setAAD(Buffer.from(clientId))` custa uma linha e fecharia a porta.

---

## 13 · Fase H — Webhooks e integrações (concluída)

**A superfície é zero hoje, e isso é um fato verificado, não uma suposição.**

| Pergunta do escopo | Resposta |
|---|---|
| Webhook do PSP com assinatura verificada? | **Não existe rota de webhook de pagamento.** Nenhum PSP está integrado (Asaas continua bloqueado nos TICKET-031/032/033). Não há endpoint para forjar "pagamento aprovado" porque não há endpoint. |
| Webhook do provedor de WhatsApp valida a origem? | O **parser** valida corretamente — `parseWebhook` monta `sha256=<hmac>` com `WHATSAPP_APP_SECRET` e compara com `timingSafeEqual` depois de conferir o tamanho. Mas **nenhuma rota o chama**: `parseWebhook` é código pronto esperando o TICKET-043. |
| Replay do mesmo evento duplica crédito/pontuação? | A tabela `webhook_events` existe (com RLS ligada e **zero** políticas — só `service_role` alcança, que é o certo para tabela de worker). Hoje **nada escreve nela**. |
| Provedor lento prende worker? | `AbortSignal.timeout(10_000)` nas duas chamadas de saída do WhatsApp, com o comentário explicando que sem isso uma conexão travada segurava o lote inteiro até o timeout da função. Correto. |

**O achado desta fase é uma dívida, não uma falha:** quando o webhook do WhatsApp ou do PSP for ligado, a dedupe por `webhook_events` precisa ser escrita junto — a tabela existir vazia é o tipo de coisa que passa por "já está resolvido" numa leitura rápida. Registrado aqui para a fase que ligar a integração.

---

## 14 · Fase I — Service worker e PWA (concluída)

### 14.1 · A regressão de cache NÃO voltou — reconferido

| Item | Evidência |
|---|---|
| **Nome do cache muda a cada deploy** | `const VERSAO = new URL(self.location.href).searchParams.get('v')`, alimentado por `NEXT_PUBLIC_BUILD_ID` (`next.config.ts`: `VERCEL_GIT_COMMIT_SHA \|\| VERCEL_URL \|\| "dev"`, com `\|\|` e não `??` porque a variável vem como string vazia em deploy por CLI). A causa raiz da `docs/13` — string fixa `ciclo-v2` — está fechada e continua fechada. |
| **Nenhuma rota autenticada é cacheada** | `NUNCA_CACHEAR` cobre `/api`, `/auth`, `/admin`, `/onboarding`, `/entrar`, `/cadastro`, `/verificar`, `/nova-senha`, `/recuperar-senha`. O pré-cache do `install` tem **um** item: `/manifest.json`. |
| **`no-store` do servidor é respeitado** | `respostaCacheavel()` recusa qualquer resposta com `no-store` no `Cache-Control`, inclusive no ramo cache-first de `/_next/static/`. |
| **Mutação nunca passa pelo cache** | `if (request.method !== 'GET') return`. |
| **Sem `localStorage`/`sessionStorage` no projeto inteiro** | Varredura completa: zero ocorrências. |
| **`(client)/minha-conta` é pasta vazia** | Não é superfície — não tem arquivo nenhum dentro. |

### 14.2 · S9 · Não existe como sair da conta, e a fila offline nunca é limpa — MÉDIO

**Confirmado.** Duas metades do mesmo problema, as duas achadas por varredura:

1. **`POST /api/v1/auth/logout` existe, está bem escrito (`signOut({ scope: 'global' })`, que derruba os refresh tokens dos outros aparelhos) e nada o chama.** Busca por `auth/logout`, `signOut`, `Sair da conta` em `src/app`, `src/components` e `src/lib`: **zero** ocorrências fora do próprio arquivo da rota. Não há botão de sair em lugar nenhum da interface.
2. **O IndexedDB `ciclo-offline`, store `mutations`, guarda o corpo de cada mutação pendente** — nome de cliente, telefone, dados de agendamento. `grep deleteDatabase` não devolve nada: a fila nunca é apagada, e não haveria a que evento pendurar a limpeza, já que não existe logout.

**Cenário (A2 / dispositivo compartilhado).** O tablet do balcão é o caso de uso central deste produto. A recepcionista de manhã abre o app; a da tarde usa o mesmo tablet e continua na sessão da primeira, porque não há como encerrá-la — sem mexer nos cookies do navegador, o que ninguém faz. Se alguém for desligado, a sessão dele naquele aparelho segue de pé até o refresh token vencer sozinho. E, mesmo que alguém limpe cookies, a fila de mutações no IndexedDB fica.

**Nota de justiça:** o `has_tenant()` confere `m.active`, então **desativar a membership** revoga o acesso ao banco na hora, mesmo com a sessão viva. Isso limita o dano de verdade e é por isso que o achado é médio e não alto. O que falta é o caminho normal, do dia a dia, de trocar de pessoa no mesmo aparelho.

**Correção proposta:** botão "Sair" na `Topbar` do shell autenticado, chamando a rota que já existe; e, no mesmo `onClick`, `indexedDB.deleteDatabase('ciclo-offline')` antes de redirecionar (drenar a fila primeiro se houver rede, descartar se não houver — descartar mutação de outra pessoa é melhor que enviá-la na sessão seguinte).

---

## 15 · Fase J — Cabeçalhos, CSP e transporte (concluída)

### 15.1 · Verificado e CORRETO

| Item | Evidência |
|---|---|
| **Nonce por requisição, de verdade** | `crypto.randomUUID()` no Edge, carimbado no header **da requisição** (é como o Next acha o próprio nonce para o script de hidratação) e no da resposta. `'unsafe-inline'` fica no `script-src` só como degradação para navegador sem suporte a nonce — todo navegador CSP nível 2+ ignora `unsafe-inline` na presença de `nonce-`/`strict-dynamic`. |
| **`style-src` sem nonce, e o comentário explica por quê** | Nonce em CSP cobre `<style>`/`<link>`, nunca o atributo `style=""` que o React usa em barra de progresso e posição de calendário; e nonce presente faz o navegador ignorar `'unsafe-inline'`. A distinção foi medida ao vivo, não deduzida. |
| **`unsafe-eval` só em `development`** | Cravado em `NODE_ENV === 'development'`; o build de produção não usa `eval`. |
| **Conjunto completo, não só o CSP** | HSTS com `preload` e 2 anos, `nosniff`, `X-Frame-Options: DENY` + `frame-ancestors 'none'`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` fechando geolocation/camera/microphone/payment/usb, COOP e CORP `same-origin`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`. |
| **Os cabeçalhos sobrevivem aos dois desvios do middleware** | `aplicarCabecalhosDeSeguranca` é chamada de novo dentro do `setAll` (quando o cookie de sessão é renovado, a resposta é reconstruída) **e** no `NextResponse.redirect` para `/entrar`. É o ponto que a maioria das implementações perde. |

### 15.2 · S10 · `no-store` só no HTML de `/admin/*`; nenhuma resposta de `/api/v1` leva `Cache-Control` — MÉDIO

**Confirmado no código; header real de produção não medido** (o `curl` contra produção não foi autorizado nesta rodada).

`ehProtegida()` lista `['/admin', '/onboarding']`. O `matcher` do middleware **inclui** `/api/*`, então essas rotas recebem CSP, HSTS e o resto — mas não o `Cache-Control`, porque não casam com nenhum dos dois prefixos. E `grep -rn "Cache-Control" src/app/api src/server` devolve **zero** — nenhuma rota define o header por conta própria.

Isso deixa sem `no-store`, entre outras:

- `GET /api/v1/clients/{id}/vault` — **ficha de saúde decifrada**, a resposta mais sensível do produto;
- `GET /api/v1/media/{id}/url` — URL assinada de foto de cliente;
- `GET /api/v1/clients` — a base inteira;
- `GET /api/v1/cash/daily` — faturamento.

O CLAUDE.md deste projeto tem, na tabela de armadilhas conhecidas, a linha *"Cachear resposta de `/vault` ou mídia assinada no service worker → Proibido"*. O service worker **obedece** (a deny-list cobre `/api`). A camada HTTP, que é a que sobrevive ao PWA, não recebeu a mesma regra.

**Cenário.** Tablet compartilhado do balcão, sem logout (S9): o cache de disco do navegador guarda o JSON da ficha de saúde. A próxima pessoa não precisa nem estar logada para o `Back`/histórico servir do cache. E qualquer proxy corporativo ou CDN que entre na frente algum dia tem permissão de guardar a resposta.

**Correção proposta:** trocar `if (protegida)` por "`protegida` **ou** `pathname.startsWith('/api/')`" no `aplicarCabecalhosDeSeguranca` — as rotas públicas de `/api/v1/public/*` não perdem nada com `no-store`, o volume delas é baixo e a disponibilidade não depende de cache de navegador. É a mesma defesa em profundidade que o comentário do próprio middleware já argumenta para o HTML.

---

## 16 · Fase K — Lógica de negócio e dinheiro (concluída)

### 16.1 · Verificado e CORRETO

| Item | Evidência |
|---|---|
| **`comIdempotencia` fecha a corrida de verdade** | Reserva a chave com `insert ... on conflict` **antes** de executar (um `select` antes do `insert` deixaria as duas passarem); quem perde a corrida lê o resultado. Chave gravada como `{tenantId}:{chave}` **e** filtrada por `tenant_id` — o filtro redundante está lá de propósito, para o vazamento não voltar se o prefixo sumir numa refatoração. Corpo diferente com a mesma chave dá `IDEMPOTENCY_KEY_REUSED`; primeira tentativa ainda rodando dá 429 em vez de duplicar; erro solta a reserva para a fila offline poder reenviar. |
| **Reivindicação de job é atômica no banco** | `claim_jobs` roda `update ... where id in (select ... for update skip locked)` inteiro numa transação do Postgres — não são duas idas do PostgREST. `revoke all ... from public, anon, authenticated`: só o worker chama. |
| **Uso de pacote é atômico** | `usarPacote` faz `update` condicional e devolve `SLOT_TAKEN` quando zero linhas voltam. **O projeto já sabe o padrão certo** — é o que torna o S11 abaixo uma inconsistência interna, não uma lacuna de conhecimento. |

### 16.2 · S11 · Débito de carteira é ler-decidir-escrever, sem atomicidade — **ALTO**

**Confirmado.** `pacotes.ts`, `debitarCarteira`:

```ts
const saldo = await saldoCarteira(db, tenantId, entrada.clientId)   // 1. lê a soma
if (saldo < entrada.amountCents) throw ...                          // 2. decide
const { error } = await db.from('wallet_entries').insert({ ... })   // 3. escreve
```

Três idas de rede separadas. Não há `for update`, nem transação serializável, nem constraint no banco impedindo que a **soma** de `wallet_entries` fique negativa (a tabela é um livro-razão; a regra "não pode ficar devendo" existe só neste `if`).

**Cenário (atacante A6, insider com papel limitado).** A recepcionista tem `comanda:own`, que é tudo o que `/api/v1/wallet/debit` exige. Uma cliente amiga tem R$ 100 de crédito. Ela dispara cinco `POST /api/v1/wallet/debit` **em paralelo**, cada um de R$ 100, cada um com um `Idempotency-Key` diferente — a idempotência não ajuda aqui, ela existe justamente para deduplicar chamadas *iguais*, e estas são cinco operações declaradamente distintas. As cinco leem `saldo = 10000`, as cinco passam pelo `if`, as cinco inserem `-10000`. Saldo final: **−R$ 400**. Foram R$ 500 em serviços pagos com R$ 100 de crédito, e o rombo aparece no caixa como "cliente deve" — exatamente o que a interface (`pacotes-carteira.tsx:49`) escreve na tela, sem que ninguém saiba que não foi um lançamento manual.

Não precisa de má-fé para acontecer sozinho, aliás: a fila offline do PWA drena mutações em paralelo quando a rede volta.

**Correção proposta.** Duas opções, em ordem de preferência:

1. Uma função `security definer` `debitar_carteira(tenant, client, valor, motivo)` que faça `select coalesce(sum(amount_cents),0) ... for update` sobre as linhas do cliente e o `insert` na mesma transação — e `revoke execute from anon, authenticated` (regra da casa desde a migration 0004).
2. Ou uma coluna de saldo materializado em `clients` com `check (wallet_balance_cents >= 0)`, atualizada por `update ... set wallet_balance_cents = wallet_balance_cents - $1 where ... and wallet_balance_cents >= $1` — o mesmo desenho de `usarPacote`, que já está no arquivo ao lado.

De qualquer forma, um teste que dispare N débitos concorrentes e prove que só os que cabem passam.

### 16.3 · S12 · Job que morre no meio fica preso em `running` para sempre — BAIXO

**Confirmado.** `claim_jobs` só reivindica `status in ('queued','failed')`. Marca `running` e grava `locked_at` — e **`locked_at` nunca é lido por ninguém** (`grep locked_at` nas migrations: uma ocorrência, a escrita). Não existe reaper de job travado.

Uma função serverless que estoure o tempo, seja derrubada por deploy no meio do lote, ou morra de memória, deixa o job em `running` até alguém abrir o banco na mão.

**Por que é baixo, e não médio:** hoje `vercel.json` tem `crons: []` (plano Hobby, decisão registrada) — **nenhum job roda em produção**, então não há job para travar. O achado é uma dívida que vence no dia em que o cron for ligado.

**Correção proposta:** somar ao `where` do `claim_jobs` a condição `or (status = 'running' and locked_at < now() - interval '15 minutes')`, com `attempts` incrementado — assim o job volta para a fila com backoff em vez de sumir.

### 16.4 · Observação: preço e desconto vêm do cliente, de propósito

`adicionarItemComanda` faz `unitPriceCents = entrada.unitPriceCents ?? servico.price_cents`. É recurso deliberado (ajustar preço no balcão), com `audit_log` gravado e permissão conferida — não é achado. Vale só registrar que `discountCents` é validado como `int().nonnegative()` **sem teto relativo ao total do item**: nada impede um desconto maior que o preço. Vale um limite na próxima passada pelo arquivo.

---

## 17 · Fase L — Dependências e cadeia de suprimentos (concluída)

### 17.1 · Resultado real do `pnpm audit`

Rodado nesta auditoria, saída literal:

```
"vulnerabilities": { "info": 0, "low": 0, "moderate": 0, "high": 0, "critical": 0 },
"dependencies": 931
```

**Zero vulnerabilidades conhecidas em 931 dependências.** A subida preventiva do `next` para `15.5.23` (a RCE `GHSA-9qr9-h5gf-34mp` no protocolo flight) e os `pnpm.overrides` de `postcss`/`sharp` seguem de pé.

### 17.2 · Verificado e CORRETO no CI

| Item | Evidência |
|---|---|
| **Privilégio mínimo** | `permissions: contents: read` no topo do workflow. Nada de `write-all`. |
| **Nenhum segredo no CI** | O job de banco sobe um Supabase efêmero no runner e exporta as credenciais dele; a única chave literal é uma KEK descartável, com o comentário explicando que o banco morre junto com o job. `SUPABASE_SERVICE_ROLE_KEY` de verdade nunca entra. |
| **Trava contra apontar para projeto real** | `case "$API_URL" in http://127.0.0.1:*` … `*) exit 1` — o job reprova se a URL não for local. |
| **`pnpm audit` reprova de verdade** | `--audit-level high` sem `\|\| true` (o `moderate` acima dele é informativo, com `\|\| true`, e o motivo está escrito). |
| **`supabase db lint` reprova de verdade** | O `db lint` sai com código 0 mesmo achando problema; quem reprova é um `node -e` lendo o `--output json`. |

### 17.3 · S13 · Todo esse CI nunca rodou: não existe remoto no git — MÉDIO

**Confirmado.** `git remote -v` devolve **vazio**. O `.github/workflows/ci.yml` é o melhor controle de segurança deste projeto — e é um arquivo que nunca executou uma única vez, porque não há GitHub para executá-lo. O deploy sai de `vercel --prod` direto do CLI, contornando os cinco portões acima.

**Consequência prática, hoje:** o `pnpm audit --audit-level high`, o `db lint` e o **teste de isolamento RLS** só rodam quando alguém lembra de rodar na mão. Uma migration que esqueça a RLS numa tabela nova entra em produção sem nada reprovar.

**Correção proposta:** criar o remoto e ligar os required status checks (o README já diz quais). É a correção de maior retorno desta auditoria inteira — não fecha uma falha específica, liga o mecanismo que impede as próximas.

### 17.4 · S14 · Actions presas em tag mutável — BAIXO

`actions/checkout@v4`, `actions/setup-node@v4`, `pnpm/action-setup@v4`, `supabase/setup-cli@v1`. Tag é ponteiro móvel: quem controla o repositório da action pode reapontá-la.

**Cenário (A7).** Comprometimento de uma dessas contas reaponta `@v4` para código que lê `${{ secrets.* }}` e o ambiente do runner. Aqui o estrago seria limitado — o CI deste projeto não tem segredo nenhum (§17.2) — mas o runner ainda executa código arbitrário sobre o repositório.

**Correção proposta:** fixar por SHA de commit, com o número da versão em comentário ao lado. Fazer junto com o S13, que é quando o CI passa a rodar de verdade.

---

## 18 · Fase M — LGPD e dado sensível (concluída)

### 18.1 · Verificado e CORRETO

| Item | Evidência |
|---|---|
| **Redação de PII antes de qualquer telemetria** | `redigirEventoSentry` está em `beforeSend` **e** `beforeSendTransaction`, com `sendDefaultPii: false`. Duas camadas: chave conhecida (23 termos, incluindo `vault`, `anamnese`, `ciphertext`, `dek`) apaga o valor inteiro; e varredura por padrão de e-mail/CPF/telefone no texto solto, para o caso de o dado estar no meio de uma frase de erro. |
| **O log de requisição não carrega query string** | `handler.ts` monta o envelope com `url.pathname`, nunca `url.search`, com o motivo escrito: `?q=` carrega nome de cliente. |
| **Ficha de saúde nunca pré-carrega** | A tela recebe só o *sinal* de que existe alerta; o conteúdo só chega em `GET /vault`, que exige AAL2 e grava `vault_access_log` com ator, IP e user-agent. |
| **Exportar também é acesso ao cofre** | `exportarDadosDoCliente` grava `vault_access_log` com `action: 'export'` — decifrar é decifrar, independentemente de quem pediu. |
| **Consentimento de marketing é conferido no público de campanha** | `crm.ts:284-285` filtra `whatsapp_opt_out = false` **e** `marketing_opt_in = true`. O `enviarComFallback` confere de novo o opt-out quando `kind === 'campaign'`, e deixa passar transacional (lembrete/confirmação), que é a distinção correta. |
| **Só id viaja em URL** | Padrão registrado e mantido: nome e telefone nunca em query string, que vai para histórico, log e `Referer`. |

### 18.2 · S15 · A eliminação do titular deixa CPF, endereço, contato de emergência e alergia para trás — **ALTO**

**Confirmado.** `eliminarCliente` (`lgpd.ts`) foi escrito para o TICKET-054. As migrations **0017**, **0019** e **0020** vieram depois e acrescentaram dado pessoal que a função não conhece. O `update` de anonimização limpa exatamente oito campos: `name`, `phone_e164`, `phone_hash`, `email`, `birth_date`, `notes`, `tags`, `source`.

Fica intacto, na mesma tabela `clients`:

| Coluna | Migration | O que é |
|---|---|---|
| `document` | 0019 | **CPF** |
| `address` | 0019 | Endereço residencial |
| `emergency_contact` | 0019 | Nome e telefone de **um terceiro**, que nunca foi cliente do salão |
| `gender` | 0019 | Texto livre |
| `preferences` | 0017 | Inclui **alergia** (§18.3) |

E, em tabelas com `client_id` que a função nem visita: `client_notes` (0019, anotação datada em texto livre), `client_reviews` (0020, comentário escrito pela própria cliente), `messages` (histórico com o nome no corpo), `waitlist`, `client_subscriptions`, `loyalty_entries`, `quotes` (0028), `appointment_series` (0027).

O detalhe que resume o problema: a função **limpa `clients.notes`**, que é o campo antigo, aposentado justamente porque se sobrescrevia — e **não toca em `client_notes`**, a tabela que o substituiu e que é onde as anotações realmente vivem hoje.

**Cenário (LGPD art. 18, VI).** Uma cliente pede a eliminação dos dados. A dona abre a ficha, clica em eliminar, e o sistema responde `{ anonymized: true }`. A tela mostra "Cliente eliminada". O CPF, o endereço, o contato de emergência de um parente, a alergia e cada anotação datada continuam no banco, indefinidamente. **O sistema afirma ter cumprido uma obrigação legal que não cumpriu** — e é essa afirmação, mais que o resíduo em si, que faz disto um achado alto: ninguém vai procurar de novo.

**Correção proposta:**
1. Acrescentar as cinco colunas ao `update` de anonimização e apagar as linhas de `client_notes`, `client_reviews`, `waitlist` e `messages` do cliente (as três primeiras não têm valor fiscal; `messages` pode ficar com o corpo redigido em vez de apagado, se a trilha de envio importar).
2. **Impedir a próxima repetição**, que é o que de fato conserta: um teste que leia `information_schema.columns` de `clients` e as tabelas com FK para `clients`, e reprove quando aparecer uma coluna/tabela nova que a eliminação não trate. Sem isso, a migration 0030 vai reabrir o mesmo buraco — é exatamente como este nasceu.

### 18.3 · S16 · "Alergia" mora em `clients.preferences`, em texto claro, fora do cofre — MÉDIO

**Confirmado, e o próprio código admite.** O comentário de `EsquemaCliente` diz: *"O que a pessoa que atende precisa lembrar na hora (número da máquina, como faz a barba, **alergia**)"*. E `lib/preferencias.ts` põe um campo `alergia` explícito em **seis das sete** verticais (`nails`, `hair`, `lashes`, `brows`, `waxing`, `aesthetics`), mais `sensibilidade` em `waxing` e `pele`/`ativos` em `aesthetics` — tudo isso é dado de saúde na definição do art. 5º, II da LGPD.

Onde esse dado cai: `clients.preferences`, jsonb, **em claro**. Compare com o mesmo tipo de dado em `health_records`:

| | `health_records` (cofre) | `clients.preferences` |
|---|---|---|
| Cifragem | AES-256-GCM com DEK por tenant | nenhuma |
| Exige MFA | sim (`exigirAal2`) | não |
| Registra acesso | `vault_access_log` | não |
| Pré-carrega na tela | não, só o sinal de alerta | sim, vem junto com a ficha |
| Redigido antes do Sentry | sim (`vault`, `anamnese`, `answers` estão em `CHAVES_SENSIVEIS`) | **não** — `preferenc`, `alergia` e `notes` não estão na lista |
| Apagado na eliminação | sim | **não** (S15) |

**Cenário.** Não é preciso atacante externo: qualquer profissional do tenant lê `GET /api/v1/clients/{id}` e recebe a alergia junto, sem MFA e sem deixar rastro — enquanto a mesma informação, digitada dois campos adiante na anamnese, exigiria segundo fator e ficaria registrada. E qualquer exceção que carregue um objeto de cliente manda a alergia para o Sentry, contra a regra 9 do CLAUDE.md, que é literal: *"Dado de saúde nunca em log, Sentry ou analytics"*.

**Correção proposta, em duas partes de custo bem diferente:**
1. **Barato e imediato:** acrescentar `preferenc`, `alergia`, `sensibilidade`, `notes`/`nota` e `observ` a `CHAVES_SENSIVEIS` em `redact.ts`, e incluir `preferences` na anonimização do S15. Fecha o vazamento por telemetria e o resíduo na eliminação sem mexer no produto.
2. **A decisão de produto, que não é minha:** os campos de saúde de `preferencias.ts` deveriam migrar para o cofre? Ganham cifragem e trilha; perdem o "está ali junto quando abro a ficha", que é exatamente o que faz o recurso ser usado. Uma saída intermediária é manter `preferences` para o que é preferência de verdade (máquina, formato, cor) e mandar só `alergia`/`sensibilidade`/`ativos` para a anamnese, que já existe e já tem tela. Fica registrado como pergunta, não como correção aplicada.

### 18.4 · Observação: três mecanismos de consentimento, um enforcado

Convivem `consents(kind='marketing')` (tabela, com `granted_at`/`revoked_at`), `clients.marketing_opt_in` (booleano) e `clients.whatsapp_opt_out` (booleano). O envio confere os **dois booleanos**; a tabela `consents` é escrita e nunca lida para decidir envio. Não vira achado porque o caminho que roda está correto e é restritivo — mas duas fontes da verdade para a mesma pergunta é como uma delas fica velha.

---

## 19 · Fase N — Infraestrutura (parcial — ver §20)

### 19.1 · Verificado ao vivo no Supabase de produção (só leitura, autorizado)

Isto não é leitura de migration: é o estado real do banco em 2026-08-23.

| Item | Medido |
|---|---|
| **RLS em toda tabela** | **50 de 50** tabelas do schema `public` com `relrowsecurity = true` **e** `relforcerowsecurity = true`. Nenhuma exceção. Nenhuma tabela alcançável pelo PostgREST sem política. |
| **Views** | **4 de 4** (`v_carteira_resumo`, `v_client_segments`, `v_daily_cash`, `v_recover_revenue`) com `security_invoker=true` nas `reloptions`. A armadilha do CLAUDE.md ("view sem `security_invoker` fura a RLS") está fechada — verificada, não presumida. |
| **Bucket de armazenamento** | Um único bucket, `media`, com **`public = false`**, teto de 10 MB e MIME fechado em jpeg/png/webp. É a armadilha que o Stark Base registrou em outro projeto da família; aqui não se repetiu. |
| **Tabelas sem política** | Quatro — `cron_heartbeats`, `idempotency_keys`, `job_queue`, `webhook_events`. O advisor marca como `INFO`; **não é buraco, é o contrário**: RLS ligada com zero políticas nega tudo para `anon`/`authenticated`, e só a `service_role` (worker) alcança. É o desenho certo para tabela de infraestrutura. |
| **Proteção de senha vazada** | Segue desligada — decisão já registrada, pendente do Eduardo. |

### 19.2 · S17 · `can_see_appointment` lê `tenants.settings` de qualquer tenant por cima da RLS — BAIXO

**Confirmado, e corrige uma afirmação da Fase A.** O §2 desta auditoria diz que as quatro funções `security definer` executáveis *"só respondem sobre o próprio `auth.uid()`"*. Três respondem. A quarta, não:

```sql
create function can_see_appointment(t uuid, prof uuid) ... security definer as $$
  select case
    when tenant_role(t) in ('owner','manager','reception','finance') then true
    when coalesce((select (settings->>'restrict_professional_view')::boolean
                   from public.tenants where id = t), false) = false then true
    else prof = my_professional_id(t)
  end;
$$;
```

O `select ... from public.tenants where id = t` roda como `security definer`, ou seja **por cima da RLS** — e a política real de `tenants` é `tenants_select: has_tenant(id)`, que negaria essa leitura a quem não é membro. A função é executável por `anon` e `authenticated` via `/rest/v1/rpc/can_see_appointment` (confirmado pelo advisor do Supabase).

**Cenário (A1, dono de outro salão — ou qualquer pessoa sem login).** `POST /rest/v1/rpc/can_see_appointment` com o uuid de um tenant alheio e um `prof` qualquer devolve `true` quando aquele tenant tem `restrict_professional_view` desligado, e `null` quando tem ligado. É um oráculo de um bit sobre a configuração de outro salão.

**Por que baixo:** o bit exposto é uma configuração que hoje **nenhum tenant tem ligada** e que sequer tem tela (é o S3), não diz nada sobre cliente, agenda ou dinheiro, e nem serve de oráculo de existência (tenant inexistente e tenant com a trava desligada respondem igual). O que faz valer o registro é a classe: uma função `security definer` que lê tabela de outro tenant é a forma exata como um vazamento sério nasce, e esta vai naturalmente ganhar mais lógica quando o S3 for implementado.

**Correção proposta (uma linha, sem efeito colateral):** acrescentar `when not public.has_tenant(t) then false` como **primeiro** ramo do `case`. A política de `appointments` é `has_tenant(tenant_id) and can_see_appointment(...)` — o `and` já elimina o não-membro, então nada muda para quem consulta de verdade; só o oráculo via RPC fecha. Revogar o `execute` seria a alternativa óbvia e é a **errada**: a RLS avalia a função com o privilégio de quem consulta, e revogar transformaria um `select` negado num erro de permissão (foi por isso que a Fase A manteve as quatro executáveis).

### 19.3 · S18 · Três extensões no schema `public` — BAIXO

`btree_gist`, `pg_trgm` e `citext` estão instaladas em `public` (advisor `extension_in_public`). Extensão em `public` amplia o que a resolução de nomes alcança dentro de função.

**Por que baixo e não médio:** todas as 10 funções `security definer` deste schema fixam `set search_path = public` (verificado na Fase A e reconfirmado nas quatro definições lidas agora). O sequestro por schema do atacante, que é o ataque desta classe, já está fechado pelo outro lado.

**Correção proposta:** mover para um schema `extensions` numa janela tranquila — é migration com risco de quebrar índice (`btree_gist` sustenta a `appointments_no_overlap`), então não é trabalho para fazer junto de outra coisa.

---

## 20 · O que NÃO foi verificado, e por quê

Registrado com o mesmo peso do resto: auditoria que não diz onde parou passa a impressão de ter olhado tudo.

| Item | Por quê | Como fechar |
|---|---|---|
| ~~`pnpm test:rls`~~ | ✅ **executado** em 2026-08-23, depois de autorização explícita: **133 testes de isolamento, todos passando** (a memória do projeto dizia 121 — o número certo é 133). Conferido depois que nenhum tenant efêmero ficou para trás: zero criados nas últimas 2h. | Fechado. Continua valendo rodar no CI contra banco efêmero quando o S13 for resolvido. |
| **Cabeçalhos reais de produção** | `curl` contra `ciclo-umber.vercel.app` não foi autorizado. O S10 é confirmado no código; o que falta é medir qual `Cache-Control` a Vercel de fato carimba numa resposta de `/api/v1`. | `curl -sI https://ciclo-umber.vercel.app/api/v1/public/dom-rocha` |
| **Upstash provisionado no Vercel?** | Mesma razão. É a variável que decide se o S4 é alto ou médio. | `vercel env ls production` e procurar `UPSTASH` |
| **Proteção dos deploys de preview da Vercel** | Não consultei o painel. **Importa muito:** o projeto está no plano **Hobby**, onde a proteção por senha/SSO em preview não está disponível, e as 17 variáveis de ambiente foram subidas sem escopo declarado por ambiente. Se um preview aponta para o Supabase de produção e a URL é pública, cada link de preview é acesso não autenticado a dado real. | Conferir no painel se as variáveis de Preview apontam para o mesmo projeto Supabase da produção. Se apontarem, é o próximo achado a investigar — e provavelmente o mais grave que sobrou. |

---

## 21 · Resumo dos achados desta rodada (E–N)

| # | Achado | Severidade | Estado |
|---|---|---|---|
| S4 | Rate limit em memória por instância + captcha desligado | **ALTO** | ✅ **corrigido** (§22.3) · captcha segue desligado (S19) |
| S11 | Débito de carteira não atômico | **ALTO** | ✅ **corrigido** (§22.2) |
| S15 | Eliminação LGPD deixa CPF, endereço, contato de emergência e alergia | **ALTO** | ✅ **corrigido** (§22.1) |
| S5 | `online_booking_blocked` tem botão e não bloqueia | MÉDIO | Confirmado |
| S6 | `ipDe()` lê o primeiro `X-Forwarded-For` | MÉDIO | ✅ **corrigido** (§22.4) |
| S8 | KEK sem caminho de rotação | MÉDIO | ✅ **corrigido** (§22.5) |
| S9 | Sem botão de sair; fila offline nunca limpa | MÉDIO | ✅ **corrigido** (§22.6) |
| S10 | `/api/v1` sem `Cache-Control: no-store` | MÉDIO | ✅ **corrigido** (§22.7) |
| S13 | CI nunca rodou — não existe remoto no git | MÉDIO | Confirmado |
| S16 | Alergia em `clients.preferences`, fora do cofre | MÉDIO | ⚠️ **parcial** (§22.8) — vazamento por telemetria fechado; o modelo de dados é decisão de produto |
| S7 | Injeção de fórmula por CSV | BAIXO | ⚠️ **parcial** (§22.9) — limites do schema aplicados; o escape pertence à exportação, que não existe |
| S12 | Job preso em `running` | BAIXO | ✅ **corrigido** (§22.10) |
| S14 | Actions em tag mutável | BAIXO | ✅ **corrigido** (§22.11) — e uma delas era BRANCH, não tag |
| S17 | `can_see_appointment` lê tenant alheio | BAIXO | ✅ **corrigido** (§22.12) |
| S18 | Extensões em `public` | BAIXO | ⏸️ **não corrigido, por decisão** (§22.13) |

**Nenhum achado crítico.** Nenhum caminho de vazamento entre tenants foi encontrado nesta rodada: a fronteira de isolamento — RLS em 50/50 tabelas com `force`, views com `security_invoker`, `service_role` confinada a um arquivo com regra de lint, `has_tenant()` decidindo por `auth.uid()` — está de pé, e o único furo dela (S17) expõe um bit de configuração, não dado.

Os três achados altos têm o mesmo formato, e vale dizer em voz alta: **os três são promessas que a interface faz e o servidor não cumpre.** O limitador diz que limita, o botão de bloqueio diz que bloqueia, a eliminação diz que eliminou. Nenhum é erro de criptografia ou de política de acesso — o que está bem construído neste projeto está muito bem construído. É a costura entre camadas que cede.

**Ordem sugerida de correção:** S15 (obrigação legal, e a interface afirma cumprir), S11 (dinheiro, e o padrão certo já está no arquivo ao lado), S4 (depende de uma variável de ambiente), depois S13 — que não fecha falha nenhuma, mas liga o mecanismo que impede as próximas.

---

## 22 · Correções aplicadas

### 22.1 · S15 — a eliminação passa a alcançar todo dado pessoal

`eliminarCliente` foi reescrita em torno de uma regra explícita: **o vínculo técnico sobrevive
onde há obrigação fiscal; o vínculo pessoal não sobrevive em lugar nenhum.**

| Tratamento | Onde |
|---|---|
| **anonimiza** | `clients`: as cinco colunas que faltavam — `document` (CPF), `gender`, `address`, `emergency_contact`, `preferences` (que carrega a alergia, S16) — mais `preferred_professional_id` |
| **apaga a linha** | `client_notes` (a tabela que substituiu `clients.notes` e que a versão antiga ignorava), `waitlist`, e o que já sumia: `health_records`, `media` |
| **redige** | `appointments` (`client_note`, `internal_note`, `address`, `cancel_reason`, `risk_features`), `appointment_series` (`note`, `address`), `messages` (`body`, `error`), `quotes` (`message`, `rejected_reason`), `consents` (`ip`, `user_agent`, `signature_key`), `client_reviews` (`comment` + `client_id` → null: a nota sobrevive como estatística anônima, o texto e o vínculo não) |
| **preserva, com motivo escrito** | `payments`, `wallet_entries`, `loyalty_entries`, `tickets`, `client_subscriptions` — registro financeiro sem dado pessoal |

Dois arquivos do storage passam a sair juntos: a mídia da cliente (já saía) e a **assinatura de
consentimento** (`consents.signature_key`), que não saía.

**O que de fato conserta é a guarda, não a lista.** `TRATAMENTO_NA_ELIMINACAO`, em `lgpd.ts`,
declara o que a eliminação faz com **cada** coluna capaz de carregar dado pessoal, e
`tests/unit/server/lgpd-cobertura.test.ts` lê as **migrations** e reprova quando aparece coluna
nova sem declaração. Ler as migrations, e não o banco, foi decisão consciente: reprova no commit
que escreve a coluna, antes de ela existir em produção, e roda no CI sem Postgres nenhum — que é
o que este projeto tem hoje (S13).

O teste também exige **motivo escrito ao lado de todo `preserva`**: preservar dado pessoal é
decisão, e decisão sem porquê é esquecimento com outro nome. Essa regra pegou cinco entradas da
minha própria declaração na primeira execução.

**Verificado:** 11 casos novos, `pnpm test:unit` em 538 testes (era 527), typecheck e lint limpos.
A guarda foi provada por reversão — tirar `clients.document` da declaração faz o teste falhar
nomeando exatamente `clients.document`; restaurar faz passar.

**Executado depois, com autorização:** `tests/integration/lgpd.test.ts` roda e passa (3 testes)
contra o banco de verdade. E foi **provado por reversão**, que é o que separa teste que confere de
teste que acompanha: tirando as cinco colunas do `update` de anonimização, o teste falha com
`expected '123.456.789-09' to be null` — o CPF sobrevivendo à eliminação, reproduzido; devolvendo,
passa.

### 22.2 · S11 — o débito de carteira decide dentro do banco, numa transação só

A decisão saiu do `if` do JavaScript e virou `debitar_carteira` (migration 0034): trava a linha
da cliente, soma o extrato, compara e insere o lançamento — tudo numa transação.

Duas escolhas que não são óbvias e estão escritas na migration:

**`security invoker`, não `definer`.** A regra da casa desde a 0004 é que função `definer` que
escreve precisa de `revoke ... from anon, authenticated`, senão o PostgREST a publica e `anon`
escreve por cima da RLS. Aqui a função não precisa de privilégio nenhum além do de quem chama —
a rota já usa o cliente do usuário. Como invoker, a RLS de `clients` e de `wallet_entries`
continua valendo inteira. É a opção mais restritiva, não a mais conveniente.

**Trava a linha de `clients`, não as de `wallet_entries`.** `select ... for update` sobre o
extrato tranca o que já existe e **não impede um INSERT concorrente**: em READ COMMITTED a
segunda transação destrava e segue sem enxergar a linha que a primeira acabou de inserir. Seria
uma correção que parece certa e deixa a corrida de pé. A linha de `clients` existe sempre e é
uma só; travá-la serializa o débito daquela cliente, e o `sum` seguinte é comando novo, com
snapshot novo.

Erros distinguidos por **SQLSTATE**, nunca pelo texto (`53000` saldo insuficiente, `P0002`
cliente inexistente, `22023` valor não positivo) — a mensagem em pt-BR é da interface e muda sem
avisar.

**Aplicado em produção** (autorizado explicitamente), em dois passos: a função e, depois, o
`revoke execute ... from public, anon` + `grant ... to authenticated, service_role`. Conferido
depois de aplicar: `prosecdef = false`, `anon` **não** executa, `authenticated` e `service_role`
executam. O arquivo `0034` local consolida os dois passos; o histórico do Supabase tem duas
entradas — replay do zero chega ao mesmo estado.

**Guarda nova, para um risco de deploy que este projeto tinha e ninguém veria:**
`tests/unit/server/rpc-existe.test.ts` confere que toda `db.rpc('nome')` em `src/` tem função
correspondente nas migrations. Nem `typecheck` nem `build` pegam isso — o nome é conferido contra
`types.gen.ts`, que é um arquivo, não contra o Postgres. Subir o código sem a migration faria
**todo débito responder 500**, e nada avisaria antes. Provado por reversão: escondendo a migration,
o teste falha nomeando `debitar_carteira`; devolvendo, passa.

**Verificado:** typecheck, lint e `pnpm test:unit` com **540 testes** (eram 538).

**Executado depois, com autorização — e o número que importa:** com o código antigo restaurado, o
teste de cinco débitos simultâneos falha com **3 dos 5 aceitos**. R$ 300 debitados de um saldo de
R$ 100, saldo final −R$ 200, contra o Postgres de verdade. Não era teoria: a corrida do S11 está
reproduzida. Com a correção, exatamente 1 passa e o saldo termina em 0. Os 9 testes de
`pacotes.test.ts` passam.

---

## 23 · Suítes executadas em 2026-08-23 (resultado real)

Autorização veio depois da primeira rodada da auditoria, então estes números substituem as
lacunas que o §20 registrava.

| Suíte | Resultado |
|---|---|
| `pnpm audit` | **0 vulnerabilidades** (info/low/moderate/high/critical zerados) em 931 dependências |
| `pnpm test:unit` | **540 testes**, 48 arquivos — eram 527 antes das duas guardas novas |
| `pnpm test:integration` | **257 testes**, 39 arquivos, contra o Supabase de produção |
| `pnpm test:rls` | **133 testes de isolamento** entre tenants |
| Resíduo em produção | **nenhum** — zero tenants efêmeros criados nas últimas 2h sobraram |

As duas suítes que a memória do projeto registra como flakes sob carga concorrente
(`health.test.ts`, `agenda-dia.test.ts`) passaram nesta execução.

**Os dois achados altos corrigidos foram provados por reversão contra o banco de verdade**, não só
por teste verde: restaurando o código antigo, um falha mostrando o CPF que sobrevive à eliminação
e o outro mostrando 3 de 5 débitos aceitos sobre saldo insuficiente. Teste que passa sem nunca ter
reprovado não prova nada.

### 22.3 · S4 — o limitador passa a contar num lugar que todas as instâncias enxergam

**Primeiro, o fato que faltava.** `vercel env ls production` em 2026-08-23 devolveu 18 variáveis.
Nenhuma delas é `UPSTASH_REDIS_REST_URL`. O achado estava certo: o limitador de produção era o
`Map` do processo, um balde por instância viva.

**A correção não foi provisionar Upstash.** Upstash exige criar conta em terceiro — a mesma fila
onde Asaas e WhatsApp estão parados há semanas, e o motivo pelo qual este achado ficaria aberto
por tempo indeterminado. O Postgres deste projeto já é compartilhado por todas as instâncias, já
está provisionado e já está no caminho de toda requisição. Migration `0035`: tabela `rate_limits`
+ `consumir_rate_limit`, que incrementa e decide num `insert ... on conflict do update` — atômico,
sem a corrida do S11 dentro do mecanismo cujo trabalho é justamente contar certo.

A ordem virou **Upstash → Postgres → memória**: se o Upstash aparecer um dia, volta a ter
precedência sem mudar mais nada.

**Duas decisões que são troca consciente, não esquecimento:**

- **O teto global de 120/min continua em memória** (`somenteMemoria: true`). Ele roda em *toda*
  requisição da API; levá-lo ao banco custaria uma ida de rede a mais no caminho feliz de tudo
  para reforçar uma rede grossa que não é quem segura o ataque do S4.
- **`/api/v1/public/[slug]/availability` ganhou limite próprio** (60/min por IP), que nunca teve.
  Era a única rota pública sem nada — e é justamente a que um scraper lê antes de atacar: varrer
  serviço × profissional × dia levanta horário de funcionamento, nome de profissional e a agenda
  da semana, que é o passo anterior a esgotar horários com reserva fantasma.

**Limpeza sem cron.** Sem cron no plano Hobby ninguém varreria a tabela, e um scraper rodando IPs
cria linha nova a cada requisição. A função apaga até 50 linhas vencidas **só quando uma janela
nova começa** — fica fora do caminho quente e nunca vira varredura cara escondida dentro de um
contador.

`consumir_rate_limit` leva `revoke ... from public, anon, authenticated` e `grant ... to
service_role`: publicada sem sessão, ela viraria uma forma de queimar o limite de outra pessoa.

**Verificado por reversão:** com o limitador antigo restaurado, o teste "uma SEGUNDA instância
continua a contagem da primeira" falha com `expected true to be false` — a segunda instância
liberando depois de o limite já estar esgotado, que é o S4 exatamente. 6 casos novos.

**O que este achado NÃO fecha:** a hCaptcha continua sem credencial, então `verificarCaptcha()`
segue devolvendo `true`. O S4 cai de alto para médio, não para resolvido — ver S19.

### 22.4 · S6 — o IP deixa de vir de um header que o cliente escolhe

`ipDe()` passa a preferir `x-vercel-forwarded-for` (carimbado pela borda da Vercel, documentado
como não forjável), depois `x-real-ip`, e só então o **último** elemento de `x-forwarded-for` — o
que o proxy anexou, não o que o cliente escreveu. Sem nada, `sem-ip`: balde único, mais restritivo,
nunca mais permissivo.

Isto e o S4 são um mecanismo só: contar num lugar compartilhado não adianta se o atacante escolhe
a chave da contagem. 7 casos novos em `tests/unit/server/ip.test.ts`.

---

## 24 · Achado NOVO, encontrado ao corrigir o S4

### S19 · Três mitigações existem no código e estão inertes em produção — MÉDIO (e reabre o S1)

**Confirmado** por `vercel env ls production`, 2026-08-23. As 18 variáveis de produção **não**
incluem:

| Variável ausente | O que fica inerte |
|---|---|
| `PUBLIC_LINK_SIGNING_KEY` | **A correção do S1.** `chaveDeAssinatura()` cai para `CRON_SECRET` quando ela não existe — então, em produção, os links públicos **continuam assinados com o segredo de cron**. O código foi corrigido e deployado; a variável nunca foi criada. O S1 segue valendo em produção, com a severidade alta que tinha. |
| `HCAPTCHA_SECRET` | `verificarCaptcha()` devolve `true` para qualquer chamada. É a camada desenhada exatamente contra o ataque do S4. |
| `SENTRY_DSN` | Não há telemetria nenhuma. Toda a redação de PII testada no TICKET-057 nunca roda — e, mais grave, **não existe alerta**: um ataque de volume no agendamento público não avisa ninguém. |

**O padrão, que é o achado de verdade:** este projeto tem o hábito bom de degradar em vez de travar
quando falta credencial de terceiro (registrado em `docs/DECISOES.md` desde o TICKET-009). O efeito
colateral é que **uma mitigação ausente fica indistinguível de uma mitigação funcionando** — o
código roda, os testes passam, nada reclama. Foi assim que o S4 sobreviveu, e é por isso que a
correção do S1 está no repositório e não em produção.

**Correção proposta (não aplicada — decisão do Eduardo):**

1. `PUBLIC_LINK_SIGNING_KEY` é a única das três que **não depende de terceiro nenhum**:
   `openssl rand -base64 32` e `vercel env add`. Fecha o S1 hoje, e a verificação aceita as duas
   chaves durante a transição, então nenhum link já enviado por WhatsApp quebra.
2. Um teste de fumaça no deploy que reprove quando uma variável de mitigação estiver ausente com
   `NEXT_PUBLIC_APP_ENV=production` — degradar em silêncio é aceitável em dev, não em produção.

### 22.5 · S8 — a KEK passa a ter como rotacionar sem destruir o cofre

Três peças, e nenhuma delas sozinha resolvia.

**1. `abrirDekCifrada` aceita a chave anterior.** `VAULT_KEK_PREVIOUS` entra como segunda
tentativa — mesmo desenho que a correção do S1 já usou nos links públicos: embrulha com a nova,
abre com qualquer uma das duas enquanto houver material antigo. Aqui, ao contrário do S1, sair na
primeira chave que abre é **correto**: isto roda no servidor, sobre um `dek_wrapped` que só o
servidor leu do banco, sem ninguém do outro lado cronometrando. Conferir todas custaria uma
operação de AES por chamada sem ganho nenhum.

**2. `scripts/rotacionar-kek.mjs`.** Abre com a anterior, fecha com a atual, sobe `key_version`,
grava `rotated_at`. Simulação por padrão; só grava com `--aplicar`.

O ponto delicado: `.mjs` puro não resolve os aliases de path do projeto, então o envelope está
**duplicado** dentro do script — e um envelope escrito diferente do de produção corromperia o
`dek_wrapped` de todo mundo. Por isso o script não confia em si mesmo: faz um ida-e-volta com
material sintético antes de tocar no banco, e **por tenant** confere que o valor novo reabre para
exatamente a mesma DEK antes de gravar. Sem isso, um erro no envelope só apareceria quando alguém
abrisse uma anamnese — depois de a chave antiga já ter sido descartada.

Rodado em simulação contra produção: **8 tenants com cofre, todos abertos com sucesso**, nenhum
precisando rotacionar (já estão na versão 1 com a KEK atual). Que os 8 `dek_wrapped` reais tenham
aberto é, de quebra, a prova de que a criptografia duplicada bate com a de produção.

**3. O teste que dava falsa confiança.** `vault.test.ts` tinha um caso intitulado "rotação de KEK"
cujo comentário dizia "o mesmo que a KEK anual faria" — e que re-embrulhava com a **mesma**
`VAULT_KEK` do ambiente. Ele passava verde enquanto a rotação de verdade era impossível. O título e
o comentário foram corrigidos para dizer o que ele realmente prova (metade: que o re-embrulho
preserva o que já estava cifrado), com ponteiro para onde está a outra metade.

**A outra metade:** `tests/unit/server/kek-rotacao.test.ts`, 6 casos que trocam a chave de verdade
— inclusive o que reproduz o defeito (`sem a chave anterior no ambiente, o material antigo NÃO
abre`) e o que confere que a mensagem de erro diz o que fazer sem entregar pedaço de chave nenhum.

As chaves são **injetadas**, não postas em `process.env`: arquivos do Vitest rodam em threads que
compartilham o env por referência, e um teste que mutasse a KEK vazaria para outro arquivo em
paralelo. É a mesma razão pela qual `token-assinado.ts` já recebe `segredo?` por parâmetro.

`VAULT_KEK_PREVIOUS` documentada no `.env.example`, com o passo a passo da rotação.

### 22.6 · S9 — passa a existir como sair da conta

Botão "Sair da conta" em `/admin/config`, chamando a rota que já existia e nunca era chamada.

**Onde ele NÃO foi.** A Topbar seria o lugar óbvio e é o errado: ela aparece em toda tela, e um
alvo de 48px que encerra a sessão a um toque de distância o dia inteiro, num tablet de balcão, é
acidente esperando acontecer. Configurações é onde a pessoa vai quando *quer* mexer na conta.

**A fila offline sai junto.** `apagarBancoOffline()` remove o IndexedDB `ciclo-offline`, que
guarda o **corpo** de cada mutação pendente — nome de cliente, telefone, dados de agendamento. A
ordem importa e está no código: tenta **drenar** o que estiver pendente primeiro (se houver rede),
e só então descarta o que sobrou. Mandar depois, em nome de quem entrar a seguir, seria pior que
perder. `onblocked` do `deleteDatabase` resolve em vez de rejeitar: outra aba com o banco aberto
não pode travar quem está tentando sair.

`router.replace`, nunca `push` — senão o botão "voltar" do navegador devolve a tela autenticada de
quem acabou de sair.

**O teste é de fiação, não de comportamento, e isso é deliberado.** O componente depende de
`fetch`, `indexedDB` e `useRouter`, e este projeto roda o Vitest em `environment: 'node'`, sem
jsdom. Mais importante: **um teste de comportamento não teria pego o defeito original** — não
havia comportamento nenhum, havia ausência de ligação. Os 4 casos de
`tests/unit/shell/sair-da-conta.test.ts` travam exatamente o que faltava: que alguma tela chama
a rota, que o botão vive em Configurações, que quem chama o logout também apaga o IndexedDB, e
que o redirecionamento usa `replace`.

### 22.7 · S10 — `no-store` passa a cobrir toda a API

**A armadilha que quase entrou junto:** o caminho óbvio era acrescentar `/api` a
`PREFIXOS_PROTEGIDOS`. Isso teria quebrado a API inteira — a mesma variável governa o redirect
para `/entrar`, e toda chamada não autenticada viraria `302` para uma página de login que nenhum
`fetch()` sabe interpretar, em vez de `401` no envelope JSON.

São duas perguntas diferentes e agora têm dois nomes: `exigeSessao()` (redireciona; só telas) e
`naoCacheavel()` (`no-store`; telas **e** `/api/*`). A separação é o conserto de verdade; o header
é consequência.

Passam a sair com `private, no-store`: `GET /clients/{id}/vault` (ficha de saúde **decifrada**),
`GET /media/{id}/url` (URL assinada de foto), `GET /clients`, `GET /cash/daily` e o resto da API,
inclusive as rotas públicas — volume baixo, e a disponibilidade delas não depende de cache de
navegador.

24 casos em `tests/unit/server/middleware-cache.test.ts`, inclusive o que trava a diferença entre
`/api` e `/apiario` — prefixo sem barra é como allow-list vira buraco.

### 22.8 · S16 — parcial, e de propósito

O achado tinha duas partes de custo bem diferente, e só uma delas é minha para decidir.

**Feito — o vazamento por telemetria.** `CHAVES_SENSIVEIS` cobria o cofre (`vault`, `anamnese`,
`answers`, `ciphertext`) e partia de uma premissa que este produto não cumpre: a de que dado de
saúde mora só no cofre. Entraram `preferenc`, `alergia`, `sensibilidade`, `note`, `nota` e
`observ` — que é onde a alergia de fato mora (`clients.preferences`) e onde "está grávida" acaba
escrito (`client_notes.body`, `appointments.client_note`).

Detalhe que só aparece escrevendo o teste: a comparação é `includes`, e **`'notes'` não contém
`'nota'`**, nem o contrário. Uma grafia só cobriria a coluna em inglês ou o campo em português,
nunca os dois. Errei isso na primeira tentativa e o teste pegou.

`clients.preferences` também passou a ser limpo na eliminação, junto com o S15 (§22.1).

**Não feito, e continua registrado como pergunta — não como pendência técnica.** Os campos de
saúde de `lib/preferencias.ts` deveriam migrar para o cofre? Ganhariam cifragem, MFA e trilha;
perderiam o "está ali junto quando abro a ficha", que é justamente o que faz o recurso ser usado
numa recepção movimentada. Uma saída intermediária seria manter `preferences` para preferência de
verdade (máquina, formato, cor) e mandar só `alergia`/`sensibilidade`/`ativos` para a anamnese,
que já existe e já tem tela. **Isso muda comportamento de produto, não é conserto de segurança**,
e inventar a regra dentro de uma auditoria seria decidir no lugar de quem deve decidir.

---

## 25 · Achado NOVO, encontrado ao escrever o teste do S16

### S20 · A redação de PII comia os identificadores do próprio evento — MÉDIO

**Confirmado, e corrigido na mesma passada.** `PADRAO_TELEFONE` era `/\+?\d{10,15}/g`, sem borda
nenhuma. O último grupo de um UUID tem **12 dígitos** — então
`00000000-0000-4000-8000-000000000000` chegava ao Sentry como `...-8000-[redigido]0`. O mesmo
valia para o padrão de CPF.

Foi encontrado por acidente: um teste do S16 afirmava que o `id` do cliente sobrevive à redação
(para o plantão achar o caso) e falhou.

**Por que isto é achado e não zelo excessivo.** Eu mesmo tinha registrado esse padrão no §12/§18
como "falso positivo inofensivo, corrompe timestamp de 13 dígitos". Estava errado, e por um motivo
que só fica claro olhando o uso: `tenant_id` e `client_id` são exatamente o que alguém de plantão
digita na busca do Sentry. Redação que apaga o identificador transforma o evento em ruído — e
evento inútil é o caminho mais curto para alguém desligar a redação inteira, que aí sim vaza
dado de saúde de verdade.

**Correção:** bordas `(?<![\w-])` e `(?![\w-])` nos dois padrões. Num UUID o número vem colado a
um hífen; num telefone de verdade (`"cliente +5511999999999 sem horário"`, `Tel:5511988887777.`)
vem colado a espaço, pontuação ou aspas.

**Verificado com o par indivisível:** 6 casos provando que UUID e `request_id` sobrevivem, e 4
provando que telefone e CPF em texto livre continuam sendo apagados. Afrouxar o padrão até o UUID
passar é fácil; a correção só vale se as duas metades valerem juntas.

**Nota honesta sobre o alcance:** com `SENTRY_DSN` ausente em produção (S19), nada disto está
rodando hoje. Este achado é sobre o dia em que a telemetria for ligada.

### 22.9 · S7 — os limites do schema passam a valer também no CSV

A importação escrevia em `clients` **sem passar pelo `EsquemaCliente`** — duas portas de entrada
para a mesma tabela aceitando coisas diferentes. Um arquivo de 5 MB numa linha só entrava como um
nome de 5 MB. Agora vale o mesmo teto do schema: nome 120, e-mail 254, etiqueta 40, no máximo 20
etiquetas.

**O escape de fórmula continua NÃO feito, e é o certo.** Não existe nenhuma exportação em CSV
neste projeto, então a fórmula não tem por onde sair. Quando a primeira nascer, o escape tem que
ser na **escrita da exportação**, não na importação: prefixar `'` na entrada estragaria o dado de
quem legitimamente se chama "O=Ó". Criar hoje um helper sem chamador seria código morto, contra o
"nunca crie arquivo que o ticket não pediu" do CLAUDE.md. Fica registrado no próprio arquivo, onde
quem for escrever a exportação vai ler.

### 22.10 · S12 — job travado volta para a fila, e agora aparece no alerta

Duas metades, e a segunda eu não tinha visto ao escrever o achado.

**`claim_jobs` reivindica de volta** (migration 0037) o que está em `running` com `locked_at` mais
velho que 15 minutos. Dois detalhes que decidem se a correção presta:

- `attempts + 1` **só** para o reivindicado. No `SET` de um UPDATE o Postgres enxerga os valores
  antigos da linha, então `case when status = 'running'` separa quem voltou de worker morto de
  quem foi reivindicado normalmente. Incrementar para todos duplicaria, porque `finish_job` já
  incrementa em `failed`/`dead`.
- `attempts < max_attempts` no filtro. Worker que morre nunca chama `finish_job`, então este é o
  único lugar que conta a tentativa. Sem teto, um job que derruba o worker toda vez seria
  reivindicado para sempre — derrubando um worker por rodada.

**E o que faltava: o alerta.** `verificarSaude` contava só `queued`/`failed`. O job preso em
`running` era invisível para o reaper **e** para o monitoramento — some em silêncio, que é
exatamente o que o §7 proíbe. Agora conta as duas coisas separadamente, e o caso terminal (job que
esgotou as tentativas preso em `running`) aparece em vez de sumir.

**Achado de brinde, e uma correção da memória do projeto.** O teste
`health.test.ts > job parado na fila` é registrado como flake causada por "contenção de rede ao
rodar 15 suítes contra a mesma nuvem". **Não é.** A causa, medida agora: o teste insere um job
`queued` com `run_after` no passado — que é exatamente o critério de `claim_jobs` — e o worker de
`job-queue.test.ts`, rodando em paralelo, **reivindica o job de fixture dele**. O status vira
`running` e `checarFila` não acha mais nada. Não há estado "esperando na fila" imune a isso, então
foi deixado como está, com a causa escrita ao lado: enfraquecer a asserção para o teste parar de
piscar seria trocar um teste que mede por um que acompanha. O caso `running` novo é determinístico
(usa `attempts >= max_attempts`, que o reaper não toca) e **passa sob carga paralela**.

### 22.11 · S14 — actions fixadas por SHA

Os 10 `uses:` do workflow passaram a apontar para commit, com a versão no comentário ao lado.

**O que só apareceu ao corrigir:** `supabase/setup-cli@v1` **não era uma tag**. É um branch
(`refs/heads/v1`), que se move a cada push — mais volátil que tag, e com a mesma cara de versão
fixa. O achado original dizia "tag mutável"; era pior que isso.

`tests/unit/server/actions-fixadas.test.ts` reprova qualquer `uses:` com ref que não seja SHA de
40 caracteres, e também SHA sem comentário de versão — porque `11d5960` sozinho é indecifrável
numa revisão.

### 22.12 · S17 — a função para de responder sobre tenant alheio

Um ramo, no topo do `case`: `when not public.has_tenant(t) then false`.

Conferido antes de aplicar que não muda nada para quem consulta: as **seis** políticas que usam
`can_see_appointment` (appointments, appointment_series e quotes, select e update de cada) são
todas `has_tenant(tenant_id) and can_see_appointment(...)`, então o `and` já eliminava o
não-membro. O que fecha é só o caminho pelo RPC direto.

Revogar o `EXECUTE` seria a saída óbvia e é a **errada**: a RLS avalia a função com o privilégio
de quem consulta, e revogar transformaria um `select` negado num erro de permissão. Foi por isso
que a 0004 manteve as quatro auxiliares executáveis, e continua valendo.

### 22.13 · S18 — não corrigido, por decisão

`btree_gist`, `pg_trgm` e `citext` continuam em `public`.

O ataque desta classe é sequestro por schema dentro de função, e ele **já está fechado pelo outro
lado**: todas as 10 funções `security definer` deste schema fixam `set search_path = public`.

Do outro lado da balança, `btree_gist` sustenta a constraint `appointments_no_overlap` — a única
coisa que garante que duas clientes não sejam marcadas no mesmo horário, que é o invariante mais
importante do produto. Mover a extensão é DDL com dependência de opclass, e este projeto não tem
cron rodando, não tem teste de restauração de backup validado e não tem CI executando (S13).

Mexer nisso dentro de um loop autônomo, para fechar um achado cuja mitigação já existe, seria
trocar risco baixo por risco alto. Fica para uma janela com alguém olhando.

---

## 26 · Fechamento — 2026-08-23

### 26.1 · Estado final dos 20 achados

| Situação | Achados |
|---|---|
| ✅ **Corrigido e verificado** (12) | S1†, S2, S4, S6, S8, S9, S10, S11, S12, S14, S15, S17, S20 |
| ⚠️ **Parcial** (2) | **S7** — limites do schema aplicados; o escape de fórmula pertence à exportação, que não existe. **S16** — vazamento por telemetria e resíduo na eliminação fechados; o modelo de dados é decisão de produto. |
| ⏸️ **Não corrigido, por decisão** (2) | **S18** — a mitigação da classe já existe e mover `btree_gist` arrisca a constraint que impede agendamento sobreposto. **S3** — depende de decidir o que significa "meu cliente". |
| 🔑 **Depende do Eduardo** (2) | **S13** — criar o remoto no GitHub. **S19** — criar as variáveis de ambiente. |

† S1 está corrigido **no código** e continua valendo **em produção**, porque
`PUBLIC_LINK_SIGNING_KEY` nunca foi criada no Vercel. É o S19.

### 26.2 · Verificação final, resultado real

| Suíte | Resultado |
|---|---|
| `pnpm typecheck` / `pnpm lint` | limpos |
| `pnpm test:unit` | **598 testes**, 53 arquivos (eram 527 no início) |
| `pnpm test:integration` | **263 de 264** — a única falha é a flake documentada em §22.10, com a causa medida |
| `pnpm test:rls` | **133 testes** de isolamento |
| `pnpm audit` | **0 vulnerabilidades** em 931 dependências |
| `pnpm build` | limpo |
| Resíduo em produção | **nenhum** — 0 tenants de teste, 0 baldes de rate limit, 0 jobs presos |

**71 testes novos** ao longo das correções. Os que importam não são os que passam: são os que
foram **provados por reversão** contra o banco de verdade — restaurando o código antigo, um mostra
o CPF sobrevivendo à eliminação, outro mostra 3 de 5 débitos aceitos sobre saldo insuficiente,
outro mostra a segunda instância liberando depois do limite esgotado. Teste que passa sem nunca ter
reprovado não prova nada.

### 26.3 · Quatro migrations aplicadas em produção

`0034` (débito atômico), `0035` (rate limit compartilhado), `0036` (`can_see_appointment`),
`0037` (reivindicar job travado). Todas aditivas, todas conferidas depois de aplicar.

**O código que as usa está no working tree e não está commitado.** Isso não quebra nada — as
funções são novas e o código antigo não as chama —, mas significa que todo o valor desta rodada
existe em um lugar só, sem remoto (S13).

### 26.4 · O que sobra, em ordem de retorno

1. **`PUBLIC_LINK_SIGNING_KEY`** (S19/S1). Não depende de terceiro nenhum:
   `openssl rand -base64 32` + `vercel env add`. Fecha hoje o único achado **alto** que continua
   valendo em produção. A verificação aceita as duas chaves na transição — nenhum link já enviado
   por WhatsApp quebra.
2. **Remoto no GitHub** (S13). Não fecha falha nenhuma; liga o mecanismo que impede as próximas.
   O `ci.yml` é o melhor controle de segurança deste projeto e nunca executou uma única vez.
3. **`HCAPTCHA_SECRET`** (S19). É a camada desenhada contra o ataque do S4.
4. **`SENTRY_DSN`** (S19). Hoje não existe alerta nenhum: um ataque de volume no agendamento
   público não notifica ninguém.
5. **Proteção de preview da Vercel** (§20). Continua sem verificação e é o maior risco não medido
   desta auditoria: plano Hobby não tem proteção por senha em preview, e se as variáveis de
   Preview apontam para o Supabase de produção, cada link de preview é acesso não autenticado a
   dado real.
6. As duas perguntas de produto: o que significa "meu cliente" (S3) e se a alergia deve migrar
   para o cofre (S16).
