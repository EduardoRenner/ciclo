# 10 · Próximos passos (pós-plataforma)

**2026-08-20.** Todas as fases de `09-PLATAFORMA.md` §15 (P−1 a P11) estão resolvidas: feitas,
parciais por decisão consciente, ou bloqueadas por decisão de negócio real. P4 (onboarding) foi
o achado mais importante da revisão — sem ele, todo o catálogo multi-profissão era inacessível
no cadastro; corrigido no mesmo dia (TICKET-072).

Este documento é o que vem depois: não é mais "ampliar o produto", é **verificar que o que foi
construído aguenta gente de verdade**, e depois voltar a ampliar com base no que faltar.

---

## 1. Verificação estrutural (VERIFICACAO-FINAL.md)

O checklist universal de 15 gates criado no início desta sessão (`C:\Users\Usuario\.claude\code\VERIFICACAO-FINAL.md`)
nunca rodou contra o CICLO de ponta a ponta — só pedaços foram tocados de passagem (RLS, testes,
migrations) como parte de cada fase, nunca como auditoria dedicada. Sequência recomendada,
cada uma cabendo numa iteração do loop:

- **V1 — Gates 0-4** (repositório/higiene, build/lint, testes automatizados, config/segredos,
  banco/RLS). Boa parte já está coberta pela disciplina desta sessão (RLS sempre testado,
  `pnpm verify` rodado a cada commit) — o valor aqui é confirmar formalmente, não descobrir do
  zero.
- **V2 — Gate 5** (segurança de aplicação: auth/autorização, injeção, CSP/headers, abuso/custo).
  CSP com nonce já existe (`src/middleware.ts`); vale conferir contra a lista de armadilhas do
  Anexo A do checklist.
- **V3 — Gate 6** (fluxos de negócio ponta a ponta: jornada principal, pagamento, mensageria,
  painel). Pagamento não se aplica ainda (Asaas bloqueado, P11) — mas os outros três sim, e boa
  parte já foi testada ao vivo nesta sessão fase a fase; falta o passe formal comparando contra
  o checklist.
- **V4 — Gates 7-10** (interface/conteúdo/acessibilidade, responsividade, performance,
  SEO/compartilhamento). Ainda não verificado nesta sessão.
- **V5 — Gates 11-14** (observabilidade/resiliência, legal/LGPD, deploy/pós-deploy, entrega ao
  cliente). **Antes de V5:** confirmar se o CICLO está de fato publicado (há projeto Vercel
  linkado — `starkinovacoes/ciclo` — mas `NEXT_PUBLIC_APP_URL` local aponta pra `localhost:3000`
  e não há remoto git configurado). Se não estiver no ar, gates 13/14 ficam ➖ justificados até
  a decisão de publicar ser tomada — não é trabalho técnico, é decisão do Eduardo.

## 2. Verificação de design (DESIGN-E-INTERFACE.md)

O companheiro do checklist acima (`C:\Users\Usuario\.claude\code\DESIGN-E-INTERFACE.md`) também
nunca rodou dedicado contra o CICLO — só `08-REDESIGN-E-IDENTIDADE.md` (Parte I, already ✅) tratou
disso, e antes da virada multi-profissão. Vale conferir se as telas novas desta sessão (série de
recorrência, orçamento, seletor de modelo de preço, busca de profissão no onboarding) seguem os
mesmos tokens/animação/copy do resto do produto — foram construídas rápido, sob o loop, sem o
mesmo nível de escrutínio visual que o resto já recebeu no `08`.

## 3. Backlog conhecido (não é trabalho novo — é o que já ficou registrado)

Tudo abaixo já está em `09-PLATAFORMA.md` §19, listado aqui só pra não se perder no meio de 15+
entradas:

| Item | Por que ainda não foi feito |
|---|---|
| Preço de faxina/eletricista confirmado com gente da área | P5 usou conhecimento geral, sem WebSearch na sessão |
| Tela de gestão de séries de recorrência (P7) | UI que só faz sentido com tenant de verdade usando |
| Converter orçamento aprovado em agendamento (P8) | decisão de UX de como escolher data/hora |
| Extensão automática do horizonte de séries (P7) | precisa de cron, não construído |
| Fotos/galeria na página pública (P6) | precisa de desenho de consentimento LGPD primeiro |
| Instrumentação do funil de onboarding (P4/§13.2) | sem tráfego real ainda pra medir |
| Marca única vs. marca recortada por nicho (§8/§13.1) | decisão comercial do Eduardo |
| Projeto Supabase próprio pra dev (§1.1) | decisão de custo do Eduardo |

## 4. O que só o Eduardo decide (não vira tarefa de loop)

- Preço de cada plano e o que libera (§13).
- Publicar o CICLO de verdade (domínio, Vercel) ou continuar em desenvolvimento.
- Segunda profissão-alvo comercial depois da beleza.
- Credenciais Asaas (P11).
- Nome do produto continuar CICLO ou mudar.
- Identidade jurídica para Política de Privacidade/Termos de Uso (razão social, CNPJ, contato
  do encarregado de dados) — achado em V5/Gate 11, registrado em `DECISOES.md`.

---

**Ordem sugerida pro loop:** V1 → V2 → V3 → V4 → (decisão de publicar) → V5, intercalando com
qualquer achado real que apareça no caminho — o padrão desta sessão inteira foi auditar antes
de construir, e registrar bloqueio real em vez de fingir que resolveu. Continua valendo.

---

