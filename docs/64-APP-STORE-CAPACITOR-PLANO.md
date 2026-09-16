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

## Status desta rodada (15/09, loop autônomo)

| Ticket | Estado |
|---|---|
| **T1** (scaffold Capacitor) | ✅ Feito — commit `58043e5` |
| **T1.5** (bloquear cobrança no app) | ✅ **Feito de verdade agora — critério de aceite #3 finalmente cumprido** — commits `a847275`+`7af6328` (9 telas com `BloqueioPlano`), `89b2d84` (fast-follow 1), `6a1ab7a` (a guarda de varredura que o critério #3 pedia desde o início NUNCA tinha sido escrita — escrevendo ela, achou mais 2 vazamentos reais em `modulos.tsx`/`orcamentos/lista.tsx`) e `016c651` (3º vazamento, na Central de Ações, que já estava registrado como pendência consciente desde 15/09 e finalmente foi corrigido). Ver `docs/DECISOES.md` 16/09 pela lição sobre declarar "completo" sem prova em código. |
| **T-DEL** (exclusão de conta) | ✅ Feito — commit `e6a633b` |
| **T-DEMO** (conta de demonstração) | ✅ **Feito 16/09** — tenant `apple-review` (barbearia, 12 clientes, 59 agendamentos) criado em produção via `seed-tenant-teste.mjs`, rodado pelo Eduardo (chave de produção não pode passar pela sessão de IA — bloqueado pelo próprio Claude Code, ver `docs/DECISOES.md`). Login: `revisor-apple@ciclo.app`, senha combinada fora do repositório. Sem expiração. Falta só confirmar visualmente que entra, e preencher "App Review Information" quando o iOS existir (T0). |
| **T-AND** (scaffold Android) | ✅ **Destravado nesta rodada** — commits `aa17e7f`+`2b9048c`+`f061c18`. JDK 21 e Android SDK command-line tools instalados nesta máquina (JDK via .zip portátil, não MSI — o instalador pediu UAC que a sessão não interativa não conseguiu conceder). `android/` gerado por `npx cap add android`, `./gradlew assembleDebug` builda com sucesso, ícone/splash reais gerados por `@capacitor/assets`. **Primeiro app nativo de verdade que compila neste projeto.** |
| **T0** (decisão Mac/CI pro iOS) | 🔴 Bloqueado — só o Eduardo decide |
| **T2** (ícone/splash) | ✅ Feito pro Android (dentro do T-AND) — iOS segue esperando T0/`ios/` existir |
| **T3** (push nativo) | Não iniciado — precisa de conta Apple (T5)/Firebase, ambos fora do alcance desta sessão |
| **T4** (ajustes 4.2) | 🟡 Em andamento — status bar nativa (commit `8ac1a7a`) e indicador de conexão offline (mesmo commit, corrigido em `f061c18`) prontos; haptics/share já vinham de rodada anterior. **Achado no emulador:** a StatusBar não muda de cor de verdade — Capacitor 8 parece ter trocado o mecanismo por um plugin interno novo (`SystemBars`), ver `docs/DECISOES.md` 2026-09-15. Falta corrigir isso, biometria, e o resto da lista de candidatos |
| **T6** (teste em dispositivo real) | 🟡 **Começado pro Android, sem login** — emulador `ciclo_test` (Pixel 6, API 34) criado e rodando nesta sessão: app abre, carrega `seuciclo.com.br` de verdade, navega entre `/entrar`↔`/recuperar-senha`, formulário valida campo vazio. Nenhuma conta criada (produção intocada). Falta tudo que precisa de login (T-DEMO) e o lado iOS inteiro (T0) |
| **T5, T7** (conta Apple, submissão) | Não iniciados — dependem do exposto acima |

**O Android roda de verdade num emulador; falta login pra testar o resto.** `android/` builda e
ABRE, carregando produção de ponta a ponta — mas sem a credencial de T-DEMO não dá pra testar
`/admin`, o Motor de Ciclo, nem se T1.5 bloqueia cobrança na prática (só foi verificado por
leitura de código até aqui). `ios/` continua sem existir (T0 travado, sem Mac). Toda verificação
seguiu sendo typecheck + lint + suíte unit + build de produção + o build Gradle em si + a rodada
manual no emulador; `test:integration`/`test:rls` seguem pendentes (Docker local fora do ar a
sessão inteira).

**Limite importante pra quem for continuar: o emulador carrega `server.url` de PRODUÇÃO (T1,
§0.4), não o `src/` local.** A rodada de navegação sem login testou código que já estava publicado
antes desta sessão. Qualquer coisa nova escrita hoje (T1.5 fast-follow, T4) só fica visível no
app depois de alguém publicar em produção e abrir de novo — não existe "testar localmente" pro
lado nativo com essa arquitetura. A correção da StatusBar (abaixo) é o primeiro exemplo real disso:
código corrigido por leitura do source do plugin, mas sem confirmação visual porque não foi
publicado ainda. Ver `docs/DECISOES.md` 2026-09-15 pros dois registros.

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
| **1** | **2.1 — Completude/performance** | **Mais rejeições que todas as outras categorias JUNTAS** `[P]` | Crash, trava, e **conta de demonstração ausente ou que não funciona** — o item que a pesquisa anterior não tinha coberto NADA, e é o maior risco isolado do plano inteiro. Ver §0.1 e T-DEMO. |
| 2 | 5.1.1 — Privacidade/dado pessoal | 2º lugar `[P]` | Exclusão de conta ausente (já coberto em T-DEL, rodada anterior) |
| 3 | 4.2 — Funcionalidade mínima | 3º lugar `[P]` | Já coberto (T3/T4, casca nativa + capacidade real) |
| 4 | 3.1.1 — Compra dentro do app | 4º lugar `[P]` | Já coberto (T1.5, esconder cobrança) — **menos comum estatisticamente do que a rodada anterior sugeria, mas continua sendo o único item desta lista sem solução garantida (§0.2 abaixo)** |
| 5 | 2.3 — Metadado impreciso | 5º lugar `[P]` | Screenshot que promete o que o app não tem, ícone genérico — ver T7 revisado |

