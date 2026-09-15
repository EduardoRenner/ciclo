# 64 · APP NA APP STORE — PLANO DE IMPLEMENTAÇÃO

> Pedido do Eduardo em 15/09: colocar o CICLO na App Store, sem tirar o site do ar — o app é uma
> CAMADA em cima do produto que já existe, não uma reescrita. Motivo declarado (ver
> [[ciclo-apps-mobile-lojas]]): credibilidade, não distribuição — ele já vende direto pelo site.

| Tag | Significado |
|---|---|
| `[M]` | Medido neste repositório em 2026-09-15 |
| `[P]` | Pesquisa externa, com link, em 2026-09-15 |
| `[E]` | Estimativa — vira fato quando alguém tentar |
| `[BLOQ]` | Bloqueio de ambiente, não de código |
| `[RISCO-ABERTO]` | Risco que a pesquisa NÃO encontrou forma de eliminar 100% — só de reduzir |

---

## 0 · Atualização 15/09: pesquisa de mercado — o que muda o plano

Pedido do Eduardo: pesquisar a fundo o que é preciso pra passar direto na revisão, porque ele não
quer nem correr o risco de reprovação. **Segunda rodada de pesquisa, mais ampla:** a primeira olhou
só 4.2 e 3.1.1; esta olha o levantamento estatístico de causas de rejeição de verdade, e a ordem de
prioridade do plano mudou por causa disso. Registro com honestidade, porque prometer aprovação
certa seria mentir com base no que developers reais relatam.

### 0.0 · A ordem real de risco, por peso estatístico `[P]`

Levantamento de causas de rejeição sobre ~7,77 milhões de submissões analisadas em 2026 (Apple
rejeitou perto de 25% delas) `[P]`. **A ordem muda o que este plano trata como prioridade número 1**
— não é mais 4.2, nem 3.1.1 sozinho:

| # | Categoria | Peso | O que é, pro CICLO especificamente |
|---|---|---|---|
| **1** | **2.1 — Completude/performance** | **Mais rejeições que todas as outras categorias JUNTAS** `[P]` | Crash, trava, e **conta de demonstração ausente ou que não funciona** — o item que a pesquisa anterior não tinha coberto NADA, e é o maior risco isolado do plano inteiro. Ver §0.1-novo e T-DEMO. |
| 2 | 5.1.1 — Privacidade/dado pessoal | 2º lugar `[P]` | Exclusão de conta ausente (já coberto em T-DEL, rodada anterior) |
| 3 | 4.2 — Funcionalidade mínima | 3º lugar `[P]` | Já coberto (T3/T4, casca nativa + capacidade real) |
| 4 | 3.1.1 — Compra dentro do app | 4º lugar `[P]` | Já coberto (T1.5, esconder cobrança) — **menos comum estatisticamente do que a rodada anterior sugeria, mas continua sendo o único item desta lista sem solução garantida (§0.2 abaixo)** |
| 5 | 2.3 — Metadado impreciso | 5º lugar `[P]` | Screenshot que promete o que o app não tem, ícone genérico — ver T7 revisado |

**Conclusão prática: o ticket de maior prioridade do plano inteiro não é nenhum dos dois que a
primeira rodada tinha marcado como críticos — é preparar uma conta de demonstração real e estável
pro revisor da Apple usar.** Sem ela, a Apple nem chega a avaliar o resto: um app que pede login e
não vem com credencial que funciona é recusado antes de qualquer julgamento sobre 4.2 ou 3.1.1.

### 0.1 · O maior risco isolado, e que a primeira rodada não tinha coberto: conta de demonstração (2.1)

**O que a regra exige, literalmente:** se o app tem função atrás de login, a submissão precisa vir
com usuário e senha de uma conta REAL que funciona, com dado de verdade — ou um "modo demo" dentro
do próprio app, pré-aprovado pela Apple como substituto `[P]`. O revisor não cria conta nova
sozinho contando com um fluxo de cadastro completo; ele espera entrar e ver o produto funcionando.

**Por que isto é crítico pro CICLO especificamente:** o produto **não faz sentido vazio.** Um tenant
recém-criado sem agenda, sem cliente, sem histórico é uma tela de "Primeiros passos" — o revisor não
vê o Motor de Ciclo prevendo retorno, não vê a Central de Ações, não vê nada do que diferencia o
produto. Testar o CICLO com uma conta vazia é como testar o Spotify sem nenhuma música — tecnicamente
"funciona", mas não mostra nada, e aumenta a chance de a Apple concluir "app incompleto" por conta
própria.

**A boa notícia: o produto já tem exatamente a peça que resolve isto.** `scripts/seed-tenant-teste.mjs`
já existe e já semeia um tenant de demonstração com histórico fabricado — feito originalmente pra
uso local/demo, não pra revisor da Apple, mas é o mesmo problema. E o próprio produto já opera um
tenant de demonstração em produção, `dom-rocha`, com plano Avançado vitalício de cortesia
justamente para servir de vitrine — **reaproveitável direto, sem trabalho novo de seed**, só
precisa de uma senha estável e documentada pro revisor usar (nunca a senha real de ninguém).