## Relatório V1 — Gates 0-4 (2026-08-20, TICKET-073)

Matriz de escopo preenchida: site público ✅, painel admin ✅ (owner/manager/professional/
reception/finance), banco Supabase ✅ (`sukloaoodpxjukngyojo`), auth de usuário final ✅,
pagamento online ➖ (Asaas bloqueado, P11), mensageria ✅ (WhatsApp Cloud API + push + e-mail
fallback), IA em rota pública ➖ (não existe), upload de arquivo ✅ (bucket `media`), cron ✅
(lembretes, health check, fila de jobs), dado sensível ✅ (anamnese/saúde, LGPD), deploy ⬜
**não confirmado** — há projeto Vercel linkado (`starkinovacoes/ciclo`) mas `NEXT_PUBLIC_APP_URL`
local aponta pra `localhost:3000` e não há `git remote` configurado; não é ➖, é pendência real
de confirmar com o Eduardo antes de V5.

### Achado real (S1/S2 — corrigido nesta rodada)

**`public.profiles` nunca teve FK pra `auth.users`.** Confirmado: `select count(*)` batia
2342 em `profiles` contra **2** em `auth.users` — 2340 linhas órfãs com dado pessoal de
verdade (`full_name`, `email`, `phone`) sem conta nenhuma por trás. Causa raiz: a limpeza de
76 tenants de teste em P−1 apagou as contas de `auth.users` correspondentes, mas sem
`on delete cascade` os `profiles` ficaram pra trás — puro debris da limpeza anterior, não
histórico de negócio (confirmado: zero linhas em `memberships`/`appointments`/`tickets`/
`quotes`/etc. referenciavam qualquer um dos 2340 ids órfãos antes de apagar). Corrigido com
migration `0032`: apaga os órfãos, adiciona `profiles_id_fkey ... on delete cascade` — trava a
causa raiz pra isso nunca mais acontecer (inclusive protege o "direito ao esquecimento" da
LGPD: deletar uma conta agora limpa o perfil junto, automaticamente).

### Confirmado limpo (com evidência)

- **Gate 0** (higiene): `git status` limpo, nenhum segredo real no histórico (os 2 falsos
  positivos de `eyJ`/hash encontrados eram checksum de pacote no `pnpm-lock.yaml`), zero
  arquivo de rascunho/backup, zero TODO/FIXME real (1 falso positivo: "TODO tenant" é a
  palavra "todo" em português, não um marcador). Um `console.log` encontrado
  (`stock-alerts/route.ts`) é log estruturado JSON, mesmo padrão usado em toda a base — não é
  resíduo de depuração.
- **Gate 1** (build/estática): `typecheck`, `lint` e `build` de produção zero erro/warning.
  `pnpm audit --prod`: nenhuma vulnerabilidade. First Load JS compartilhado: **187 kB**
  (número registrado pra comparar em builds futuros). `/dev/ui` (vitrine de componentes) já
  tem `notFound()` gated por `NODE_ENV === 'production'` — confirmado no código, não suposto.
- **Gate 2** (testes): 410 unitários + 133 de RLS + 239 de integração, todos verdes.
  **Zero** `.skip`/`describe.skipIf` em todo o repo — todo teste de integração exige
  credencial real (lança erro se faltar `.env.local`), nunca pula em silêncio. O `it.each`
  dinâmico de `isolation.test.ts` (descoberta de tabela por introspecção) já tem o guard
  `expect(tabelas.length).toBeGreaterThan(20)` contra o caso "lista vazia = teste sempre
  verde" (armadilha real documentada no checklist, StarkOS).
- **Gate 3** (config/segredos): `.env.example` cobre as 23 variáveis realmente lidas em
  `src/` (conferido campo a campo via grep). `service_role`/`SERVICE_ROLE` só aparece nos
  dois arquivos autorizados (`with-tenant.ts`, `server-client.ts`) — tem regra de lint
  (`eslint.config.*`) travando isso, não é só convenção.
- **Gate 4** (banco/RLS): **todas** as 50 tabelas de `public` têm `rls_enabled: true`, sem
  exceção (`list_tables` verbose). `appointments_no_overlap` é `EXCLUDE USING gist` de
  verdade (concorrência travada no banco, não só no app). Nenhum float em coluna de dinheiro
  (busca por `parseFloat`/`Number(...)` perto de `price`/`cents` = zero resultado; tudo
  `bigint _cents`). `get_advisors` (segurança): 4 tabelas com RLS sem policy (todas
  service-role-only por design — `cron_heartbeats`, `idempotency_keys`, `job_queue`,
  `webhook_events` — INFO, não é falha), 3 extensões no schema `public` (WARN, baixo risco,
  padrão herdado do Supabase), 4 funções `SECURITY DEFINER` chamáveis por
  `anon`/`authenticated` (`can_see_appointment`, `has_tenant`, `my_professional_id`,
  `tenant_role` — são helpers `language sql stable`, só leitura, usados dentro das próprias
  políticas de RLS — seguro por desenho, não pendência), e "leaked password protection"
  desligada (WARN — é um toggle no painel do Supabase, ação de 1 clique, registrada abaixo).

### Pendências registradas (não bloqueiam, ficam para depois)

- **Ativar "leaked password protection"** no painel do Supabase Auth — ação de 1 clique fora
  do código, não uma correção de migration.
- **Confirmar status de deploy** com o Eduardo antes de V5 (projeto Vercel existe, não está
  claro se está publicado de verdade).