**Conclusão prática: o ticket de maior prioridade do plano inteiro não é nenhum dos dois que a
primeira rodada tinha marcado como críticos — é preparar uma conta de demonstração real e estável
pro revisor da Apple usar.** Sem ela, a Apple nem chega a avaliar o resto: um app que pede login e
não vem com credencial que funciona é recusado antes de qualquer julgamento sobre 4.2 ou 3.1.1.

**Duas atualizações da terceira rodada de pesquisa (§0.6, §0.7) mudam mais coisa:** o bloqueio de
cobrança (3.1.1/T1.5) deixou de ser "nunca um link, sem exceção" — o Brasil abriu a opção de link
clicável com 15% de taxa pra Apple, então virou decisão de negócio, não regra fixa (§0.6). E existe
um caminho pra ANDROID que não depende de Mac e pode começar nesta mesma sessão, possivelmente
chegando na loja antes do iOS (§0.7, ticket T-AND).

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

### 0.6 · Terceira rodada: o texto oficial da regra, e uma opção que o Brasil abriu em 2026

Fui direto na fonte (`developer.apple.com/app-store/review/guidelines`) em vez de confiar só em
blog de terceiro, e achei uma mudança recente que muda a decisão de T1.5 — não é mais "nunca um
link", é uma escolha com preço.

**O texto oficial da 3.1.3(b) "Multiplatform Services"** `[P]`: *"Apps that operate across multiple
platforms may allow users to access content, subscriptions, or features they have acquired in your
app on other platforms or your web site... Apps in this section cannot, within the app, encourage
users to use a purchasing method other than in-app purchase, **except for apps on the United States
storefront** and as set forth in 3.1.1(a) e 3.1.3(a)."* — a franquia de link nos EUA, que resultou
do processo Epic v. Apple (decisão de 2025), **historicamente não valia fora dos EUA.**

**O que mudou pro Brasil especificamente, em 2026:** Apple fechou acordo com o CADE (o órgão
antitruste brasileiro) — a partir do iOS 26.5, apps no storefront BRASILEIRO também podem incluir
link clicável de pagamento externo `[P]`. **Mas com uma pegadinha que os EUA não têm:** link
clicável paga **15% de taxa pra Apple sobre a transação**, mesmo o pagamento acontecendo fora do
app (Mercado Pago); **texto estático sem link continua sem taxa nenhuma** `[P]`.

**Isto vira uma decisão de negócio, não só técnica — registrada aqui, decisão do Eduardo:**

| Opção | Taxa pra Apple | Experiência |
|---|---|---|
| **(A) Só texto, sem link** (o que T1.5 já previa) | Zero | "Gerencie seu plano em seuciclo.com.br" — a pessoa digita o site de cabeça ou copia o texto |
| **(B) Link clicável pro checkout** | **15% da assinatura**, cobrado pela Apple sobre transações que vieram do link | Um toque abre o navegador direto na tela de assinar — mais conversão, custo real |

Num plano de R$ 49-179/mês, 15% é R$ 7,35 a R$ 26,85/mês por assinante que veio pelo link — **contra
zero no Mercado Pago hoje.** A pergunta que só o Eduardo responde: o link clicável converte gente
o bastante a mais pra justificar dar uma fatia pra Apple, ou o produto prefere ficar 100% fora do
alcance da taxa e aceitar que quem quiser assinar vai ter que digitar o site sozinho? **T1.5 abaixo
foi ajustado pra oferecer os dois caminhos, com a opção (A) como padrão até haver decisão.**

**Recomendação, se quiser a minha opinião:** começar pela opção (A) (sem link, sem taxa) — é reversível
(virar link depois é troca de uma linha), e evita registrar o app num programa de link externo (que
exige `entitlement`/inscrição própria na Apple, mais um item de processo) antes de saber se vale a
pena. Trocar pra (B) depois que o app já estiver no ar e der pra medir se falta conversão é decisão
mais barata que decidir às cegas agora.

### 0.7 · Descoberta estratégica: talvez o caminho mais rápido pra "credibilidade" não seja o iOS primeiro

Voltando à razão original do Eduardo pra querer apps nas lojas (`ciclo-apps-mobile-lojas`,
memória): **credibilidade, não distribuição** — as duas lojas existirem importa mais do que qual
vem primeiro. Isso muda a pergunta de "quando o app fica pronto" pra "qual dos dois fica pronto
primeiro, com menos risco".

**Medido/pesquisado `[M]`/`[P]`: Android NÃO precisa de Mac.** `Capacitor` builda Android inteiro —
APK/AAB assinado — em Windows, com Android Studio + JDK, sem NENHUMA dependência de macOS/Xcode.
**Isto significa que eu consigo avançar o Android bem mais longe nesta própria sessão**, sem
esperar o Eduardo decidir T0 (Mac/Codemagic/Xcode Cloud) — algo que trava o iOS por completo.

**Comparação direta:**

| | iOS (App Store) | Android (Google Play) |
|---|---|---|
| Precisa de Mac | Sim, sem exceção `[BLOQ]` | **Não — builda em Windows** `[P]` |
| Custo de conta | US$ 99/ano | **US$ 25, uma vez só** `[M]`, já medido em rodada anterior |
| Prazo de revisão | 1-3 dias, pode ir mais | Geralmente mais rápido, horas a poucos dias `[P]` |
| Risco de rejeição por completude/crash (a categoria nº1, §0.0) | Alto se faltar T-DEMO | Mesmo risco existe (18-20% das rejeições `[P]`) — T-DEMO serve os DOIS |
| Risco de rejeição por cobrança (3.1.1) | Real, sem garantia (§0.2) | **Corrigido em §0.9 (quarta rodada): mesmo risco, sem exceção nomeada equivalente à 3.1.3(b)** — T1.5 vale igual pros dois apps, não é "mais fácil" no Android |
| Exclusão de conta | Só precisa do caminho dentro do app | **Precisa do caminho dentro do app E de um link público na web** `[P]` — T-DEL já cobre os dois se o link for público |