Vira o ticket **T-DEMO**, novo e de prioridade 1 (antes de T1.5 na ordem de importância, embora
possa ser feito em paralelo — não depende de Capacitor nem do Mac).

### 0.2 · O risco que continua sem solução garantida: guideline 3.1.1 (compra dentro do app) `[RISCO-ABERTO]`

**O que a regra diz:** qualquer conteúdo ou serviço digital pago acessado dentro do app tem que
passar pela compra dentro do app (In-App Purchase), com os 30% da Apple — a menos que o app se
encaixe numa exceção `[P]`.

**Por que isto importa pro CICLO especificamente:** `/admin/config/meu-plano` tem um botão
"Assinar {plano}" que cobra pelo Mercado Pago (`src/app/admin/config/meu-plano/assinar-plano.tsx`).
Se essa tela existir dentro do app iOS do jeito que existe no site hoje, é rejeição automática e
óbvia — é literalmente vender assinatura sem IAP dentro do app.

**A mitigação que a pesquisa encontrou — e o limite dela:** o padrão usado por apps B2B "SaaS
companion" (login com conta que já existe, sem nenhuma tela de comprar/assinar dentro do app,
citando a exceção 3.1.3(b) "Multiplatform Services" nas notas pro revisor) é o caminho certo — e é
exatamente o que **Fresha for Business** e **Booksy Biz** fazem hoje, os dois publicados e
aprovados, os dois concorrentes diretos do CICLO no mesmo nicho `[P]`. Isso prova que o padrão
FUNCIONA na prática.

**Mas não é garantia.** Um developer com o MESMO padrão exato (app B2B companion, login-only, zero
tela de compra, citando a mesma exceção 3.1.3(b), citando apps aprovados como precedente) relatou
rejeição sob 3.1.1 num fórum oficial da Apple em 2026, com a resposta do revisor sendo genérica
("seu app acessa conteúdo comprado fora do app") e **sem resposta de ninguém, inclusive da própria
Apple, sobre como resolver** `[P]`. Ou seja: existe caso documentado de reprovação mesmo seguindo à
risca a receita que funciona pra outros. A decisão de revisor humano nesta regra específica não é
100% previsível — nenhuma pesquisa de mercado consegue eliminar isso, só reduzir a chance.

**O que isto muda no plano:** vira ticket próprio (T1.5, novo, abaixo) e crítico — mais importante
que a diretriz 4.2 que o plano original tratava como risco principal. **Nenhuma tela de preço,
plano ou "Assinar" pode ser alcançável de dentro do app iOS**, nem por link, nem por redirecionamento
— tem que estar tecnicamente impossível de chegar lá pelo app, não só escondida visualmente.

### 0.3 · Achado que veio de graça, e é bug de verdade, App Store ou não: falta exclusão de conta

Guideline 5.1.1(v): todo app que permite criar conta tem que permitir **excluir a própria conta, de
dentro do app**, sem precisar ligar ou mandar e-mail (exceto setor super-regulado) `[P]`. Prazo
desde 2022, não é novidade de 2026.

**Medido `[M]`:** `grep -rn "excluir.{0,20}conta" src` não encontra rota nenhuma — só uma menção em
`/termos`. O CICLO tem `erase` para excluir um CLIENTE (LGPD, `clients/[id]/erase`), mas **não tem
como o PRÓPRIO dono/profissional excluir a própria conta** de lugar nenhum, nem no site.

**Isto não é só bloqueio de App Store — é lacuna de LGPD também** (art. 18 VI, direito de
eliminação, que o produto já implementa pra cliente do salão mas não pra si mesmo). Vira ticket
novo (T-DEL abaixo), e vale a pena fazer independente do app, porque é direito do titular dos dados
seja qual for a plataforma.

### 0.4 · Guideline 4.2, revisado com mais precisão

A pesquisa original (mensagem anterior desta conversa) estava direcionalmente certa mas **um detalhe
técnico estava errado**: o plano original (T1) mandava o app carregar a URL de produção
(`server.url` remoto). **Isto é apontado por múltiplas fontes como bandeira vermelha para o
revisor** `[P]` — "carregar uma URL HTTPS remota na abertura é o padrão mais associado a rejeição".
O certo é o app **empacotar o shell da interface localmente** (os componentes de navegação, o
`chrome` do app) e só fazer chamada de API pra buscar dado — T1 corrigido abaixo.

Confirmado por três fontes independentes `[P]`, o que conta como "nativo o suficiente" pra 4.2:
**pelo menos duas capacidades nativas genuínas**, de uma lista que inclui push notification ligado
a evento real (não só permissão vazia), modo offline de verdade (não tela em branco), autenticação
biométrica, widget de tela inicial, ou integração de câmera/localização. O CICLO já tem base para
push (T3) e offline (fila existente) — falta só UM item nativo a mais pra ficar confortavelmente
acima do mínimo, não em cima da linha.

**Não é automático:** nem push, nem biometria, nem splash screen sozinhos garantem aprovação — o
critério do revisor é "esta experiência é claramente diferente de abrir o Safari?", não uma lista
de checkbox `[P]`.