- Extensões `btree_gist`/`pg_trgm`/`citext` fora do schema `public` — baixo risco, baixa
  prioridade, backlog.

**Próxima fase do loop:** V2 — Gate 5 (segurança de aplicação).

---

## Relatório V2 — Gate 5 (2026-08-20, TICKET-074)

### Achado real S1 — corrigido apenas parcialmente (registrado, não construído por inteiro)

**MFA obrigatória em 4 rotas sensíveis, mas não existe NENHUMA UI de cadastro de segundo
fator.** `exigirAal2()` (`session.ts`) trava `clients/[id]/data-export`, `clients/[id]/erase`
(exclusão LGPD) e `clients/[id]/vault` (cofre de saúde/anamnese, chamado de verdade pela tela
real `admin/clientes/[id]/saude.tsx`) atrás de `aal2` — mas `grep` confirmou **zero** tela de
enrollment (`mfa.enroll`, QR code, verificação de TOTP) em todo `src/app`. Isso significa: hoje,
**nenhuma conta consegue nunca alcançar `aal2`**, então essas três rotas são permanentemente
inacessíveis — não é uma trava de segurança funcionando, é um recurso real do produto (cofre de
saúde, que a tela `saude.tsx` já expõe) **quebrado para todo mundo**, sempre, sem mensagem que
explique o motivo pra quem tenta usar.

**Decisão:** não construí a tela de MFA nesta rodada. Cadastro de segundo fator (QR code TOTP,
tela de verificação, gestão de fatores, fluxo de desafio no login) é um recurso do tamanho de
P7/P8 — orçamento ou recorrência —, não um ajuste de auditoria; apressar isso sob pressão de
"fechar o gate" arriscaria entregar um fluxo de segurança mal pensado, o que é pior que a
lacuna atual. Registrado como **o item de maior prioridade real do backlog** (acima de tudo em
`09-PLATAFORMA.md` §19) — vale ser a próxima fase de verdade construída, não só mais uma
auditoria.

### Achado real S2 — corrigido nesta rodada

**Sem verificação de `Origin` nas rotas que escrevem (5.1.5).** O cookie de sessão do Supabase
é automático (o navegador manda sozinho pra qualquer requisição do domínio); `SameSite=Lax`
(padrão da lib) já bloqueia a maioria dos casos de CSRF, mas o checklist pede a segunda camada
explícita. Corrigido no `rota()` global (`handler.ts`) — `POST`/`PUT`/`PATCH`/`DELETE` com
header `Origin` presente e diferente de `NEXT_PUBLIC_APP_URL` levam `403 FORBIDDEN` antes de
tocar no handler; ausência de `Origin` passa (chamada servidor-a-servidor de verdade — cron com
`CRON_SECRET`, nenhuma delas manda esse header). Verificado ao vivo contra o build de produção
real (`pnpm build && pnpm start`, `curl` nos 3 casos): origem errada → 403 antes do handler
rodar; sem origem → chega em `UNAUTHENTICATED` normal; origem certa → mesma coisa. 4 testes
unitários novos.

### Confirmado limpo (com evidência)

- **5.1** (auth/autorização): `sessaoAtual()` usa `getUser()` (confere no servidor de auth), não
  `getSession()` (confiaria no JWT do cookie) — comentário no próprio código já documentava o
  motivo. IDOR: 3+ testes de integração reais provam `id de outro tenant → NOT_FOUND`, nunca o
  dado alheio (`crm.test.ts`, `servicos.test.ts`), e as 133 linhas de `isolation.test.ts` cobrem
  o mesmo na camada de RLS. Auditoria de **leitura** de dado sensível: `vault_access_log`
  grava em toda abertura de ficha de saúde, não só escrita.
- **5.2** (entrada/saída/injeção): zero `dangerouslySetInnerHTML` em todo `src/`. O único CSS
  dinâmico controlado por dado (`accentColor` na página pública) usa `style={{...}}` do React
  (não string crua em `<style>`) **e** um regex `HEX` allowlist antes de usar — mais defendido
  que o bug real do stark-base (que não tinha nenhuma das duas camadas) —, e a cor nem é
  editável por ninguém hoje (vem fixa de `vertical_packs`, catálogo só-leitura). Upload de mídia
  (`media.ts`): tamanho limitado (10MB), tipo validado por **reprocessamento real** via `sharp`
  (não por extensão/mimetype declarado), reencodado pra WebP (também derruba EXIF/GPS
  embutido), nome de arquivo sempre UUID aleatório (nunca previsível, nunca path do usuário).
  Redirects: só pra caminho interno fixo (`/entrar`, `/onboarding`), nunca de parâmetro do
  usuário — sem open redirect. `fetch()` do servidor: sempre hostname fixo (Resend, Meta Graph,
  hCaptcha, Upstash) — nunca busca URL fornecida por quem chama a rota, sem SSRF.
- **5.3** (headers/CSP): `vercel.json` não define nenhum header de segurança (só `crons: []`) —
  elimina de saída o bug real do stark-base (duas CSPs coexistindo, interseção quebra script
  inline). CSP validada **contra o build de produção real** via `curl -I` (não em dev, que não
  passa pelo middleware da mesma forma): nonce por requisição, HSTS, X-Content-Type-Options,
  X-Frame-Options, Referrer-Policy, Permissions-Policy, COOP, CORP — todos presentes. Sem
  `<video>`/`<audio>` no produto hoje, então a lacuna de `media-src` que pegou o stark-base não
  se aplica (nada usa esse tipo de mídia ainda). CORS: nenhum header `Access-Control-Allow-*`
  configurado em lugar nenhum — fecha por ausência, não por regra explícita, mas fecha.