**O que isto muda no plano:** os tickets que não são específicos de iOS (T-DEMO, T-DEL, T1.5, e a
parte de T4 que é ajuste de UI/comportamento, não de Xcode) **servem pros dois apps ao mesmo tempo,
sem trabalho duplicado.** Só T2 (ícone nativo), T3 (push — APNs pra iOS, FCM pra Android, mecanismos
diferentes) e T6/T7 (build e submissão) precisam de trilhos separados.

**Novo ticket, T-AND, abaixo — e ele pode COMEÇAR AGORA, nesta sessão, sem depender de nenhuma
decisão do Eduardo.**

### 0.9 · Quarta rodada (/loop autônomo): cinco ângulos fechados, um enfraquece o plano, quatro confirmam/reduzem risco

Pedido do Eduardo: pesquisar mais fundo, deixar o mais perfeito possível, rodando sozinho. Cinco
frentes que as rodadas anteriores tinham deixado sem citação firme ou sem checar.

**1. Google Play NÃO tem uma exceção tão larga quanto a 3.1.3(b) da Apple — corrige uma afirmação
anterior.** A rodada de §0.7 dizia "Google historicamente mais flexível com apps B2B", **sem
fonte** — errado dizer isso sem citação. Conferido agora `[P]`: a política de pagamento do Google
Play só lista exceções estreitas e nomeadas (operadoras de telecom/TV a cabo cobrando na fatura do
serviço físico) — não existe uma cláusula geral de "app B2B multiplataforma" escrita como a da
Apple. **Na prática**, apps como Fresha, Booksy, Mindbody Business seguem publicados no Google Play
com o mesmo padrão (login-only, sem compra) — o que sugere que o Google aplica a regra com mais
folga NA PRÁTICA do que o texto da política sozinho sugeriria, mas **isso é dedução por precedente,
não uma regra escrita que eu possa citar como garantia.** T1.5 continua valendo igual pros dois
apps — o risco não é menor no Android, só não tem uma exceção nomeada dos dois lados.

**2. Mais um precedente real, direto do nicho: Mindbody Business App já está na App Store** `[P]`
— confirma pela terceira vez (com Fresha e Booksy) que o padrão "login-only, sem compra dentro do
app" é aceito pra ferramentas de gestão de salão/estúdio/spa, categoria quase idêntica ao CICLO.

**3. Por que o CICLO não se qualifica pra exceção de "serviço do mundo real" (a que livra Uber e
Airbnb de usar IAP)** `[P]`: essa exceção vale quando o app cobra por algo consumido FORA do
app (uma corrida, uma hospedagem) — a Apple não é o processador desse serviço. **A assinatura do
CICLO não se encaixa aqui**: ela libera MÓDULO dentro do próprio app (equipe, estoque, mais
profissionais) — é literalmente "desbloquear funcionalidade dentro do app", a definição textual da
3.1.1 (§0.2). Não é uma porta que valha a pena perseguir; T1.5 (esconder a cobrança inteira)
continua sendo o caminho certo, não uma reclassificação de categoria.

**4. Guideline 2.5.1 (API privada) — risco baixo, mas com uma pegadinha histórica do próprio
Capacitor** `[P]`: apps Capacitor antigos (anteriores à migração de `UIWebView` pra `WKWebView`,
Capacitor 3+) já foram rejeitados por isso — `UIWebView` está formalmente descontinuado pela Apple.
**Toda versão atual do Capacitor usa `WKWebView` por padrão**, então o risco é baixo — mas vira um
item de checklist explícito em T1, não uma suposição.

**5. Face ID/Touch ID como capacidade nativa de T4 — risco de LGPD MENOR do que eu esperava** `[P]`:
dado biométrico é categoria sensível (LGPD art. 11), mas o `LocalAuthentication` da Apple mantém o
molde biométrico **só no dispositivo** (Secure Enclave) — o CICLO nunca recebe nem armazena o dado
biométrico em si, só um "sim/não" do sistema operacional. Isso tira o CICLO do papel de controlador
desse dado especificamente, reduzindo bastante a exigência de consentimento formal em cima dele
(comparado a, por exemplo, foto de reconhecimento facial armazenada em servidor). **Face ID sobe de
prioridade como candidato de T4** — nativo, útil de verdade (destrava a agenda rápido), risco de
compliance baixo.

**6. Soft-ask antes do prompt nativo de notificação — vira critério de aceite novo em T3** `[P]`:
mostrar uma tela própria explicando o valor ("avise quando um cliente sumir") ANTES do prompt do
sistema aumenta a taxa de aceite em 30-50%, e protege a única tentativa que o sistema permite —
quem recusa o soft-ask nunca vê o prompt de verdade, então pode tentar de novo depois; quem recusa
o prompt do SISTEMA não pode ser perguntado de novo pelo app. T3 ganhou este item.

**Conclusão desta rodada: nenhum achado novo enfraquece o plano de forma que exija mudar decisão
já tomada.** O item 1 corrige uma afirmação que estava sem base (Google "mais flexível") pra uma
mais honesta (mesmo risco, sem exceção nomeada). Os itens 2-6 reforçam ou destravam pequenas
melhorias (Face ID, soft-ask, checklist de WebView). **A pesquisa está no ponto de retornos
decrescentes** — mais rodadas tendem a confirmar o que já está escrito, não a virar o plano de
cabeça pra baixo.