### 0.5 · Um risco que a pesquisa descartou — bom saber que NÃO precisa fazer

**App Tracking Transparency (ATT, guideline 5.1.2)** só é exigido quando o app usa IDFA ou um SDK
de publicidade/analytics para rastrear entre apps `[P]`. Conferido `[M]`: `grep` por
Google Analytics, Meta Pixel, Amplitude, Mixpanel, Segment em `src/` **não encontra nada** — o
CICLO nunca teve SDK de rastreamento (Sentry, quando ligado, é diagnóstico de erro, não
publicidade/atribuição, e nem isso está ativo hoje). **Não precisa de prompt de ATT, não precisa
declarar IDFA.** Um risco a menos, sem nenhum ticket novo.

### 0.6 · Sources

- [App Store Review Guidelines: Will Your Webview App Be Rejected? — MobiLoud](https://www.mobiloud.com/blog/app-store-review-guidelines-webview-wrapper)
- [Wrapping a Vibe-Coded Web App for iOS: What Apple Actually Requires — AcceptMyApp](https://acceptmy.app/guides/web-app-to-ios-app-store-requirements)
- [Can You Publish a PWA to the App Store and Google Play? — MobiLoud](https://www.mobiloud.com/blog/publishing-pwa-app-store/)
- [Rejected under Guideline 3.1.1 – B2B SaaS app, existing accounts only, no purchases in the app — Apple Developer Forums](https://developer.apple.com/forums/thread/811018)
- [Guideline 4.8 Design Login Services — Appraysal](https://appraysal.com/rules/4.8_sign_in_with_apple)
- [Account deletion within apps — Apple Developer](https://developer.apple.com/news/upcoming-requirements/?id=06302022b)
- [Fresha for Business — App Store](https://apps.apple.com/us/app/fresha-for-business/id1455346253)
- [Booksy Biz: Booking & Payments App — App Store](https://apps.apple.com/us/app/booksy-biz-booking-payments/id725335996)
- [App Store Rejection Reasons in 2026: The 15 Most Common — App Lander](https://www.applander.io/blog/app-store-rejection-reasons-2026)
- [Most Common App Store Rejection Reasons and Fixes (2026) — Superapp](https://www.superappp.com/blog/most-common-app-store-rejection-reasons)
- [App Store Guideline 2.1: App Completeness — AcceptMyApp](https://acceptmy.app/guidelines/2-1-app-completeness)
- [16 Reasons Apple Could Reject Your App — MobiLoud](https://www.mobiloud.com/blog/avoid-app-rejected-apple/)
- [App Store Guideline 2.1 Performance rejection, demo account guidance — PTKD Journal](https://ptkd.com/journal/app-store-rejection-guideline-2-1-performance)
- [Guideline 2.3: Accurate Metadata — iOS Submission Guide](https://iossubmissionguide.com/guideline-2-3-accurate-metadata/)
- [Why App Store Screenshots Get Rejected and How to Fix Them — ScreenshotBro](https://screenshotbro.app/blog/app-store-screenshots-rejected-fix)
- [App Tracking Transparency — Usercentrics](https://usercentrics.com/knowledge-hub/apples-app-tracking-transparency-att/)

---

## 1 · A aposta

**Capacitor embrulha o Next.js que já existe.** Zero reescrita de tela, zero segunda base de
código para manter em paralelo. O que muda é uma casca nativa em volta do mesmo site — o mesmo
`/admin/hoje`, a mesma agenda, o mesmo Motor de Ciclo.

**O site continua no ar exatamente como está, o tempo todo.** Vercel não muda, `seuciclo.com.br`
(ou o domínio que for) não muda, ninguém que já usa pelo navegador percebe nada. O app é aditivo:
uma nova forma de abrir o MESMO produto, não uma versão paralela que pode divergir.

## 1.1 · O que já existe e ajuda (medido `[M]`)

Isto reduz o risco da diretriz 4.2 da Apple (rejeita app que é "só WebView sem nada nativo") — o
CICLO já não é um WebView pelado:

- `public/manifest.json` — PWA instalável, ícones em 4 tamanhos (192/512, normal/maskable), tema
  escuro coerente.
- `public/sw.js` — service worker próprio, com deny-list documentada no `CLAUDE.md` (nunca
  cacheia `/vault` nem mídia assinada).
- Fila offline (`src/lib/offline`) — mutação enfileira quando a rede cai e reenvia depois; é
  exatamente o tipo de comportamento "sente como app" que passa em revisão.
- Push notification já existe do lado web (`VAPID_*`) — a base conceitual está pronta, mas **push
  nativo no iOS não usa VAPID**, usa APNs (Apple Push Notification service) através do
  `@capacitor/push-notifications`. É trabalho novo, não reaproveitamento direto — ver T3.

## 1.2 · O bloqueio que não é código `[BLOQ]`

**Build e assinatura de app iOS exigem Xcode, que só roda em macOS.** Esta sessão roda em Windows.
Eu escrevo e testo toda a parte web/config deste plano até onde o Windows permite; a partir do
primeiro `npx cap open ios`, alguém precisa de uma máquina Mac — a do Eduardo, de terceiro, ou um
serviço de CI que builda iOS na nuvem (Codemagic, Xcode Cloud, Ionic Appflow). **Decidir qual dessas
três é o primeiro item acionável do Eduardo (T0), porque trava tudo depois de T1–T2.**

---

## 2 · Os tickets

Convenção da casa: objetivo, critério de aceite, onde mexer, armadilhas. Um ticket, um commit.

### T-DEMO · Conta de demonstração pro revisor da Apple — PRIORIDADE 1, o maior risco do plano

**Objetivo.** Uma conta que o revisor da Apple loga e vê o CICLO funcionando de verdade — agenda
com atendimento, clientes com histórico, Motor de Ciclo prevendo retorno — não um tenant vazio de
"Primeiros passos". Não depende de Capacitor, do Mac (T0) nem de nada do resto do plano: **pode
começar agora, em paralelo com tudo.**

**Critério de aceite.**
1. Decidir entre duas opções, e registrar a escolha em `docs/DECISOES.md`:
   - **(a) Reaproveitar `dom-rocha`**, o tenant de demonstração que já roda em produção com plano
     Avançado vitalício de cortesia — zero trabalho de seed, só criar (ou confirmar que já existe)
     uma credencial de login estável para ele, nunca a senha real de quem administra.
   - **(b) Rodar `scripts/seed-tenant-teste.mjs`** contra produção pra criar um tenant novo,
     exclusivo pra revisão da Apple, sem misturar com o tenant de vitrine do marketing.
2. Credencial documentada em `App Store Connect` → "App Review Information": e-mail, senha,
   **instruções curtas e numeradas** de onde olhar (ex.: "1. Toque em Agenda. 2. Veja o Motor de
   Ciclo em Clientes → filtro 'Sumindo'.") — a pesquisa (§0.1) confirma que passos determinísticos
   e curtos ajudam a revisão a não interpretar mal uma tela.
3. Login testado do zero, no mínimo pela web (o app em si só existe depois de T1) — confirmar que
   a senha documentada realmente entra, sem MFA que trave um revisor sem acesso ao celular do
   Eduardo.
4. Conta **não expira** — nunca usar um convite ou token com prazo; a Apple pode reabrir revisão
   numa atualização futura meses depois, com a MESMA credencial.
5. Se houver papel diferente (`owner` vs `professional`), documentar qual foi dado e por quê — o
   caminho mais completo (Motor de Ciclo, caixa, Central de Ações) só existe pra `owner`/`report:read`.

**Onde mexer.** Fora do repositório, majoritariamente (conta em produção + App Store Connect);
`docs/DECISOES.md` registra a escolha.

**Armadilhas.**
- Não usar dado de cliente real/produção não-anonimizado — LGPD vale pro revisor também. Se for a
  opção (a), `dom-rocha` já é de demonstração por desenho, sem esse risco; se for (b), confirmar
  que o seed usa nome/telefone fictício, como o próprio script já documenta.
- Testar a credencial de novo pouco antes de CADA submissão (T7) — uma senha trocada por engano
  entre a preparação e o envio é o jeito mais bobo de tomar um 2.1 por "não consegui logar".

---

### T0 · Decisão do Eduardo — onde faz o build iOS `[BLOQ]`

**Não é ticket de código.** Três caminhos, escolher um antes de T5:

| Caminho | Custo | Prós | Contras |
|---|---|---|---|
| Mac próprio/emprestado | R$ 0 extra | Controle total, sem depender de terceiro | Precisa ter acesso a um |
| Codemagic (free tier) | Grátis até um limite de minutos/mês | Não precisa de Mac, integra com GitHub | Configuração inicial, limite de build |
| Xcode Cloud (Apple) | Incluso no Developer Program | Integração nativa com App Store Connect | Só funciona se o projeto já estiver num repo que a Apple acessa |

**Recomendação:** Codemagic — mais simples de ligar a este repositório GitHub sem precisar
comprar/pedir emprestado um Mac.

---

### T1 · Scaffold do Capacitor sobre o Next.js

**Objetivo.** `npx cap init` configurado, apontando para o build estático/SSR do Next existente,
sem quebrar o deploy web atual.

**Critério de aceite.**
1. `@capacitor/core`, `@capacitor/cli`, `@capacitor/ios` instalados como dependência do projeto,
   sem afetar o bundle que a Vercel serve (Capacitor só entra no build nativo, nunca no `next
   build` da Vercel).
2. `capacitor.config.ts` na raiz, com `server.url` apontando para o domínio de produção. **Revisado
   em 15/09 (§0.3):** a pesquisa aponta "app que só abre uma URL remota" como bandeira vermelha —
   mas para um Next.js com Server Components/Server Actions e sessão via cookie, empacotar tudo
   localmente (sem servidor) não é viável sem reescrever a autenticação. O que a pesquisa mostra
   que REALMENTE decide 4.2 não é de onde vem o HTML, é se existe casca nativa (barra de status,
   navegação, sem chrome de navegador visível) **e** capacidade nativa real por cima — que é
   exatamente o que T3/T4 constroem. `server.url` remoto fica, mas T4 deixa de ser opcional.
3. `pnpm build`/`pnpm verify` da Vercel continuam passando sem tocar em nada do Capacitor —
   pacotes nativos ficam num diretório próprio (`ios/`), fora do caminho que o `next build` varre.
4. Guarda: nenhum arquivo de `ios/` é lido por `tsc`/`eslint` do projeto Next (adicionar ao
   `.eslintignore`/`tsconfig` `exclude` se necessário).
5. **Nenhuma barra de endereço, nenhum link "Abrir no Safari" visível** — configurar
   `WKWebView`/Capacitor para nunca mostrar chrome de navegador. É o item mais citado como causa de
   rejeição por parecer literalmente o Safari (§0.3).

**Onde mexer.** Raiz do projeto (`capacitor.config.ts`, `package.json`), `ios/` (gerado pelo CLI,
não escrito à mão).

**Armadilhas.**
- `server.url` para produção real, nunca para `localhost` — child da mesma armadilha que
  `criar-tenant-real.mjs` já documentou para scripts de banco: ambiente errado, gravado sem avisar.
- Next.js com Server Components/Server Actions dentro de uma WebView exige atenção a cookies/CORS
  — testar login de verdade antes de considerar T1 pronto (precisa do Mac de T0).

---

### T1.5 · Bloquear TODA tela de cobrança dentro do app iOS `[RISCO-ABERTO]` — o ticket mais importante do plano

**Objetivo.** Fechar o risco #1 achado na pesquisa (§0.1): nenhuma tela de preço, plano ou
"Assinar" pode ser alcançável de dentro do app nativo — a Apple rejeita isso sob a guideline 3.1.1
com quase certeza (é o padrão de rejeição mais citado pra este tipo de app), e mesmo fazendo tudo
certo o risco não some 100% (caso documentado em §0.1).

**Critério de aceite.**
1. Detectar `Capacitor.isNativePlatform()` num ponto central (middleware ou layout raiz de
   `/admin/config`), e quando verdadeiro: `/admin/config/meu-plano` e qualquer rota de
   `/api/v1/billing/*` respondem com uma tela/mensagem "Gerencie seu plano em seuciclo.com.br",
   **sem formulário, sem preço, sem botão de ação nenhum** — nunca um link clicável pra abrir a
   URL de cobrança (mesmo um link pode ser lido como "direciona pra compra fora do app", que é OUTRA
   regra, a 3.1.3, então o texto fica sem link nenhum, só instrução).
2. O mesmo vale pra qualquer lugar que hoje mencione upgrade de plano dentro do fluxo normal — a
   Central de Ações (`chave: 'plano-perto-do-teto'`, `src/server/services/crm.ts`) e a tela de
   bloqueio de módulo (`src/components/ui/bloqueio-plano.tsx`) também precisam saber que estão
   rodando nativo e trocar "Ver planos" por texto sem ação, pelo mesmo motivo.
3. Guarda: um teste que varre o app por qualquer combinação de "Assinar"/"assinatura"/preço com um
   `<a>`/`<button>` ativo quando `Capacitor.isNativePlatform()` é verdadeiro — visto reprovando com
   o botão de volta, no molde do `CLAUDE.md`.
4. Notas pro revisor da Apple (App Store Connect, campo de "Notas para o revisor"), preenchidas na
   submissão (T7): citar explicitamente a exceção 3.1.3(b) "Multiplatform Services", nomear que é
   companion app B2B de conta já existente, e citar Fresha for Business/Booksy Biz como precedente
   aprovado no mesmo nicho — a pesquisa (§0.1) mostra que isso ajuda, mesmo não garantindo.

**Onde mexer.** Um novo helper (`src/lib/capacitor.ts` ou similar, isomorphic-safe) que detecta a
plataforma; `meu-plano/page.tsx`, `crm.ts`, `bloqueio-plano.tsx`.

**Armadilhas.**
- Esconder só no CLIENTE (React) sem bloquear no servidor não basta — quem sabe montar a requisição
  direto (DevTools do WebView, replay) ainda vê a rota. O bloqueio tem que estar em pelo menos uma
  camada de servidor também: a rota de billing pode recusar quando o `User-Agent`/header do
  Capacitor indicar app nativo, mas isso é heurística fraca — o mais seguro é o app nativo nunca
  navegar pra essas rotas, e a decisão de negócio real (quem pode assinar) continua sendo por
  usuário/sessão, não por plataforma.
- **Isto não é opcional nem "fazer depois".** É o ticket que decide se o app passa ou não — deve
  ser o PRIMEIRO testado em T6, antes de qualquer outro item da lista.

---

### T-DEL · Exclusão de conta pelo próprio dono/profissional

**Objetivo.** Fechar a lacuna achada em §0.2 — hoje ninguém consegue excluir a própria conta, nem
no site. É pré-requisito de App Store (guideline 5.1.1(v)) **e** lacuna de LGPD (art. 18 VI)
independente do app.

**Critério de aceite.**
1. Rota nova (`/api/v1/account`, `DELETE`) que o usuário logado chama sobre a PRÓPRIA conta — nunca
   aceita id de outro usuário no corpo (mesma regra de sempre: contexto validado, não corpo da
   requisição).
2. Confirma quem é `owner` de algum tenant: exigir transferência de titularidade ou exclusão do
   tenant inteiro primeiro (não é opcional — apagar o dono sem decidir o destino do tenant deixa
   `memberships`/dados órfãos). Quem é só `professional`/`reception` de um tenant alheio só perde o
   próprio acesso de login, sem tocar no tenant.
3. Some com sessão (`auth.users`), mas **preserva o que a regra 11 do `CLAUDE.md` já protege**
   (agendamento, movimento de estoque, auditoria) — mesma disciplina que `clients/[id]/erase` já
   segue pro lado do cliente do salão; este ticket é o espelho pro lado de quem opera o CICLO.
4. Entrada visível em `/admin/config` (ou nova seção de conta), com confirmação de duas etapas
   (não é ação de um toque só) — texto claro do que é apagado e do que fica retido por obrigação
   legal (nota fiscal, se existir).
5. Guarda: teste de integração que cria conta, chama a exclusão, confirma que login deixa de
   funcionar e que dados de outros tenants não foram tocados.

**Onde mexer.** `src/app/api/v1/account/`, `src/server/services/` (novo `contas.ts` ou estender
existente), UI em `src/app/admin/config/`.

**Armadilhas.** Igual à `erase` de cliente: decidir com cuidado o que é "excluído" vs. "anonimizado
por obrigação legal" — LGPD permite reter o mínimo que a lei exigir (fiscal, por exemplo), nunca o
resto.

---

### T2 · Ícone, splash screen e identidade nativa

**Objetivo.** O app abre com a marca do CICLO, não com o ícone genérico do Capacitor.

**Critério de aceite.**
1. Ícone gerado nos tamanhos que a Apple exige (1024×1024 fonte, o resto derivado por
   `@capacitor/assets` ou similar) a partir do mesmo ícone que já existe em `public/icons/`.
2. Splash screen com o `background_color`/`theme_color` do `manifest.json` (`#0d0c0c`) — consistência
   com o que a PWA já usa, não uma escolha nova.
3. Nome do app no `Info.plist`: "CICLO" (mesmo `short_name` do manifest).

**Onde mexer.** `ios/App/App/Assets.xcassets/`, `ios/App/App/Info.plist` (gerados, editados depois
do `cap sync`).

**Armadilhas.** Ícone com transparência é rejeitado pela Apple — o `public/icons/icon-512.png`
precisa ser conferido antes.

---

### T3 · Push notification nativo (APNs)

**Objetivo.** Quem instalar o app recebe notificação de verdade — lembrete de horário, alerta de
cliente sumindo — sem depender do navegador estar aberto.

**Critério de aceite.**
1. `@capacitor/push-notifications` integrado; token do dispositivo salvo do mesmo jeito que o
   `VAPID_*` já salva subscription web hoje — **mesma tabela, uma coluna a mais** para o tipo de
   token (`web` vs `apns`), não uma tabela nova (a mesma disciplina de "coluna sem escritor" que já
   guiou o resto do produto: se cria coluna, tem que nascer com escritor E leitor).
2. Certificado APNs gerado no Apple Developer Portal (requer T0/conta ativa) e configurado no
   provedor de push do servidor (`server/providers/messaging/`, que já tem `whatsapp.ts`/
   `email.ts`/`push.ts` — este ticket estende `push.ts`, não cria arquivo novo).
3. Guarda: mesmo padrão de teto diário e pausa que `reminders`/`campaigns` já respeitam — push
   nativo não é um canal novo sem as travas que os outros dois já têm.

**Onde mexer.** `src/server/providers/messaging/push.ts`, migration nova (coluna de tipo de token),
`ios/` (capabilities do Xcode: Push Notifications habilitado).

**Armadilhas.** Certificado APNs expira anualmente — documentar a data de expiração em algum lugar
visível (`docs/DECISOES.md` serve), senão o push para de funcionar em silêncio um ano depois, sem
ninguém entender por quê.

---

### T4 · Ajustes para a diretriz 4.2 (não ser "só WebView")

**Objetivo.** Reduzir o risco de rejeição na primeira submissão. **Revisado 15/09 (§0.0):** não é
mais o item de maior risco do plano — T-DEMO e T1.5 pesam mais na estatística real — mas continua
sendo o que só se confirma testando de verdade contra a revisão da Apple, então o prazo dele
continua incerto.

**Critério de aceite.**
1. Pelo menos DOIS comportamentos nativos genuínos além do push (T3): candidatos, em ordem de
   esforço — haptic feedback (`@capacitor/haptics`, esforço baixo) em ações de confirmar/cancelar
   agendamento; compartilhamento nativo (`@capacitor/share`) no lugar do link `wa.me` cru, quando
   dentro do app; status bar/safe area nativos (`@capacitor/status-bar`) para não ter WebView com
   barra branca por cima do notch.
2. Ícone de rede/estado offline reconhecível dentro do app — a fila offline que já existe
   (`src/lib/offline`) ganha um indicador visual dentro do app nativo (a versão web pode já ter
   isso; conferir antes de reconstruir).
3. **Não fazer nada disto até T1 estar rodando de verdade num dispositivo** (precisa do Mac de T0)
   — decidir o escopo de "nativo o suficiente" sem ver o app rodando é o mesmo erro que o `docs/51`
   §0 já nomeou para outros planos ("planejar sobre premissa não testada").

**Onde mexer.** Componentes React existentes que dependem do host (detectar `Capacitor.isNativePlatform()`
e ramificar comportamento), nunca duplicar tela.

**Armadilhas.** Adicionar "nativo" demais quebra a promessa original do plano (reaproveitar 100% do
código) — o critério de aceite pede o MÍNIMO que reduz risco de rejeição, não uma reescrita.

---

### T5 · Apple Developer Program + certificados

**Objetivo.** Conta ativa, certificados de assinatura, provisioning profile — os itens que só o
Eduardo pode comprar/assinar (é uma conta de pessoa jurídica ou física dele).

**Critério de aceite.**
1. Conta Apple Developer Program ativa (US$ 99/ano `[M]`, confirmado em 2026-08-31).
2. App ID registrado no portal, com capability de Push Notifications habilitada (pré-requisito de
   T3).
3. Certificado de distribuição + provisioning profile gerados — se usar Xcode Cloud (T0), isso é
   automatizado; se usar Mac próprio/Codemagic, é manual pelo App Store Connect.

**Onde mexer.** Fora do repositório — é conta/portal da Apple. **Só o Eduardo pode fazer este
ticket**, nenhuma sessão de IA tem como comprar a assinatura em nome dele.

---

### T6 · Build, TestFlight e teste em dispositivo real

**Objetivo.** Antes de submeter para revisão pública, alguém usa o app de verdade num iPhone.

**Critério de aceite, na ordem em que testar (§0.0: 2.1 pesa mais que tudo, testa primeiro).**
1. **Login com a credencial de T-DEMO, do zero, no aparelho.** Se travar aqui, nada mais importa —
   é a causa nº1 de rejeição estatística (§0.0), e é a mais fácil de checar antes de gastar tempo
   no resto.
2. **Cold start sem crash, em pelo menos 3 aparelhos/tamanhos de tela diferentes** (a pesquisa
   destaca que o revisor testa em hardware real, não só simulador) — se possível, um iPhone mais
   antigo/mais lento além do topo de linha.
3. **Tentar chegar em qualquer tela de cobrança pelo app (T1.5).** Se algum caminho ainda leva lá,
   T7 não começa.
4. Navegação completa sem tela em branco, sem link morto, sem gesto que trava (voltar, deslizar).
5. Login, agenda, Motor de Ciclo, push (T3) testados manualmente num aparelho real, não só
   simulador — simulador não testa push nativo de verdade.
6. Modo avião ligado no meio do uso — confirma que a fila offline (`src/lib/offline`) segura o
   golpe dentro do app nativo do mesmo jeito que já segura na PWA.
7. Build via TestFlight (beta interno da própria Apple, sem revisão completa — é rápido, geralmente
   liberado em minutos a poucas horas) ANTES de qualquer submissão pra revisão pública.
8. Uma lista de bugs encontrados vira ticket normal antes de avançar para T7.

**Onde mexer.** Nenhuma mudança de código previsível aqui — é ciclo de teste manual e conserto do
que aparecer.

**Armadilhas.** Pular TestFlight e submeter direto pra revisão pública é o jeito mais caro de achar
bug — cada rejeição da revisão completa custa dias, o TestFlight custa minutos. E crash/trava é a
categoria que mais reprova no geral (§0.0) — vale mais tempo de teste manual aqui do que em
qualquer outro ticket do plano.

---

### T7 · Submissão e revisão da App Store

**Objetivo.** O app aprovado e publicado.

**Critério de aceite.**
1. Screenshots tirados do app REAL rodando (T6), nunca mockup com tela/feature que não existe —
   **causa nº1 de rejeição por metadado (2.3)** é mostrar algo que o app não faz `[P]`. Cada
   tamanho de tela exigido pela Apple, mostrando o app em uso de verdade (agenda com dado, não
   splash screen sozinho).
2. Descrição da loja não promete nada que a versão submetida ainda não faz — nada de "em breve" pra
   funcionalidade central, nada de recurso do site que o app ainda não tem.
3. Categoria (Business ou Productivity), política de privacidade **linkada para `/privacidade`, que
   já existe** (`docs/31` confirma que a página já foi criada por decisão de lançamento anterior —
   reaproveitar, não recriar).
4. **App Privacy questionnaire** (App Store Connect) preenchido com precisão — o CICLO lida com
   dado de saúde (anamnese/cofre), e a Apple pede declaração explícita de categorias sensíveis.
   Declarar a menos é motivo de rejeição/remoção posterior; declarar certo é conferir contra o que
   `src/server/crypto/vault.ts` de fato coleta, não supor. **Nenhuma seção de rastreamento/IDFA a
   marcar** — confirmado em §0.5 que o produto não usa isso.
5. `PrivacyInfo.xcprivacy` (manifest de privacidade, exigido desde 2024 `[P]`) presente no bundle
   — gerado pelos plugins do Capacitor usados (push, etc.), conferir se algum falta o próprio.
6. **Credencial de T-DEMO preenchida em "App Review Information"**, testada de novo nas últimas 24h
   antes de enviar (§ armadilha de T-DEMO).
7. **Notas pro revisor preenchidas** com o argumento de T1.5 (exceção 3.1.3(b) + precedente
   Fresha/Booksy) — não é garantia, mas a pesquisa mostra que ajuda.
8. Submissão enviada via App Store Connect.
9. Se rejeitado: ler o motivo exato, corrigir, ressubmeter — **não é permitido "tentar de novo sem
   mudar nada"**, a Apple registra o padrão de tentativa e piora a relação com contas que fazem isso.

**Onde mexer.** App Store Connect (fora do repositório).

**Armadilhas.** A segunda rodada de pesquisa (§0.0) corrigiu a ordem de risco: a causa mais provável
de rejeição, ESTATISTICAMENTE, não é 3.1.1 nem 4.2 — é 2.1 (crash/conta de demo que não funciona),
por larga margem sobre todas as outras categorias somadas. T-DEMO e o passo 1 de T6 são o que mais
protege contra isso. 3.1.1 (T1.5) continua sendo o único item da lista sem garantia mesmo fazendo
tudo certo (§0.2) — os dois merecem o mesmo nível de cuidado, por razões diferentes.

---

## 3 · Ordem e paralelismo

```
T-DEMO (prioridade 1 — começa JÁ, não depende de nada)
T-DEL  (pode começar já, não depende de nada)

T0 (Eduardo, decide onde builda)
  └─▶ T1 (scaffold) ─▶ T1.5 (bloquear cobrança) ─▶ T2 (ícone/splash) ─▶ T6 (device — Mac de T0)
         │                                                                    ▲
         └─▶ T3 (push nativo) ─────────────────────────────────────────────┘
         └─▶ T4 (ajustes 4.2) ─────────────────────────────────────────────┘

T5 (Eduardo, conta+certificados — em paralelo com T1-T4)
                                                   │
                                                   ▼
                                                  T7 (submissão)
```

**T-DEMO e T-DEL não dependem de NADA — podem ser feitos nesta sessão, antes de qualquer decisão do
Eduardo.** T0 e T5 são do Eduardo e podem começar em paralelo. T1, T1.5, T2, T3 e T4 são código e
podem ser escritos nesta sessão, mas **T6 em diante depende fisicamente do Mac** que T0 escolhe.
**Ordem de prioridade real, revisada em §0.0: T-DEMO > T1.5 ≈ T-DEL > T4 > T2/T3.**

## 4 · Custos `[M]`

| Item | Custo | Recorrência |
|---|---|---|
| Apple Developer Program | US$ 99 (~R$ 550-600) | Anual |
| Codemagic (se for essa a escolha de T0) | Grátis até um teto de minutos/mês | — |
| Certificado APNs | Incluso no Developer Program | Anual (expira junto) |

## 5 · Prazo, honesto sobre a variável que eu não controlo

| Fase | Tempo `[E]` |
|---|---|
| **T-DEMO (conta de demonstração)** | **Meio dia a 1 dia — prioridade 1, revisado em §0.0** |
| T-DEL (exclusão de conta) | 1-2 dias, pode rodar em paralelo com tudo |
| T1 + T2 (scaffold, ícone) | 1 dia de trabalho de código |
| T1.5 (bloquear cobrança no app) | 1-2 dias — o único risco sem garantia (§0.2) |
| T3 (push nativo) | 1-2 dias |
| T4 (ajustes 4.2) | 1-3 dias — variável, só se confirma testando |
| T5 (conta Apple) | 1-2 dias, aprovação da Apple pode demorar |
| T6 (TestFlight + teste real, ordem de prioridade revisada) | 1-2 dias |
| T7 (revisão da Apple) | 1-3 dias, **mais se rejeitar — e a §0.2 mostra que pode rejeitar mesmo tudo certo** |

**Total: 2 a 4 semanas** (subiu em relação à primeira versão do plano, por causa de T1.5/T-DEL/T-DEMO,
que não existiam antes da pesquisa). **Não existe número que garanta zero rejeição** — o que dá pra
prometer é fazer os três tickets que a pesquisa mostra que mais reduzem o risco (T-DEMO, T1.5,
T-DEL) e citar o precedente certo na submissão (T7). O resto é decisão de um revisor humano do lado
de lá.

## 6 · O que NÃO muda

1. **O site continua no ar, sem interrupção, durante todo este plano.** Nenhum ticket aqui toca
   `next.config`, rotas ou deploy da Vercel de um jeito que afete quem usa pelo navegador.
2. **Nenhum dado de saúde/RLS/multi-tenant muda de comportamento** — o app é uma casca sobre a
   mesma API, mesma autenticação, mesma regra de negócio.
3. **Não é um "app separado" para manter.** Toda tela nova no site aparece automaticamente no app
   (por causa do `server.url` apontando pra produção, T1) — o único trabalho contínuo depois do
   lançamento é revisão de certificado anual (T3/T5) e, ocasionalmente, um novo build se a Apple
   mudar requisito de SDK mínimo.