- **5.4** (abuso/custo): rate limit **global** (120/min por IP) cobre automaticamente **toda**
  rota que passa por `rota()` — inclusive as públicas de agendar/cancelar/confirmar/orçamento —,
  sem depender de cada rota lembrar de adicionar o próprio limite (rede embaixo dos limites
  finos que login/booking já tinham). Cron: as 6 rotas em `api/cron/*` conferem `CRON_SECRET`.
  Webhooks: pasta `api/webhooks` existe mas está **vazia** — nada pra validar ainda, condizente
  com Asaas seguir bloqueado (P11); não é lacuna, é escopo ainda não aberto.

### Pendência registrada (não bloqueia, infraestrutura não é código)

- **Rate limit sem Upstash configurado cai pra memória por instância** — o próprio código já
  documenta isso (`rate-limit.ts`): funciona pra provar o comportamento, mas não seguraria um
  ataque de verdade contra um deploy serverless com várias instâncias (cada uma teria seu
  próprio contador). Ligar `UPSTASH_REDIS_REST_URL`/`TOKEN` é passo de infraestrutura antes de
  produção receber tráfego real — decisão do Eduardo, registrada aqui pra não se perder.

**Próxima fase do loop:** V3 — Gate 6 (fluxos de negócio ponta a ponta). Antes de V3, considerar
se o achado do MFA (acima) merece virar a próxima fase de CONSTRUÇÃO em vez de mais verificação
— é o achado de maior impacto real desta sessão de auditoria até agora.

---

## Relatório V3 — Gate 6 (2026-08-20, TICKET-075)

**Decisão tomada no início desta fase:** terminar o ciclo de verificação antes de pivotar pra
construir o MFA — V3 acabou provando o valor dessa ordem: achou (e corrigiu) um bug **em
produção real** que só apareceria testando a aplicação rodando, exatamente o tipo de coisa que
justifica não pular direto pra construção.

### Achado real S1 — corrigido nesta rodada, causado pela própria correção do V2

**A checagem de `Origin` do V2 quebrava o agendamento público de verdade.** Testando a jornada
principal ao vivo (não só lendo código — é a regra do Gate 6), o booking público real deu
`403 FORBIDDEN` — a correção de CSRF do V2 comparava `Origin` contra `NEXT_PUBLIC_APP_URL`
**fixo**, mas o preview local roda numa porta diferente da configurada nessa env var. O mesmo
bug quebraria **qualquer** deploy preview da Vercel (subdomínio dinâmico) ou troca de domínio
custom — ou seja, não era só um problema do ambiente de teste, era a lógica errada em si.

Corrigido: a comparação agora é contra o `Host` (ou `x-forwarded-host`) **da própria
requisição**, não uma URL fixa — é o jeito correto de checar "mesma origem" (recomendado pela
OWASP: comparar `Origin` com `Host`), e funciona automaticamente em qualquer domínio que o Next
esteja servindo de verdade, sem precisar listar cada um. 6 testes unitários (era 4, adicionei 2
pra cobrir exatamente esse cenário — domínio diferente do configurado, ausência de `Host`).

**Lição registrada:** um fix de segurança sem teste ao vivo contra a aplicação rodando pode
quebrar o produto mais do que protegê-lo. O V2 tinha 4 testes unitários passando E o `curl`
contra produção confirmando os 3 casos — mas o `curl` usou `localhost:3000`, que por acaso
batia com `NEXT_PUBLIC_APP_URL`. Nenhum teste (unitário ou manual) tinha testado um HOST
DIFERENTE do configurado — e foi exatamente esse buraco que o Gate 6 expôs.

### Jornada principal (6.1) — testada ao vivo, com evidência

Tenant descartável criado via seed, fluxo completo como cliente real (sem sessão): página
pública → `/agendar` (wizard serviço → profissional → dia → horário) → formulário (nome,
telefone, endereço opcional, honeypot) → confirmação.

- **6.1.1** ✅ primeira dobra mostra nome do negócio, "aberto agora", CTA, serviços com
  preço/duração, horário — entendível em segundos (texto da página colado no relatório).
- **6.1.2** ✅ navegação completa até a conversão, passo a passo (serviço → dia 20/08 → horário
  10:30 → dados → confirmar).
- **6.1.3** ✅ registro no banco **conferido por `select`**: `starts_at`/`ends_at` corretos
  (10:30–11:10 local = 13:30–14:10 UTC), `status: pending`, `origin: public_page`,
  `price_cents: 4500` (bate com "Corte" R$45), telefone normalizado em E.164.
- **6.1.4** ✅ tela de confirmação aparece ("Agendamento enviado!"). Confirmação por WhatsApp ao
  cliente **não** é imediata — só o aviso push pro profissional (`notificarEquipe`) dispara na
  hora; o link de confirmação por WhatsApp sai depois, via o cron de lembretes. Não é bug: o
  texto da própria tela já avisa isso ("Você vai receber a confirmação por WhatsApp"), e mandar
  duas mensagens (confirmação instantânea + lembrete) seria redundante.
- **6.1.5** ✅ o dono vê o agendamento no painel (`/admin/agenda`), no dia certo, estado
  "Aguardando" (pending), com nome/serviço/horário/preço corretos — texto da página colado.