### 0.10 · Sources

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
- [App Review Guidelines — Apple Developer (texto oficial 3.1.1/3.1.3)](https://developer.apple.com/app-store/review/guidelines/#business)
- [Apple Settles Brazilian Antitrust Case, Must Allow Third-Party App Stores and External Payment Links — Slashdot](https://apple.slashdot.org/story/25/12/26/0039248/apple-settles-brazilian-antitrust-case-must-allow-third-party-app-stores-and-external-payment-links)
- [Payment options on the App Store in Brazil — Apple Developer](https://developer.apple.com/support/payment-options-on-the-app-store-in-brazil)
- [App-to-web: navigating external purchases in iOS and Android apps — RevenueCat](https://www.revenuecat.com/blog/engineering/app-to-web-purchase-guidelines)
- [Apple must allow External Payment Links: Epic v. Apple ruling — RevenueCat](https://www.revenuecat.com/blog/growth/apple-anti-steering-ruling-monetization-strategy)
- [Deploying Capacitor Applications to Android — Josh Morony](https://www.joshmorony.com/deploying-capacitor-applications-to-android-development-distribution/)
- [Android Setup for Capacitor Apps — Capgo](https://capgo.app/blog/android-setup-for-capacitor-apps/)
- [Google Play App Rejected in 2026: Rejection Reasons Decoded — QAwerk](https://qawerk.com/blog/google-play-rejection-reasons/)
- [Understanding Google Play's app account deletion requirements — Google Play Console Help](https://support.google.com/googleplay/android-developer/answer/13327111?hl=en)
- [Understanding Google Play's Payments policy — Google Play Console Help](https://support.google.com/googleplay/android-developer/answer/10281818?hl=en)
- [Mindbody Business App — App Store](https://apps.apple.com/us/app/mindbody-business/id599125654)
- [Guideline 3.1 Rejection: How to Fix In-App Purchase Issues (real-world services exemption) — iOS Submission Guide](https://iossubmissionguide.com/guideline-3-1-in-app-purchase/)
- [Guideline 2.5.1 - Software Requirements: Using Private or Undocumented APIs — AppStoreReject](https://appstorereject.com/rejections/apple/2/guideline-251-software-requirements-using-private-or-undocumented-apis)
- [LGPD e Dados Biométricos — Reconhecimento Facial, Digital e Voz — Confidata](https://confidata.com.br/blog/lgpd-dados-biometricos-reconhecimento-facial-digital)
- [iOS Push Notification Permissions: The Best Practices — Hurree](https://blog.hurree.co/ios-push-notification-permissions-best-practises)
- [iOS Push Permission: Priming Patterns That Lift Opt-In — PushEngage](https://www.pushengage.com/ios-push-notification-permission/)

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

   **Rascunho pronto (16/09), já batendo com o tenant `apple-review` real** (barbearia, 12
   clientes, 59 agendamentos, 5 semanas de histórico) — pra colar em "App Review Information",
   campo "Notes":

   > 1. Log in with the credentials above.
   > 2. Tap "Hoje" (Today) — the home screen shows today's schedule and pending actions.
   > 3. Tap "Clientes" (Clients) — the client list shows return-visit predictions; clients tagged
   >    "Sumindo" (Fading) are predicted to be overdue for their next visit.
   > 4. Tap any client to see their visit history and the "Motor de Ciclo" (Cycle Engine)
   >    prediction for their next expected visit.
   > 5. Tap "Agenda" — the calendar view shows scheduled appointments across the team.
   >
   > This account has real seeded history (created 2026-09-16) so the prediction engine has data
   > to show — a brand-new account would appear empty.
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

**Só bloqueia o iOS** (§0.6) — o Android (T-AND) não depende desta decisão e pode avançar em
paralelo, sem esperar.

**Não é ticket de código.** Três caminhos, escolher um antes de T5:

| Caminho | Custo | Prós | Contras |
|---|---|---|---|
| Mac próprio/emprestado | R$ 0 extra | Controle total, sem depender de terceiro | Precisa ter acesso a um |
| Codemagic (free tier) | Grátis até um limite de minutos/mês | Não precisa de Mac, integra com GitHub | Configuração inicial, limite de build |
| Xcode Cloud (Apple) | Incluso no Developer Program | Integração nativa com App Store Connect | Só funciona se o projeto já estiver num repo que a Apple acessa |

**Recomendação:** Codemagic — mais simples de ligar a este repositório GitHub sem precisar
comprar/pedir emprestado um Mac.

---

### T1 · Scaffold do Capacitor sobre o Next.js `[FEITO 2026-09-15]`

**Objetivo.** `npx cap init` configurado, apontando para o build estático/SSR do Next existente,
sem quebrar o deploy web atual.

**Critério de aceite.**
1. `@capacitor/core`, `@capacitor/cli`, `@capacitor/ios` instalados como dependência do projeto,
   sem afetar o bundle que a Vercel serve (Capacitor só entra no build nativo, nunca no `next
   build` da Vercel).
2. `capacitor.config.ts` na raiz, com `server.url` apontando para o domínio de produção. **Revisado
   em 15/09 (§0.4):** a pesquisa aponta "app que só abre uma URL remota" como bandeira vermelha —
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
   rejeição por parecer literalmente o Safari (§0.4).
6. **Confirmar versão do Capacitor usando `WKWebView`, nunca `UIWebView`** (§0.9): `UIWebView` está
   formalmente descontinuado pela Apple e é motivo de rejeição automática sob a guideline 2.5.1 —
   toda versão atual do Capacitor (3+) já usa `WKWebView` por padrão, mas checar `package.json` e
   qualquer plugin de terceiro que ainda possa carregar `UIWebView` por baixo.

**Onde mexer.** Raiz do projeto (`capacitor.config.ts`, `package.json`), `ios/` (gerado pelo CLI,
não escrito à mão).

**Armadilhas.**
- `server.url` para produção real, nunca para `localhost` — child da mesma armadilha que
  `criar-tenant-real.mjs` já documentou para scripts de banco: ambiente errado, gravado sem avisar.
- Next.js com Server Components/Server Actions dentro de uma WebView exige atenção a cookies/CORS
  — testar login de verdade antes de considerar T1 pronto (precisa do Mac de T0).

---

### T1.5 · Bloquear TODA tela de cobrança dentro do app iOS `[RISCO-ABERTO]` `[FEITO 2026-09-15]` — o ticket mais importante do plano

**Objetivo.** Fechar o risco #1 achado na pesquisa (§0.2): nenhuma tela de preço, plano ou
"Assinar" pode ser alcançável de dentro do app nativo — a Apple rejeita isso sob a guideline 3.1.1
com quase certeza (é o padrão de rejeição mais citado pra este tipo de app), e mesmo fazendo tudo
certo o risco não some 100% (caso documentado em §0.2).

**Decisão de escopo, perguntada pelo Eduardo em 15/09: cadastro fica dentro do app, só o pagamento
sai.** As duas coisas são eventos diferentes no produto, e só um dos dois é regulado pela 3.1.1:

- **Criar conta nova (nome, e-mail, senha, nome do salão) continua funcionando dentro do app**,
  normalmente, e nasce no plano **Grátis** — que não cobra nada, então não é "conteúdo pago" e a
  3.1.1 não se aplica. É inclusive melhor pra 4.2 (§0.4): um app que só faz login é mais "site numa
  casca" do que um que deixa a pessoa realmente começar a usar ali. Zero trabalho novo — é o mesmo
  onboarding que já existe.
- **Qualquer caminho que leve a PAGAR — `/admin/config/meu-plano`, o botão "Assinar", checkout do
  Mercado Pago — fica de fora do app inteiramente.** A forma como fica de fora é decisão de
  negócio, revisada em §0.6: **opção (A), padrão até o Eduardo decidir o contrário** — texto sem
  nenhum link clicável ("gerencie seu plano em seuciclo.com.br"), zero taxa pra Apple; **opção
  (B)** — link clicável de verdade, permitido no storefront brasileiro desde o acordo com o CADE,
  mas com 15% de taxa pra Apple sobre quem assinar por ali. As duas são legítimas; a diferença é
  quem fica com uma fatia da receita.
- É exatamente o padrão que Fresha for Business e Booksy Biz já usam, publicados (§0.2): cadastro e
  uso livres no app, cobrança 100% no site.

**Critério de aceite.**
1. Detectar `Capacitor.isNativePlatform()` num ponto central (middleware ou layout raiz de
   `/admin/config`), e quando verdadeiro: `/admin/config/meu-plano` e qualquer rota de
   `/api/v1/billing/*` respondem com uma tela/mensagem "Gerencie seu plano em seuciclo.com.br".
   **Implementar a opção (A) primeiro** (§0.6): sem formulário, sem preço, sem botão de ação, sem
   link clicável — o texto sozinho basta, e não exige inscrição em nenhum programa da Apple. A
   opção (B) (link clicável + 15% de taxa, só permitido no storefront BR) fica registrada como
   troca de uma linha pra depois, se o Eduardo decidir que vale a taxa — não implementar sem essa
   decisão explícita.
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
   aprovado no mesmo nicho — a pesquisa (§0.2) mostra que isso ajuda, mesmo não garantindo.
5. **Cadastro de conta nova (plano Grátis) testado dentro do app e confirmado que continua
   funcionando sem nenhuma mudança** — este ticket só bloqueia cobrança, nunca cadastro. Se algum
   ajuste de T1.5 sem querer também esconder o formulário de cadastro, é regressão, não é o
   objetivo.

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

### T-DEL · Exclusão de conta pelo próprio dono/profissional `[FEITO 2026-09-15]`

**Objetivo.** Fechar a lacuna achada em §0.3 — hoje ninguém consegue excluir a própria conta, nem
no site. É pré-requisito de App Store (guideline 5.1.1(v)) **e** de Google Play (mesma exigência, e
mais rígida numa parte — ver item 4a) **e** lacuna de LGPD (art. 18 VI) independente do app.

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
   1. **(4a) Google Play pede um passo a mais que a Apple não pede** (§0.7, confirmado `[P]`):
      além do caminho DENTRO do app, precisa de uma **página pública na web** que explica como
      excluir a conta, sem precisar estar logado no app pra ler. `/privacidade` (que já existe) é
      o lugar natural — uma seção nova com o link direto pra `/admin/config` (pedindo login) já
      satisfaz os dois, sem página extra.
5. Guarda: teste de integração que cria conta, chama a exclusão, confirma que login deixa de
   funcionar e que dados de outros tenants não foram tocados.

**Onde mexer.** `src/app/api/v1/account/`, `src/server/services/` (novo `contas.ts` ou estender
existente), UI em `src/app/admin/config/`, seção nova em `src/app/(public)/privacidade/`.

**Armadilhas.** Igual à `erase` de cliente: decidir com cuidado o que é "excluído" vs. "anonimizado
por obrigação legal" — LGPD permite reter o mínimo que a lei exigir (fiscal, por exemplo), nunca o
resto.

---

### T-AND · Scaffold Android — pode começar JÁ, sem depender do Eduardo nem de Mac `[DESTRAVADO 2026-09-15: JDK 21 + Android SDK instalados, android/ builda]`

**Objetivo.** A descoberta de §0.7: Android builda inteiro no Windows desta sessão. Enquanto T0
(decisão do Mac/CI pro iOS) não sai, o Android pode chegar bem mais longe — potencialmente até
"pronto pra submeter", sozinho.

**Critério de aceite.**
1. ✅ `@capacitor/android` instalado junto de `@capacitor/core`/`cli` (T1 virou "T1 pros dois", não
   dois scaffolds separados — o `capacitor.config.ts` é um só, com `server.url` igual pros dois).
2. ✅ **JDK 21, não 17.** JDK 17 foi a primeira tentativa e falhou o build (`invalid source
   release: 21` — o Android Gradle Plugin do Capacitor 8 exige `--release 21`). Instalado via .zip
   portátil da Microsoft, não o instalador MSI do winget: o MSI pede elevação (UAC) que uma sessão
   não interativa não consegue conceder ("Você cancelou a instalação", código 1602). Android SDK
   command-line tools (só o CLI, não o Android Studio inteiro — suficiente pro Capacitor) via
   download direto do repositório do Google; `sdkmanager --licenses` aceito, `platform-tools` +
   `platforms;android-34` + `build-tools;34.0.0` instalados. `JAVA_HOME`/`ANDROID_HOME` persistidos
   como variável de usuário do Windows (`setx`), sobrevivem a esta sessão. `npx cap add android` +
   `./gradlew assembleDebug` confirmados — **primeiro app nativo de verdade que compila neste
   projeto.**
3. ✅ T1.5 (bloqueio de cobrança) e T-DEL (exclusão de conta) **servem os dois apps sem duplicar
   trabalho** — são checagem de `Capacitor.isNativePlatform()`, que é `true` nos dois, não só no
   iOS. T-DEMO segue pendente (ação do Eduardo, ver acima).
4. ✅ Ícone/splash Android gerados por `@capacitor/assets` a partir do mesmo ícone da PWA
   (`public/icons/icon-512.png`) — `ic_launcher` em todas as densidades, adaptive icon, splash
   claro/escuro. `resources/icon.png`/`resources/splash.png` versionados como fonte pro T2 do iOS
   reaproveitar depois.
5. ⏸️ Push nativo Android usa **Firebase Cloud Messaging (FCM)**, não APNs — mecanismo diferente do
   T3, mas o mesmo formato de trabalho (token do dispositivo, mesma tabela/coluna que o T3 já
   desenha para o token do iOS, só um terceiro valor no "tipo"). Não iniciado — precisa de projeto
   Firebase configurado, fora do alcance desta sessão.
6. ⏸️ Build assinado (keystore próprio, gerado uma vez e guardado com cuidado — **perder o keystore
   significa não poder mais atualizar o mesmo app na Play Store, para sempre**) — isto sim precisa
   de uma decisão do Eduardo (onde guardar o keystore com segurança), mas é rápido de resolver, sem
   custo e sem Mac. Só o build de DEBUG existe hoje, sem assinatura de release.
7. ⏸️ Conta Google Play Developer (US$ 25, uma vez só, não anual como a Apple) — só o Eduardo
   compra, mas a aprovação da conta costuma ser mais rápida que a da Apple `[P]`.

**Onde mexer.** `android/` (gerado pelo CLI, não escrito à mão), mesmo helper de plataforma do
T1.5 (`Capacitor.isNativePlatform()` já cobre Android e iOS igual, sem `if` separado por SO a menos
que o comportamento realmente precise diferir).

**Armadilhas.**
- Guideline de completude/crash do Google Play (§0.7) é tão séria quanto a da Apple — **T-DEMO e o
  checklist de crash de T6 valem igual aqui**, não é "Android é mais light, relaxa".
- Keystore perdido é o único erro deste ticket que não tem conserto — backup em local seguro desde
  o primeiro build assinado, nunca só na máquina de build.
- Push nativo (item 5) precisa de projeto Firebase configurado — outra conta/console novo, mas
  gratuito e sem aprovação demorada como a Apple.

---

### T-AND-DS · Rascunho do formulário "Data Safety" do Google Play `[PREP 16/09]`

**Objetivo.** O Google Play exige um questionário próprio de privacidade (diferente do "App
Privacy" da Apple, T7 critério #4) — preenchido errado é motivo de remoção da loja depois, mesmo
padrão de risco. Rascunho pronto por leitura do schema real (`supabase/migrations/`), não por
suposição — pra quando alguém for preencher o formulário de verdade no Play Console, ter a lista
certa em mãos em vez de decidir às pressas.

**O que o CICLO de fato coleta, por categoria do formulário do Google (conferido no schema):**

| Categoria do Google | Coleta? | De onde vem |
|---|---|---|
| **Nome** | Sim | `clients.name`, dados da conta do profissional |
| **E-mail** | Sim | `clients.email`, conta do profissional (Supabase Auth) |
| **Telefone** | Sim | `clients.phone_e164` |
| **Endereço** | Sim | `clients.address` |
| **ID do usuário** (CPF/documento) | Sim | `clients.document` — nota fiscal |
| **Fotos** | Sim | `portfolio_photos`, fotos de serviço/profissional (migrations 0052/0053) |
| **Informação de saúde** | **Sim** | O cofre (`vault`/anamnese) — mesma categoria sensível do App Privacy da Apple |
| **Informação financeira** | Não coleta cartão — Mercado Pago processa o pagamento, o CICLO nunca vê número de cartão. Só valores de transação (não é a categoria "financeira" que o Google pergunta, que é sobre credencial de pagamento) |
| **Localização** | Não | Nenhuma coluna de geolocalização no schema |
| **Identificadores de dispositivo/publicidade** | Não | Confirmado em §0.5: nenhum SDK de rastreamento/analytics no código |
| **Contatos** | Não | O app não lê a agenda de contatos do celular |

**Perguntas que o formulário do Google faz, com a resposta já pronta:**
- "Os dados são criptografados em trânsito?" → **Sim** (HTTPS obrigatório, `cleartext: false` no
  `capacitor.config.ts`).
- "O usuário pode pedir a exclusão dos dados?" → **Sim** — T-DEL (`/admin/config/excluir-conta`
  dentro do app, `/privacidade` fora dele, os dois já existem).
- "Os dados são compartilhados com terceiros?" → Tecnicamente sim (Mercado Pago processa o
  pagamento, algum provedor processa WhatsApp/e-mail — confirmar qual em
  `src/server/providers/messaging/`), **mas `/privacidade` hoje só diz genericamente "não cede a
  terceiro", sem nomear nenhum processador**. Isso é uma lacuna real da própria política, não só
  do formulário do Google — vale considerar atualizar `/privacidade` pra nomear os processadores
  antes de preencher o Data Safety com uma resposta que a página pública ainda não sustenta.
- "A informação de saúde é opcional?" → Sim, a anamnese não é obrigatória pro básico do produto
  funcionar (agenda, clientes, caixa funcionam sem nunca abrir o cofre).

**O que NÃO fica pronto aqui, de propósito:** a lista de terceiros que recebem dado (pergunta do
formulário) precisa bater com o que `/privacidade` já diz publicamente — meu levantamento é do
schema, não da política publicada. Quem for preencher o formulário do Play Console deve abrir
`/privacidade` ao lado e usar a mesma lista, não uma nova.

---

### T2 · Ícone, splash screen e identidade nativa (iOS — Android tem o espelho em T-AND item 4)

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

### T3 · Push notification nativo — APNs no iOS, FCM no Android (T-AND item 5)

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
4. **Soft-ask antes do prompt nativo do sistema** (§0.9): uma tela própria, dentro do app,
   explicando o valor ("avise quando um cliente sumir" / "lembre de um horário chegando") ANTES de
   chamar a permissão real do iOS/Android. Pesquisa mostra 30-50% mais aceite, e protege a única
   tentativa que o sistema permite — quem recusa a tela própria pode ser perguntado de novo mais
   tarde; quem recusa o prompt do SISTEMA não pode.

**Onde mexer.** `src/server/providers/messaging/push.ts`, migration nova (coluna de tipo de token),
`ios/` (capabilities do Xcode: Push Notifications habilitado), tela nova de soft-ask (componente
React simples, reaproveitando o padrão visual de qualquer outro convite do produto).

**Armadilhas.** Certificado APNs expira anualmente — documentar a data de expiração em algum lugar
visível (`docs/DECISOES.md` serve), senão o push para de funcionar em silêncio um ano depois, sem
ninguém entender por quê.

---

### T4 · Ajustes para a diretriz 4.2 (não ser "só WebView")

**Objetivo.** Reduzir o risco de rejeição na primeira submissão. **Revisado 15/09 (§0.0):** não é
mais o item de maior risco do plano — T-DEMO e T1.5 pesam mais na estatística real — mas continua
sendo o que só se confirma testando de verdade contra a revisão da Apple, então o prazo dele
continua incerto.

**Critério de aceite — status em 16/09, depois do primeiro teste em emulador de verdade.**
1. Pelo menos DOIS comportamentos nativos genuínos além do push (T3): candidatos, em ordem de
   prioridade revisada em §0.9 —
   - ✅ Haptic feedback (`@capacitor/haptics`): confirmar/chegou/concluir/faltou desde a rodada
     anterior, cancelamento de agendamento fechado em 16/09 (commit `06b5e4f`).
   - ✅ Compartilhamento nativo (`@capacitor/share`) no convite B2B ("Indicar o CICLO") — o único
     lugar que o plano pedia; os demais links `wa.me` do produto (avaliação, orçamento, lembrete)
     são decisão de escopo deliberada, não vazamento — convertê-los pra `Share` trocaria "abre
     direto no WhatsApp" por "abre o seletor do sistema", mudança de UX que pede decisão de
     produto, não conserto de bug.
   - ✅ Status bar nativa (`@capacitor/status-bar`) — corrigida em 16/09 depois do achado no
     emulador (edge-to-edge no `targetSdk 36` ignora `setBackgroundColor`; ver `docs/DECISOES.md`).
     **Ainda sem confirmação visual** — só fica visível depois de publicado (T1, `server.url` é
     produção, não local).
   - ⏸️ **Face ID/Touch ID pra destravar o app**: continua sendo o único candidato NÃO iniciado.
     Continua de prioridade alta (LGPD baixo risco, molde nunca sai do Secure Enclave), mas
     **de propósito não implementado ainda nesta rodada** — ver nota abaixo.
2. ✅ Ícone de rede/estado offline (`IndicadorDeConexao`, commit `8ac1a7a`, corrigido em `f061c18`)
   — feito, serve os dois lados (web e nativo), a versão web NÃO tinha isso antes (conferido).
3. **Cumprido de um jeito parcial**: T1 rodou de verdade num EMULADOR Android em 16/09 (não um
   dispositivo físico, e só o lado Android — `ios/` continua sem existir, T0 travado). Suficiente
   pra confirmar que o WebView carrega produção e navega, insuficiente pra testar biometria de
   verdade (emulador simula digital via `adb -e emu finger touch`, mas é outra camada de
   verificação que esta sessão não chegou a montar).

**Por que a biometria fica de fora desta rodada, registrado como decisão e não esquecimento:** ao
contrário de status bar/haptics/share/indicador — que são aditivos e falham fechado sozinhos (nunca
bloqueiam nada se o plugin não responder) — um destravador biométrico muda o FLUXO DE ENTRADA do
app. Implementado errado (ex.: sem fallback quando o aparelho não tem biometria configurada, ou
travando em vez de deixar passar num erro do plugin), a "melhoria" tranca gente pra fora da própria
conta — pior que não ter a funcionalidade. Sem um dispositivo real (ou pelo menos um emulador com
impressão digital simulada e testada) pra ver o caminho de erro funcionando, implementar isso é
repetir o erro que o critério #3 original já nomeava ("planejar sobre premissa não testada") — só
que desta vez sobre um recurso que pode trancar gente pra fora, não só ficar feio.

**Especificação pronta pra quando alguém for implementar, com dispositivo em mãos:**
- Plugin: `@aparajita/capacitor-biometric-auth` (único encontrado com peer deps batendo Capacitor 8
  — `capacitor-native-biometric`, mais popular, trava em Capacitor 3).
- Opt-in, OFF por padrão — nunca forçar. Preferência em `localStorage` (é uma trava de tela, não
  dado de conta; não precisa sincronizar entre aparelhos, e mantém o desenho "sem servidor" que o
  resto de T4 já usa).
- **Falhar aberto, sempre**: aparelho sem biometria configurada, plugin retornando erro, ou usuário
  cancelando a prompt → deixa entrar normalmente (mesma sessão de cookie que já existe, T1). Nunca
  um segundo passo de senha "de emergência" — isso duplicaria o login que já existe.
- Gatilho: `App.addListener('resume', ...)` do `@capacitor/app` (voltar de segundo plano), não só
  no primeiro carregamento — é o momento que a Apple/reviews de UX de app-lock mais citam.

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
   Fresha/Booksy) — não é garantia, mas a pesquisa mostra que ajuda. **Rascunho pronto pra copiar
   (16/09), pra não escrever isso com pressa na hora da submissão:**

   > CICLO is a business management companion app for service professionals (salons, barbers,
   > nail studios) who already manage their business through our web platform at
   > seuciclo.com.br. This app provides mobile access to an existing account — appointment
   > scheduling, client management, and business analytics.
   >
   > In line with guideline 3.1.3(b) (Multiplatform Services), this app does not offer any
   > in-app purchase, subscription, or payment flow. All plan/subscription management happens
   > exclusively on our website, which the app does not link to or embed. New users can create a
   > free-tier account directly within the app (no payment involved); upgrading to a paid tier is
   > only possible by visiting seuciclo.com.br in a browser, outside this app.
   >
   > This is the same pattern used by other apps in the salon/spa/studio management category,
   > such as Fresha for Business and Booksy Biz, both published on the App Store.
   >
   > Demo account credentials are provided in the App Review Information section above.

   **Depois de revisado por alguém de verdade** (o texto acima é rascunho técnico, não passou por
   revisão de inglês nativo nem jurídica) — vale conferir se o nome exato "seuciclo.com.br" ainda é
   o domínio de produção na hora de usar (`APP_HOST`, `src/lib/app-url.ts`, é a fonte única).
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
T-DEMO (prioridade 1 — começa JÁ, serve os dois apps)
T-DEL  (pode começar já, serve os dois apps)

T-AND (Android — pode começar JÁ, não depende do Eduardo nem de Mac)
  └─▶ T1 (scaffold, os dois) ─▶ T1.5 (bloquear cobrança, os dois) ─▶ T2/T3 Android ─▶ submissão Android
                                                                          ▲
T0 (Eduardo, decide onde builda O iOS)                                   │
  └─▶ T2/T3 iOS ─────────────────────────────────────────────────────────┘
         └─▶ T4 (ajustes 4.2, os dois) ──────────────────────────────────┘
                                                                          │
                                                                          ▼
                                                      T6 (device — Mac só pro iOS) ─▶ T7 (submissão)

T5 (Eduardo, conta Apple+certificados — só pro iOS, paralelo com tudo)
```

**T-DEMO e T-DEL não dependem de NADA — podem ser feitos nesta sessão, antes de qualquer decisão do
Eduardo, e servem os DOIS apps.** T-AND também não depende de nada do Eduardo e pode avançar nesta
sessão. T0 e T5 são do Eduardo e só bloqueiam o iOS. T1, T1.5, T2, T3 e T4 são código — a maior
parte serve as duas plataformas ao mesmo tempo (§0.7), só T2/T3 (ícone, push) têm uma metade
específica por SO. **Ordem de prioridade real, revisada em §0.0/§0.7: T-DEMO > T1.5 ≈ T-DEL > T-AND
> T4 > T2/T3.**

## 4 · Custos `[M]`

| Item | Custo | Recorrência | Plataforma |
|---|---|---|---|
| Apple Developer Program | US$ 99 (~R$ 550-600) | Anual | iOS |
| Google Play Developer | US$ 25 (~R$ 140) | **Uma vez só** | Android |
| Codemagic (se for essa a escolha de T0) | Grátis até um teto de minutos/mês | — | iOS |
| Certificado APNs | Incluso no Developer Program | Anual (expira junto) | iOS |
| Firebase (push Android, FCM) | Grátis no volume do CICLO | — | Android |

## 5 · Prazo, honesto sobre a variável que eu não controlo

| Fase | Tempo `[E]` | Plataforma |
|---|---|---|
| **T-DEMO (conta de demonstração)** | **Meio dia a 1 dia — prioridade 1, revisado em §0.0** | Ambas |
| T-DEL (exclusão de conta) | 1-2 dias, pode rodar em paralelo com tudo | Ambas |
| T-AND (scaffold Android) | 1 dia — pode começar já, sem Mac | Android |
| T1 + T2 (scaffold, ícone) | 1 dia de trabalho de código | Ambas (ícone é por SO) |
| T1.5 (bloquear cobrança no app) | 1-2 dias — o único risco sem garantia (§0.2/§0.6) | Ambas |
| T3 (push nativo) | 1-2 dias por plataforma (APNs ≠ FCM) | Ambas, mecanismo diferente |
| T4 (ajustes 4.2) | 1-3 dias — variável, só se confirma testando | Ambas |
| T5 (conta Apple) | 1-2 dias, aprovação da Apple pode demorar | iOS |
| T6 (TestFlight/teste real, ordem de prioridade revisada) | 1-2 dias | Ambas |
| T7 (revisão da loja) | 1-3 dias, **mais se rejeitar — e a §0.2 mostra que pode rejeitar mesmo tudo certo** | Ambas, Google costuma ser mais rápido |

**Android pode estar no ar em 1-2 semanas, sozinho** — sem depender de T0/T5 (que são só do
Eduardo e só do iOS). **iOS continua em 2 a 4 semanas.** Fazer os dois em paralelo, com o trabalho
compartilhado (T-DEMO/T-DEL/T1.5) contando uma vez só, é mais rápido que fazer em série — e resolve
a motivação original (`ciclo-apps-mobile-lojas`: credibilidade das duas lojas existindo) parcialmente
mais cedo. **Não existe número que garanta zero rejeição em nenhuma das duas** — o que dá pra
prometer é fazer os tickets que a pesquisa mostra que mais reduzem o risco (T-DEMO, T1.5, T-DEL) e
citar o precedente certo na submissão (T7). O resto é decisão de revisor humano do lado de lá.

## 6 · O que NÃO muda

1. **O site continua no ar, sem interrupção, durante todo este plano.** Nenhum ticket aqui toca
   `next.config`, rotas ou deploy da Vercel de um jeito que afete quem usa pelo navegador.
2. **Nenhum dado de saúde/RLS/multi-tenant muda de comportamento** — o app é uma casca sobre a
   mesma API, mesma autenticação, mesma regra de negócio.
3. **Não é um "app separado" para manter.** Toda tela nova no site aparece automaticamente no app
   (por causa do `server.url` apontando pra produção, T1) — o único trabalho contínuo depois do
   lançamento é revisão de certificado anual (T3/T5) e, ocasionalmente, um novo build se a Apple
   mudar requisito de SDK mínimo.