- **6.1.6/6.1.7** ⬜ não testados nesta rodada (ciclo completo de status até concluído, e
  cancelamento sem órfão) — já cobertos por teste de integração real
  (`confirmacao-cancelamento.test.ts`, 5 casos, `agendamentos.test.ts`), não repeti ao vivo por
  tempo; ⬜ aqui significa "não verificado NESTA rodada do Gate 6", não "nunca verificado".

### 6.2 Pagamento — ➖ não se aplica

Asaas bloqueado (P11, credencial). Toda a seção fica ➖ com esta justificativa, não some do
relatório.

### 6.3 Mensageria — parcialmente verificável

Sem `WHATSAPP_ACCESS_TOKEN`/`RESEND_API_KEY` configurados em `.env.local` — confirmado por
grep, então **6.3.1/6.3.2 (número real, link `wa.me`) ficam ⬜**, não dá pra testar entrega de
verdade nesta sessão. **6.3.3 (falha de envio não derruba a operação principal)** ✅ confirmado
indiretamente: o agendamento acima foi criado com sucesso mesmo sem nenhuma credencial de
mensageria configurada — o design já documentado em `mensageria.ts`/`push.ts` (best-effort,
nunca trava o fluxo principal) se provou na prática, não só no código.

### 6.4 Painel administrativo — parcialmente verificado

**6.4.2** (criar/editar persiste) ✅ já coberto extensivamente nesta sessão inteira (P7, P8,
P10 tiveram verificação ao vivo de CRUD). **6.4.1** (cada papel vê só o que deveria, testado
logando com cada papel) ⬜ não testado nesta rodada — os testes de integração cobrem isso a
nível de API (RBAC + RLS), mas não houve login real com um papel restrito (`professional`,
`reception`) nesta sessão. Registrado como pendência de V3.

### Pendências registradas

- **6.1.6/6.1.7, 6.4.1** ficaram ⬜ nesta rodada do Gate 6 — cobertos por teste automatizado,
  não por clique ao vivo. Não é falha, é escopo que sobrou pra uma passada futura se o tempo
  permitir.
- **6.3.1/6.3.2** seguem ⬜ até haver credencial real de WhatsApp/e-mail pra testar entrega.

**Próxima fase do loop:** decisão a ser tomada na próxima iteração — continuar V4 (Gates 7-10,
interface/responsividade/performance/SEO) ou pivotar pra construir o MFA, que segue sendo o
achado de maior prioridade real do backlog.

## Relatório TICKET-076 — MFA construído (pivô de V3 para construção)

**Decisão autônoma:** entre continuar V4 (Gates 7-10) ou construir o MFA que V2 tinha
encontrado e registrado como prioridade máxima do backlog, escolhi construir agora. Motivo: o
achado do V2 não é "falta polimento" — é "3 rotas reais permanentemente inacessíveis pra
qualquer conta" (`data-export`, `erase` LGPD, `vault` de saúde). Deixar isso registrado por mais
uma rodada de verificação (que só produz MAIS achados, não fecha os que já existem) tinha custo
maior que o risco de pausar a sequência V1→V5 no meio.

**O que foi construído** (sem tabela nova — TOTP nativo do Supabase Auth):

- `src/server/auth/schemas.ts`: `EsquemaCodigoMfa`/`EsquemaVerificarMfa` (6 dígitos), slug
  `verificar` reservado.
- `POST /api/v1/auth/mfa/enroll` — `db.auth.mfa.enroll({factorType:'totp'})`, devolve
  `factorId`/`qrCode`/`secret`.
- `POST /api/v1/auth/mfa/verify` — `challengeAndVerify`; serve tanto "confirmar cadastro" quanto
  "desafio no login" (mesma chamada nos dois casos).
- `GET /api/v1/auth/mfa/factors` — lista fatores TOTP.
- `DELETE /api/v1/auth/mfa/factors/[id]` — **exige `aal2`, não só sessão** (mesmo raciocínio de
  "trocar senha pede a senha atual, mesmo logado"; só quem provou o fator nesta sessão pode
  removê-lo).
- `/api/v1/auth/login`: depois de `signInWithPassword`, checa
  `getAuthenticatorAssuranceLevel()` — se a conta tem fator TOTP `verified` e a sessão ainda é
  `aal1`, devolve `{mfaRequired, factorId}` em vez da lista de tenants.
- `/entrar`: redireciona pra `/verificar?factorId=...` quando `mfaRequired` vem na resposta.
- `/verificar` (nova rota `(auth)`): tela de desafio no login — 6 dígitos, confirma, segue pro
  destino original.
- `/admin/config/seguranca` (nova, com link em Configurações → Privacidade): tela de
  cadastro/gestão — QR code via `<img src={dataUri}>` (não `dangerouslySetInnerHTML`, pra não
  regredir o achado "zero HTML injetado" do Gate 5), secret manual como alternativa, formulário
  de confirmação; estado "ativo" com botão Desativar; erro `MFA_REQUIRED` na remoção vira
  mensagem específica ("saia e entre de novo confirmando o código") em vez de erro genérico.

**Testado, não só lido:**

- 13 testes unitários novos (`tests/unit/server/mfa.test.ts`), seguindo o padrão já
  estabelecido pela base (`vi.mock('@/server/db/server-client', ...)` com cliente falso — a
  mesma técnica de `tests/unit/server/session.test.ts` — porque `criarClienteDoUsuario()`
  depende de `next/headers`/`cookies()`, que só existe dentro de um request real do Next, não
  dá pra chamar a rota direto num teste de integração comum como as outras rotas de serviço
  fazem). Cobrem: enroll com/sem sessão e com erro do Supabase; verify com código certo/errado/
  malformado (e que o erro do Supabase nunca vaza pra fora); listagem; remoção com/sem `aal2` e
  com id inválido; os 3 ramos do `mfaRequired` no login (fator verificado → pede código; sem
  fator → segue direto; fator cadastrado mas não verificado → segue direto, não trava
  ninguém no meio de um cadastro inacabado).
- **Verificação ao vivo, ponta a ponta, contra o Supabase real** — não só os mocks acima: tenant
  descartável criado por script temporário (apagado ao final, junto com o script). Login →
  `/admin/config/seguranca` → "Ativar" → QR/secret reais devolvidos pelo Supabase → **código
  TOTP de 6 dígitos calculado de verdade a partir do secret** (RFC 6238, HMAC-SHA1, sem
  biblioteca — não tem `otplib`/`speakeasy` no projeto, então o algoritmo foi escrito num
  one-liner Node só para esta verificação) → confirmado, tela vira "ativada". Prova de que
  `exigirAal2()` realmente destravou: `fetch('/api/v1/clients/[id]/vault')` foi de
  `401 MFA_REQUIRED` (antes do cadastro) pra `404` de negócio ("cliente ainda não tem anamnese
  preenchida") depois; `data-export` foi de `401` pra `200`. Logout + login de novo: a tela
  `/verificar` apareceu (não pulou direto pro painel), código TOTP recalculado (janela de 30s já
  tinha virado) confirmado, caiu em `/admin/hoje`. "Desativar" removido com sucesso (sessão já
  era `aal2`), tela voltou pro estado "não cadastrado". Tenant e usuário descartáveis apagados ao
  final — sem resíduo no banco.
- `pnpm typecheck`/`lint`: limpos. `test:unit`: 429 (era 410 + os 13 novos, mais os do V2/V3 já
  contados). `test:rls`: 133 (sem tabela nova, nenhuma mudança aqui — esperado). `test:integration`:
  239, sem flake. `build`: sucesso, `/verificar` e as 4 rotas novas aparecem no manifesto.

Commit: `feat(auth): autenticação em duas etapas com TOTP (TICKET-076)`. §19 do
`09-PLATAFORMA.md` atualizado (a entrada 🔴 removida — não é mais lacuna, é recurso).

**Próxima fase do loop:** retomar a sequência de verificação estrutural em V4 (Gates 7-10 —
interface/acessibilidade/responsividade/performance/SEO), agora sem a maior pendência de
segurança/LGPD da sessão pendurada.

## Relatório V4 (Gates 7-10, TICKET-077)

Checklist lido inteiro antes de começar (Gates 7-10 de `VERIFICACAO-FINAL.md`), mais
`DESIGN-E-INTERFACE.md` como leitura complementar. Verificação feita contra build de produção
real (`pnpm build && pnpm start`), navegador de verdade (resize 320/375px, JS no console pra
medir overflow/alt/tap-target), não só leitura de código.

### Achados reais, corrigidos (commit `ec60f73`)

**Gate 10 (SEO) — S1, o mais sério desta rodada.** Zero `robots.txt`, zero `sitemap.xml`, zero
Open Graph/Twitter Card na página pública do tenant. O canal de distribuição real do produto é
colar o link no WhatsApp (confirmado em V3, `linkWhatsapp()`/CTA "Falar no WhatsApp") — sem OG,
esse link chegava pelado, só a URL, sem nome nem descrição do negócio. Corrigido:
`src/app/robots.ts` (bloqueia `/admin`, `/api`, rotas de auth), `src/app/sitemap.ts` (lista os
tenants ativos, mesma leitura anônima `withNovoTenant` que o booking público já usa), OG/Twitter/
canonical/JSON-LD LocalBusiness na página do tenant. **Sem imagem** (nenhum tenant tem foto/logo
cadastrada — produto não tem upload de imagem ainda), registrado como pendência, não fingido.

**Gate 10 — `/admin` nunca declarava `noindex`.** Painel de trabalho indexável é o tipo de coisa
que vaza em busca por acidente. `robots: {index:false}` na própria página + disallow no
robots.txt (duas camadas, uma não substitui a outra).

**Gate 8.4 — o defeito mais recorrente da família (já visto em 7 projetos anteriores) apareceu
de novo.** Telefone e Instagram no rodapé da página pública: alvo de toque de 23px medido ao
vivo (`getBoundingClientRect`), abaixo do mínimo de 40px da casa. Corrigido com a classe
`toque-48` — que **já existia** no design system (usada no botão `sm`), só não tinha sido
aplicada aqui. Confirmado via computed style do `::after` depois do rebuild: `min-height: 48px`.

### Verificado e confirmado limpo (sem achado)

- **7.13** `<html lang="pt-BR">` ✅. **7.2/7.3** 404 real, com CTA de volta, sem link morto
  encontrado. **7.6** duplo envio: o componente `Button` desabilita sozinho via prop
  `carregando` (`aria-busy` + `disabled`), padrão usado em todo formulário revisado nesta sessão
  — não é checklist por tela, é garantia estrutural. **7.11** foco visível: `:focus-visible`
  global em `globals.css`, token `--ring`. **7.15** `prefers-reduced-motion` respeitado
  (`globals.css`). **7.12** todo `<img>` do projeto tem `alt` (só existe um, o QR code do MFA,
  já teve alt significativo desde que foi construído).
- **8.2** zero overflow horizontal medido ao vivo em 320px e 375px na página pública
  (`scrollWidth === innerWidth` nos dois). **8.3** (armadilha de `fieldset`) não se aplica —
  grep confirma que o projeto não usa `<fieldset>` em lugar nenhum. **8.5** nenhuma ação só no
  hover encontrada (grep por `group-hover:opacity`/`hover:opacity-100`, zero resultado). **8.9**
  safe-area do iPhone tratada nos dois eixos (`env(safe-area-inset-top)` no Topbar,
  `env(safe-area-inset-bottom)` na TabBar). **8.10** não se aplica por desenho: o app não tem
  menu hambúrguer, a `TabBar` é fixa e sempre visível (decisão documentada em `tab-bar.tsx`, §3.7
  do redesign) — não existe "abrir/fechar menu" pra travar scroll.
- **9.6/9.7/9.8** (will-change fora de `hover:hover`, background-attachment fixed, blur pesado no
  mobile) não se aplicam — grep confirma zero uso de `will-change`/`blur(` no projeto inteiro;
  CICLO é ferramenta de trabalho, não landing decorada, nunca herdou esses efeitos dos forks de
  vitrine. **9.9** fonte declarada é a fonte carregada: `next/font/google` (Archivo), auto-
  hospedada, sem mentira de `@font-face` fantasma.

### Pendências registradas (não corrigidas nesta rodada)

- **10.2 sem imagem própria no OG:** depende de o produto ganhar upload de foto/logo pro
  perfil público (não existe hoje) — quando existir, adicionar `openGraph.images`/
  `twitter.images` é trivial, o código já está pronto pra receber.
- **Verificação de `/admin` com `noindex` real na resposta HTTP:** confirmado por leitura de
  código + `typecheck`/`lint`/`build` limpos, **não** confirmado por fetch autenticado ao vivo
  contra a página renderizada (exigiria outro tenant descartável só pra isso) — registrado por
  honestidade, não é o mesmo nível de prova que os outros itens desta rodada.
- **Gate 7.7 (todo componente exportado é realmente renderizado), 7.9 (gradiente em texto
  cortando descendente), 7.14 (zoom 200%), 9.1-9.2 (LCP/CLS/INP medidos, peso de JS)** não
  verificados nesta rodada por escopo/tempo — nenhum indício de problema encontrado
  incidentalmente ao navegar, mas não foram medidos de propósito. Candidatos naturais de uma
  V5 se houver.

### Verificação completa

`typecheck`/`lint` limpos. `test:unit` 429, `test:rls` 133, `test:integration` 239 — todos sem
flake. `build` ok, `/robots.txt` e `/sitemap.xml` aparecem no manifesto como rotas estáticas.

**Próxima fase do loop:** decisão de dev sênior — o ciclo de verificação estrutural
(VERIFICACAO-FINAL.md) está com V1-V4 feitos; falta só Gate 11 (observabilidade/resiliência,
não coberto por nenhuma rodada anterior) e os Gates 12-14 do arquivo (se existirem além do 11).
Ler o restante do checklist antes de decidir se vale uma V5 curta ou se o retorno já caiu o
suficiente pra valer mais construir do que auditar — a essa altura da sessão, a maioria dos
achados de Gate 7-10 já eram polimento (S2), não bloqueio (S0/S1), o que é sinal de que a
plataforma está numa base sólida.

## Relatório V5 — Gate 11 (TICKET-078)

Decisão de dev sênior: li o restante do checklist (Gates 11-14). Gates 13 (deploy) e 14
(entrega ao cliente) seguem ➖ justificados — CICLO não está publicado ainda (sem domínio, sem
`git remote`, decisão do Eduardo, já registrada em §1 deste documento). Gate 12 (legal/LGPD) tem
um achado real mas **genuinely bloqueado**: publicar Política de Privacidade/Termos de Uso com
identidade jurídica inventada (razão social, CNPJ, contato do encarregado) seria pior do que não
ter — fingir uma empresa que não existe ainda. Registrado como pendência real em vez de fingido
(ver abaixo). Gate 11 (observabilidade/resiliência) era 100% verificável sem depender de deploy
nem de decisão de negócio — fiz esse.

### Achado real, corrigido (commit `30103bc`)

**11.2 — nenhum dos três providers de mensageria (WhatsApp, e-mail, push) tinha timeout de
rede.** `enviarComFallback()` já trata qualquer erro como transitório e cai pro próximo canal —
mas sem timeout, uma conexão que **trava** (não erra, só não responde) prendia a chamada
indefinidamente. E não é hipotético: `lembretes.ts`/`lista-espera.ts`/`recuperar-receita.ts`
chamam `enviarComFallback` direto dentro de loop, processando lote de destinatários num cron —
uma trava no meio do lote empacava o resto atrás dela até o timeout da própria função serverless
matar a execução inteira, deixando destinatários seguintes sem tentativa nenhuma. Corrigido: 10s
de timeout nos três (`AbortSignal.timeout` no fetch do WhatsApp/e-mail, `{timeout}` nativo do
`web-push` no push). 4 testes novos provam que o `signal`/`timeout` chega mesmo na chamada de
rede (mock de `fetch` verificando `init.signal instanceof AbortSignal`), não só que compila.

### Confirmado limpo (com evidência já existente na sessão, sem achado novo)

- **11.1** falha de banco não derruba a página inteira: `src/app/error.tsx` (raiz) e
  `src/app/admin/error.tsx` são o *error boundary* do Next — qualquer exceção não tratada num
  Server Component vira essa tela amigável, nunca um 500 cru do framework.
- **11.3** log estruturado (JSON, `level`/`code`/`status`) confirmado em V1; nunca inclui dado de
  saúde (regra 9 do CLAUDE.md, com teste dedicado — `tests/unit/observability/redact.test.ts`).
- **11.4** telas de erro existem (item acima). **11.5** `/api/health` existe, com
  `verificarSaude()`/`registrarHeartbeat()` reais em `src/server/services/health.ts`, não só uma
  rota que devolve `200` sem checar nada.
- **11.8** idempotência: regra 6 do CLAUDE.md (`Idempotency-Key` em toda escrita `/api/v1`) já é
  estrutural, verificada em gates anteriores desta sessão.

### Pendências registradas (genuinamente bloqueadas, não fingidas)

- **12.1/12.2/12.9 — Política de Privacidade, Termos de Uso e contato do encarregado.** A
  estrutura de conteúdo (que dado é coletado, de onde, por quê, quem acessa) é 100% conhecível
  hoje a partir do schema real — mas publicar com razão social/CNPJ/e-mail de encarregado
  inventados seria pior do que não publicar: fingiria uma pessoa jurídica que não existe ainda
  (CICLO não tem cliente pagante, não tem entidade legal decidida). Fica bloqueado pela mesma
  categoria de decisão que credencial do Asaas — não é lacuna técnica, é dado que só o Eduardo
  tem. Adicionado a §4 deste documento ("o que só o Eduardo decide").
- **11.6/11.7/13.x** — plano de rollback escrito e "quem é avisado quando quebra" dependem do
  deploy real existir (Sentry já está com toda a instrumentação de código pronta —
  `instrumentation.ts`/`instrumentation-client.ts`/`global-error.tsx` — falta só `SENTRY_DSN` em
  produção e as regras de alerta, que se configuram no painel do Sentry, não em código).

### Verificação completa

`typecheck`/`lint` limpos. `test:unit` **433** (era 429, +4 desta rodada). `test:rls` 133.
`test:integration` 239, sem flake. `build` ok.

**Ciclo de verificação estrutural (VERIFICACAO-FINAL.md) fechado nesta sessão:** V1-V4 completos
e reportados; V5/Gate 11 fechado com um achado real corrigido; Gates 12-14 registrados como
bloqueados por decisão de negócio, não pulados por preguiça. A partir daqui, mais uma rodada de
auditoria tem retorno decrescente — a maioria dos achados das últimas duas rodadas já era S2, e
os que restam (Gates 12-14) não são trabalho de engenharia. Recomendação para a próxima
iteração: pivotar para construção real do backlog (§3 deste documento).

## Construção — Orçamentos, tela de gestão (TICKET-079)

Decisão de dev sênior: com o ciclo de verificação estrutural fechado (V1-V5) e retorno
decrescente confirmado, pivotei pra construção. Escolhi a tela de gestão de orçamentos (§3) em
vez da de séries de recorrência: orçamento é visibilidade de receita em risco — saber quem
aprovou/recusou/nem respondeu é o tipo de coisa que se o dono não vê, ele simplesmente não sabe
se está vendendo; recorrência é mais utilidade de bastidor. Maior valor real, não a mais fácil.

**Construído:** `listarOrcamentos()` (últimos 100 do tenant, nome da cliente, status) +
`/admin/orcamentos` (lista com badge, valor, data, copiar link) + entrada em Configurações →
Receita recorrente.

**Achado à parte, corrigido no caminho:** `/admin/orcamentos/novo` já existia desde P8
(TICKET-068) mas nunca tinha entrado no mapa de navegação de `navegacao.ts` — num PWA
`standalone` sem barra do navegador, era um beco sem saída de verdade (confirmado pelo próprio
teste-guarda que o arquivo já tinha, `'nenhuma rota de /admin fica sem saída'`, que eu só não
tinha rodado com essa rota na lista até agora). Corrigido junto com a rota nova.

**Testado:** 3 casos de integração (lista certo, materializa `expired` de verdade no banco na
hora de listar — não só na tela pública, agora tem plateia real — e isola por tenant) + 2 de
navegação. Verificado ao vivo com tenant descartável: criar orçamento pelo formulário → aparece
na lista → link público abre e mostra o valor certo → aprovar pelo link → lista reflete
"Aprovado" imediatamente. Tenant e script temporário apagados ao final, sem resíduo.

**Nota da verificação:** o clique automatizado no formulário de login (`<form action={fn}>`,
API nova do React 19) não disparou o submit nativo pelo harness do navegador — confirmado que
NÃO é bug do produto (login funcionou perfeitamente via `fetch` direto com as mesmas
credenciais, sessão setada certinha). O formulário de criar orçamento usa `onSubmit` clássico e
funcionou normalmente com clique via JS. Registrado aqui só para não confundir uma sessão futura
que veja o mesmo sintoma.

`typecheck`/`lint` limpos. `test:unit` 434, `test:rls` 133, `test:integration` 242 — sem flake.
`build` ok, `/admin/orcamentos` e `/admin/orcamentos/novo` confirmados no manifesto.

**Próxima fase do loop:** decisão de dev sênior na próxima iteração — outro item do backlog
(§3), ou nova rodada leve de verificação nas telas construídas nesta sessão (a maioria nunca
recebeu o mesmo nível de escrutínio visual do `08-REDESIGN-E-IDENTIDADE.md` — ver §2 deste
documento, "verificação de design" ainda não rodou dedicada).
