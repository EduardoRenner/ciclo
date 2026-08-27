# 27 · Escala e conversão — a camada que falta entre o produto e o dinheiro

**2026-08-27.** Este documento responde a um pedido específico: *o que grandes produtos fazem para
converter, e o que disso cabe no CICLO*. Ele é escrito com duas lentes ao mesmo tempo — analista de
negócio (onde o dinheiro vaza) e desenvolvedor sênior (onde no código isso mora).

Convenção dos marcadores, a mesma do `18`, `20` e `25`: **[M]** medido (conferido no código ou no
banco desta sessão), **[E]** estimado, **[P]** vem de pesquisa de mercado.

Este documento **não substitui** o `18` (preço, empacotamento, PSP, unit economics) nem o `25`
(ordem de execução). Ele preenche o que os dois não cobrem: **a mecânica de conversão e o
raciocínio psicológico por trás de cada peça** — e, no caminho, discorda do `25` em um ponto de
sequenciamento, com justificativa explícita na §6.

---

## Sumário executivo — leia isto se não ler mais nada

Este documento cresceu ao longo de **nove rodadas de análise**, e boa parte do que ele contém não
estava planejado: começou como plano de conversão e virou também auditoria, porque **olhar o
produto publicado encontrou coisas que nenhum teste encontra**.

### A frase que resume tudo

> **O CICLO não tem problema de conversão. Tem problema de entrada** — zero pagantes, o motor
> desligado, nenhuma instrumentação. Instalar mecânica de conversão num funil sem tráfego
> multiplica zero. A ordem certa é construir a máquina, na sequência em que cada peça paga a
> próxima (§4).

### O que já foi corrigido nesta análise

Quatro defeitos reais, todos achados **medindo o produto publicado** — nenhum apareceria em
typecheck, lint ou na suíte de testes.

| | O que era | Onde |
|---|---|---|
| ✅ **B1** | A página do cliente dizia *"É por aqui que a confirmação chega"* — e nada chega. **A guarda passava verde**, porque proibia quatro redações e essa era a quinta. Corrigido com `core/messaging/promessa.ts`; 3 mutações vistas reprovando | §1.65, P10 |
| ✅ **N+1** | A disponibilidade fazia **3 + N** idas ao banco em série (N = profissionais), cada uma cruzando o continente. Agora são 3 | §7.2 |
| ✅ **foco apagado** | `<input type="date">` do caixa com `outline-none` e nenhum substituto — teclado sem sinal nenhum (WCAG 2.4.7). Guarda nova vista reprovando nas duas direções | §7.25 |
| ✅ **orçamento travado** | Token inválido deixava a tela em *"Carregando…"* para sempre, enquanto a API respondia 404 em 400 ms com a mensagem certa | §7.24 |
| ✅ **guarda cega** | A guarda do B1 nasceu cega: `\w` não casa `ç`/`ã`, então `/confirma\w*/` não pegava "confirmação". Só apareceu ao rodar a mutação | §1.65 |

**O padrão dos quatro é o mesmo, e é a conclusão mais útil deste documento:** cada um passava por
todos os portões automáticos do projeto. O que os encontrou foi abrir a página publicada e medir.

### As cinco decisões que dependem de você

Nenhuma é execução — cada uma é uma escolha que eu não devo fazer sozinho.

| # | Decisão | Por que é sua | Onde |
|---|---|---|---|
| 1 | **`ciclo.app`: comprar ou parar de exibir** | A interface mostra um domínio que o projeto não tem, no instante em que a pessoa escolhe o link | §1.6 A2 |
| 2 | **Título e H1 da landing** | *"avisa"* / *"traz de volta"* prometem o motor desligado — mas é ambíguo e é o posicionamento do produto, não um fato errado. Alternativas prontas | §1.66 C1 |
| 3 | **Avisar a equipe quando o cliente desmarca pelo link** | Comportamento novo (o produto passaria a notificar). Uma linha, pronta | §1.67 D1 |
| 4 | **Campo opcional de e-mail no booking** | Encadeada ao F0b: se o WhatsApp vier, é redundante; se demorar, é o caminho mais barato de conseguir confirmar um agendamento | §7.3 |
| 5 | **Moldura de dinheiro no aviso de teto** | Contraria uma posição já pensada no código (*"nada aqui usa urgência inventada"*) | P6 |

### Os achados que ninguém tinha visto

Ordenados por consequência, não por ordem de descoberta:

1. **O conserto do "dia 1" não dispara no dia 1** (§1.6 A1). `deveMostrarHeroiDoMotor` exige
   `atribuicaoCount > 0`, que num tenant novo é zero por construção. A tela que o `25` §2.2 mandou
   consertar continua sendo **R$ 0,00 + agenda vazia** para quem acabou de se cadastrar — a única
   população que a guarda exclui.
2. **O cliente desmarca pelo link e ninguém fica sabendo** (§1.67 D1) — nem a equipe, nem a fila de
   espera. A máquina inteira (`waitlist`, `notificarProximoDaLista`, tela de encaixe) está
   construída e o gatilho não está ligado.
3. **O canal disponível alcança quem menos precisa** (§7.3). O e-mail chega à base importada e
   **não chega a quem agendou pela página pública** — o formulário não coleta e-mail. E o push
   para cliente é andaime: `clients.user_id` nunca é escrito.
4. **A landing vende no terreno onde o `25` manda não competir** (§1.5 I1) e cala nas 9 profissões
   sem concorrência que o produto já atende.
5. **`trial_ends_at` existe desde a migration 0001 e nada o lê** (§1 achado 1) — o produto não tem
   período de demonstração nenhum.

### O mapa, para não ler 1.200 linhas

| Se você quer… | Vá para |
|---|---|
| o diagnóstico e os seis achados de fundo | §0, §1 |
| **o que está errado na interface, medido no ar** | §1.5 a §1.67 |
| **o que construir, com a psicologia de cada peça** | §2 (P1–P10) |
| o que **não** fazer, e por quê | §3 |
| **a ordem de execução** | §4 (E0 → E3) |
| como medir se funcionou | §5 |
| onde discordo do `25` | §6 |
| os erros deste próprio documento | §7.5 |

**Um aviso de leitura:** a numeração das seções é irregular (1.5, 1.65, 1.66…) porque elas foram
inseridas em rodadas sucessivas entre seções que já existiam. Renumerar quebraria as referências
cruzadas espalhadas pelo texto; o mapa acima resolve, e a irregularidade fica como registro
honesto de que o documento foi crescendo, não nasceu pronto.

---

## 0. O diagnóstico, em uma frase

> **O CICLO não tem problema de conversão. Tem problema de entrada.**

Zero pagantes **[M]**. Dois tenants reais, um deles é demonstração **[M]**. Nenhuma
instrumentação de funil **[M]**. As duas rotas de cron que falam com o cliente final não rodam
**[M]**.

Isso importa porque muda o que "fazer o produto converter mais" significa. Instalar contador
regressivo, prova social e programa de indicação num funil sem tráfego é **multiplicar zero**.
A ordem certa não é *otimizar a conversão* — é **construir a máquina que converte, na sequência em
que cada peça paga a próxima**, e colocar a psicologia onde ela é honesta.

O que segue é essa máquina. São seis achados, ordenados por dinheiro-por-esforço.

---

## 1. Os seis achados

### Achado 1 · `trial_ends_at` é andaime morto desde a migration 0001 **[M]**

```sql
-- supabase/migrations/0001_initial.sql:53
trial_ends_at   timestamptz,
```

A coluna existe desde o primeiro dia do projeto. **Nenhuma linha de código a lê ou escreve** —
conferido por varredura em `src/`, `tests/` e `scripts/` **[M]**. Todo tenant nasce `gratis`
(`plan_tier not null default`) e fica `gratis` para sempre.

Ou seja: **o CICLO não tem período de demonstração de espécie alguma.** Quem se cadastra hoje
nunca experimenta um único recurso pago. Ele lê na `/precos` que existe "chamar a base inteira de
uma vez" e nunca vê aquilo funcionando — precisa pagar para descobrir se resolve o problema dele.

Esse é o defeito de conversão mais caro que um SaaS de ticket baixo pode ter, e a correção mais
barata disponível neste repositório.

---

### Achado 2 · A prova de valor é calculada, exibida, e nunca **entregue** **[M]**

`receitaAtribuidaAoCiclo()` responde a pergunta que decide a assinatura:

> *"O Motor de Ciclo trouxe R$ 1.240 este mês (8 agendamentos)."*

O `25` F1 já subiu isso para a home **[M]**. Mas **ninguém é avisado**. A informação existe e
espera que a pessoa abra o app e olhe. Não há nenhum momento no mês em que o produto diga isso.

Isso desperdiça o ativo comercial mais forte do produto — o único número que responde
simultaneamente *"funciona?"* e *"vale R$ 49?"*.

---

### Achado 3 · O motor está preso atrás de credencial de terceiro há ~10 dias — e não precisava estar inteiro **[M]**

O `25` F0 bloqueia todas as outras fases, e depende do passo 2: confirmar
`WHATSAPP_PHONE_NUMBER_ID` / `ACCESS_TOKEN` / `APP_SECRET` na Meta. Isso está pendente desde
2026-08-18 **[M]** (é o mesmo TICKET-043 que trava a mensageria desde o começo).

Mas o F0 mistura **dois laços diferentes** numa fase só:

| Laço | Quem recebe | Depende de | Risco |
|---|---|---|---|
| **Lembrete / confirmação / campanha** | o **cliente final** do salão | WhatsApp (Meta) ou e-mail (Resend) | Alto — mandar mensagem para pessoa errada queima o número e a reputação do salão |
| **"3 clientes sumiram, R$ 240 parados"** | o **dono** do salão | **nada de terceiro** | Nenhum — é o próprio usuário do app |

O segundo é o **laço de retenção** que o `18` §I.2 nomeia como hábito recorrente do produto. E ele
está tecnicamente pronto: `push_subscriptions` (migration 0015/0016), provider
(`providers/messaging/push.ts`), e **VAPID é chave autogerada — não exige conta em lugar nenhum**
**[M]**.

Hoje o push só é usado como *fallback* na cadeia de mensagem para o cliente
(`enviarComFallback`) **[M]**. **Nenhum código manda push para o dono.**

> **O laço de retenção mais forte do produto está bloqueado por uma credencial que ele não usa.**

---

### Achado 4 · A indicação que existe é a errada — e a certa é melhor negócio **[M]**

O pedido foi *"aquele sistema de indicação que ganha desconto"*. Existem dois, e vale não
confundi-los:

**(a) Indicação B2B — tenant indica tenant, ganha desconto na mensalidade.**
Desenhada inteira no `18` Fase H (crédito em `billing_credits`, recompensa só no 1º pagamento do
indicado, antifraude, teto de 12 meses/ano). **Não existe em código** e está deliberadamente
travada atrás de **≥20 pagantes** **[M]**.

**Concordo com a trava e recomendo mantê-la.** Programa de indicação com zero pagantes é máquina
sem combustível: ninguém tem mensalidade para descontar, e o antifraude que ele exige (mesmo CPF,
mesmo `phone_hash`, mesmo instrumento no PSP) é trabalho real defendendo receita que não existe.

**(b) Indicação B2C — a cliente do salão indica outra cliente, as duas ganham pontos.**
Isso **já está construído e funcionando** **[M]**: `clients.referred_by` (migration 0001),
`referralBonusPoints` (config em `tenants.settings.loyalty`), e `pontuarAtendimentoConcluido()`
credita **os dois lados** automaticamente na primeira visita da indicada
(`fidelidade.ts:120-132`).

E está **invisível**. O único caminho para uma indicação acontecer é o dono lembrar de abrir
mensagens prontas e mandar o modelo `indicacao` na mão **[M]**.

Aqui está o reenquadramento que vale dinheiro:

> **O programa de indicação que faz o CICLO ganhar dinheiro não é o do CICLO — é o do salão.**

Um salão cuja base **cresce sozinha dentro do CICLO** não cancela o CICLO. É retenção, que num
produto de R$ 49 vale mais que aquisição (o `18` §F.4 mostra que uma hora de suporte já dá
prejuízo de R$ 4,43 por cliente — cliente que fica e não pergunta é o único cliente lucrativo).

E de quebra: cada link de indicação que a cliente compartilha **é uma página `/{slug}` do CICLO**,
com o selo do plano Grátis. É o laço de distribuição do `18` §G, alimentado por quem não é usuário
do produto.

---

### Achado 5 · Não existe plano anual **[M]**

`PRECO_MENSAL_CENTS` é a única tabela de preço no código **[M]**. O `18` §E.5 desenhou o anual e
ele nunca virou código.

Três razões, e a terceira é a que decide:

1. **Ancoragem de preço.** Um mensal sozinho na tela não tem com o que ser comparado. Ao lado de
   "R$ 490/ano — 2 meses grátis", o R$ 49 vira a opção *cara*. É o efeito de contraste, e é
   honesto: os dois preços são reais.
2. **Churn mecânico.** Assinante anual não decide 12 vezes se continua; decide uma.
3. **Caixa, e esta é a real.** O `18` §F.6 mediu: **cobrar tem custo fixo de R$ 194/mês antes do
   primeiro cliente** (MEI é vedado para software → ME no Simples + contabilidade) **[M]**. Com
   assinatura mensal, o negócio passa meses no vermelho esperando volume.

   > **Dez assinantes anuais pagam a contabilidade do ano inteiro no primeiro mês.**

   Num produto sem investidor, isso não é otimização de conversão — é fôlego.

---

### Achado 6 · Zero instrumentação de funil — e a solução recomendada não é comprar ferramenta **[M]**

Não existe nenhum evento de produto. Só Sentry, para erro **[M]**. O `25` F2 ticket 11 registra
isso como "decisão de ferramenta do dono" (PostHog vs. self-hosted, com implicação de custo e de
compartilhar dado de tenant com terceiro sob LGPD) e deixou em aberto.

**Recomendação: não compre ferramenta. Construa uma tabela.**

O funil inteiro deste produto cabe em ~8 eventos. O dado já está no Postgres, a RLS já funciona,
já existe `withTenant`. Uma migration de ~30 linhas (`product_events`) e uma view resolvem — sem
terceiro vendo dado de cliente de salão, sem pergunta de LGPD nova, sem mensalidade.

PostHog resolveria mais problemas do que este produto tem, cobrando por isso e abrindo uma
conversa de conformidade que hoje não existe.

---

## 1.5 · A interface, medida no ar

Esta seção foi escrita **olhando o site publicado** (`ciclo-umber.vercel.app`, 2026-08-27), não o
código. Tudo aqui é **[M]**, medido no DOM real a 375 px — o screenshot do painel não compõe
quadro nesta sessão (armadilha já registrada), então a medição é por `getBoundingClientRect` e
texto extraído, que é mais preciso de qualquer forma.

**O que está certo e não deve ser mexido:** sem overflow horizontal a 375 px; CTA principal a
492 px de 812 px (acima da dobra); alvos de toque de 48 px; `/precos` com preço na tela, sem
"fale com um consultor", e um FAQ que **admite que a cobrança automática não está no ar** — essa
honestidade é um ativo, não um bug a corrigir. O cartão Equipe já tem destaque visual, com o
raciocínio de ancoragem escrito no próprio arquivo. Nada disso precisa mudar.

Os quatro achados de superfície:

### I1 · A landing vende para o mercado errado — e o produto já atende o certo **[M]**

A landing diz, no subtítulo do herói:

> *"Para quem atende com hora marcada: barbearia, unhas, cílios, sobrancelha, depilação, estética."*

E a seção **FEITO PARA** lista 8 verticais: Barbearia · Unhas · Cílios · Sobrancelha · Depilação ·
Estética · Cabelo · Tatuagem. **Todas de beleza.**

O catálogo do produto tem **17 profissões** **[M]** (`0022` + `0026`). As 9 que a landing omite:

> Faxina e diarista · Eletricista · Encanador · Jardineiro · Personal trainer · Psicólogo ·
> Professor particular · Fotógrafo · Banho e tosa

Cruzando com o `25` §5 e §F3, isso é pior do que uma omissão:

| | Onde a landing vende | Onde a landing **não** vende |
|---|---|---|
| Concorrência | Trinks (13 anos, 44 mil negócios), Booksy, Fresha, Avec, AppBarber **[P]** | **Trinks e Booksy não estão** **[P]** |
| Preço do concorrente | R$ 39,90 – R$ 110 **[P]** | software de campo começa em **R$ 295** **[P]** |
| Recomendação do `25` | *"não competir com Trinks em beleza completa — esse terreno está perdido"* | *"a aposta mais interessante"* |

> **A landing vende exatamente no terreno onde o `25` manda não competir, e cala no terreno onde
> não há concorrência.**

Isso é maior que a higiene do `CLAUDE.md` que o `25` §6 registra. Aquilo é um documento interno
que enviesa sessões futuras; isto é a **superfície pública**, e enviesa cada visitante.

### I2 · 2.000 px de landing sem nada clicável **[M]**

A 375 px a página tem **2.820 px de altura** (~3,5 telas). Os CTAs:

| CTA | Posição |
|---|---|
| "Criar minha conta" | 492 px |
| *(nada)* | — |
| "Criar minha conta" | **2.567 px** |

São **2.075 px — cerca de 2,5 telas de rolagem — sem um único ponto de conversão**, e é
justamente o trecho que contém a seção mais forte do produto ("Quem sumiu tem nome", que explica
o Motor de Ciclo). Quem se convence ali precisa rolar até o fim ou voltar ao topo.

### I3 · O melhor laço de crescimento não é atribuível **[M]**

O selo existe e funciona: `{perfil.mostrarSelo ? <footer>Feito com <Link href="/">CICLO</Link>` —
`secoes.tsx:279`. O `18` §G o classifica como o laço de custo R$ 0 que **nem Trinks nem AppBarber
têm** **[P]**, e o §G5 pede: *"vale medir quantas visitas chegam à `/precos` vindas de um
`/[slug]/agendar`"*.

**Esse `href="/"` não tem parâmetro nenhum.** A medição que o próprio plano pede é impossível
hoje. É uma linha de código.

E um detalhe com graça: a página de exemplo linkada da landing ("Ver uma página de exemplo" →
`/dom-rocha`) é justamente a que **não** mostra o selo — `dom-rocha` está em Avançado de
cortesia **[M]**. A vitrine do laço de distribuição é a única página com o laço desligado.

### I4 · O selo fala do salão, não de quem lê **[M]**

*"Feito com CICLO"* diz o que o salão usou. Quem lê é **cliente de um salão** — e uma parte dessas
pessoas é profissional autônoma, que é exatamente o ICP. Um selo de distribuição converte quando
carrega o benefício de quem o lê, não a ferramenta de quem o exibe.

---

## 1.6 · O fluxo autenticado — do cadastro à primeira tela

Não há credencial de tenant nesta sessão, então esta seção é **leitura de código**, não navegação.
Tudo **[M]** por arquivo e linha.

**O que está certo:** o onboarding é **uma tela e três campos** (nome, profissão, endereço) — mais
enxuto que a maioria dos concorrentes. A busca de profissão usa `sinonimos` (digitar "diarista"
acha "faxina") **[M]**. O `slug` é derivado do nome automaticamente e só para de seguir se a
pessoa mexer nele. O botão de compartilhar link usa `window.location.origin`, então o link copiado
**funciona** **[M]**. Nada disso precisa mudar.

Três achados.

### A1 · O conserto do "dia 1" não dispara no dia 1 **[M]**

O `25` §2.2 diagnosticou, com print do painel real:

> *"Para o barbeiro em teste, **dia 1**, agenda ainda vazia, a primeira coisa que o produto
> comunica é R$ 0,00 e 'não tem nada aqui'."*

A F1 ticket 7 corrigiu com `deveMostrarHeroiDoMotor()`, e o teste passa. Mas a condição é
(`hoje.tsx:34`):

```ts
return revenueTodayCents === 0 && !temProximoCliente && atribuicaoCount > 0
```

`atribuicaoCount` é quantos clientes **o Motor já trouxe de volta este mês**. Num tenant recém-criado
ele é **zero, necessariamente** — não há histórico, não há ciclo calculado, não há campanha.

| Condição | Tenant novo, dia 1 |
|---|---|
| `revenueTodayCents === 0` | ✅ |
| `!temProximoCliente` | ✅ |
| `atribuicaoCount > 0` | ❌ **sempre falso** |

→ o herói do Motor **não** aparece → a tela mostra **"FATURADO HOJE · R$ 0,00"**.

E logo abaixo, `central-de-acoes.tsx:23`: `if (acoes.length === 0) return null` — sem clientes, sem
ciclos, sem estoque, a Central não renderiza nada. Sobra o `EmptyState` *"Nada mais para hoje"*.

**A primeira tela de quem acabou de se cadastrar continua sendo, exatamente:**

```
FATURADO HOJE
R$ 0,00
                          ← Central de Ações: null
[ Nada mais para hoje ]
  A agenda de hoje está livre a partir de agora.
```

O conserto está certo e resolve um caso real — o **tenant estabelecido num dia fraco**. Mas a
população que o `25` citou como motivo (*"em teste, dia 1"*) é a única que a guarda exclui por
construção. É a diferença entre *"não tenho movimento hoje"* e *"acabei de chegar"*, e as duas
telas não podem ser a mesma.

### A2 · O produto exibe um domínio que não é o dele **[M]**

| Onde | O que mostra | Realidade |
|---|---|---|
| `onboarding/formulario.tsx:140` | prefixo **`ciclo.app/`** no campo do endereço | — |
| `config/negocio/formulario.tsx:123` | campo travado com **`ciclo.app/{slug}`** | — |
| Botão "Compartilhar" (`compartilhar.tsx:21`) | `window.location.origin` | ✅ correto |
| No ar hoje | | `ciclo-umber.vercel.app` **[M]** |

`robots.ts` e `sitemap.ts` ao menos leem `NEXT_PUBLIC_APP_URL` antes de cair em `ciclo.app`; os
dois pontos de **interface** não leem nada — está cravado.

O link que a pessoa **copia** funciona. O que ela **lê** — no exato instante em que escolhe o
endereço, que é o momento de maior comprometimento do onboarding — é um domínio que o projeto não
tem. Quem digitar de memória na bio do Instagram publica um link morto.

Isso é decisão de dono antes de ser conserto de código: **ou o `ciclo.app` é comprado** (é a marca,
e o domínio já está escrito em quatro lugares como se fosse), **ou a interface passa a mostrar o
endereço real**. O que não pode continuar é o produto anunciar um endereço que não responde.

### A3 · O onboarding cria valor e não mostra **[M]**

`aplicarPacoteDaProfissao` carrega serviços, duração, preço sugerido e horário de funcionamento no
instante do cadastro **[M]**. Para a barbearia são 6 serviços reais.

A pessoa **nunca vê isso acontecer**: preenche três campos, aperta "Criar meu negócio", e
`router.push('/admin/hoje')` a joga na tela do A1 — R$ 0,00 e agenda vazia.

O produto fez trabalho de verdade e comunicou o vazio.

---

## 1.65 · A superfície de maior volume — quem agenda

Medido no ar em `/dom-rocha/agendar`, 375 px **[M]**. É a tela que mais gente vai ver do CICLO:
todo cliente de todo tenant passa por aqui, e nenhuma sessão anterior a auditou.

**O que está muito certo:** o formulário final pede **dois campos obrigatórios** (nome, telefone),
com `autocomplete="name"`/`"tel"` e `inputmode="tel"` — preenchimento automático funciona **[M]**.
Honeypot corretamente escondido (`position:absolute; left:-9999px; height:0`, `tabindex="-1"`) —
antispam sem CAPTCHA. Resumo do que se confirma acima do formulário (serviço, dia, duração,
preço). Horários agrupados em Tarde/Noite. Região `aria-live` anunciando *"18 horários livres em
quinta-feira, 27 de agosto"*. E a mensagem de dia fechado é exemplar: *"Nesse dia o atendimento não
abre. Escolha outra data no trilho acima."* — diz o problema **e** o que fazer.

Dois achados. O primeiro é o mais sério de toda esta análise.

### B1 · A página do cliente promete um canal que não existe — e a guarda passa verde **[M]**

`agendar.tsx:667`, abaixo do campo de telefone:

> **"É por aqui que a confirmação chega."**

`reminders` **não está no `schedule`** **[M]**. Nada chega. A pessoa dá o telefone acreditando que
receberá confirmação, e fica esperando.

O `CLAUDE.md` tem uma linha na tabela de armadilhas exatamente sobre isto:

> *"Prometer canal ('vai receber por WhatsApp') — só se houver rota **agendada** e credencial
> existente. **A promessa mais cara é a da página do cliente do tenant: quem fica mal é o salão,
> não o CICLO.**"*

E existe uma guarda para isso — `agendamento-publico-nao-promete-demais.test.ts`. **Ela passa.**
Rodada nesta sessão: **2/2 verde, com o defeito no ar** **[M]**.

Porque ela proíbe **quatro frases**:

| Regex da guarda | Casa com "É por aqui que a confirmação chega"? |
|---|---|
| `/confirmação por WhatsApp/i` | não |
| `/receber[áa]? (a )?confirmação/i` | não |
| `/vamos (te )?(avisar\|mandar\|enviar)/i` | não |
| `/você vai receber/i` | não |

> **A guarda enumera maneiras de dizer. O defeito é uma afirmação.** O quinto jeito de dizer passa
> direto — e passou.

Isto é a "guarda cega" que o `CLAUDE.md` dedica uma seção inteira a evitar, na sua forma mais
difícil: não está casando com algo incidental (o erro já catalogado), está casando com uma
**lista fechada de sinônimos de um conceito aberto**. Nenhuma quantidade de regex fecha isso.

**E o modo como foi achado é o ponto:** só apareceu **abrindo a página publicada**. Nenhum
typecheck, lint, teste unitário ou de integração jamais reprovaria — é o
*"mudança que a pessoa vê se verifica no navegador, não se deduz do código"* do próprio
`CLAUDE.md`, cobrado de volta.

> ✅ **CORRIGIDO em 2026-08-27** (commits `cbba771` e `2757af5`). A copy virou
> `core/messaging/promessa.ts` (P10) e a guarda passou a testar a função nos dois estados. As três
> mutações foram vistas reprovando: a string original de volta na tela, o ramo honesto voltando a
> prometer, e os dois ramos colapsados.

**Uma nota que valeu a rodada inteira.** A primeira versão da guarda nova usava
`/confirma\w*\s+(chega|vem)/i` — e **não casava com "confirmação chega"**. Em JavaScript sem a
flag `u`, `\w` é `[A-Za-z0-9_]`: **`ç` e `ã` não entram**. A asserção nasceu cega, exatamente
dentro do conserto de uma guarda cega, e só apareceu porque a mutação foi rodada: ficou verde, e
quem reprovou foi outra asserção do mesmo arquivo. Corrigido para `[^\s]*`.

Varredura no repositório inteiro depois disso: **é o único caso** **[M]**. Todos os outros `\w`
(em `lgpd-cobertura`, `rpc-existe`, `precos-tem-trava-no-servidor`, `rede-nao-derruba-tela`,
`mensagens.ts`) casam com **identificadores** — nomes de tabela, de função, de módulo, variáveis
de modelo (`{{negocio}}`, `{{servico}}`, deliberadamente sem acento). O que protege o projeto é a
sua própria regra de estilo: *"código, tabelas e colunas em inglês; UI e mensagens em português"*.
O único lugar onde prosa em português encontra regex é a guarda que varre copy — e foi lá que
mordeu.

### B2 · 29% do seletor de dias leva a lugar nenhum **[M]**

O trilho oferece **14 dias**. A Barbearia Dom Rocha fecha domingo e segunda **[M]** — são
**4 dias** no trilho. Todos **clicáveis**: `disabled: false`, sem `aria-disabled` **[M]**.

Tocar num deles dispara consulta de rede. Medido nesta sessão: **ainda carregando aos 2,6 s** e
resolvido em algum ponto até 6,6 s **[M]** — a medição foi por amostragem em dois instantes, não
por cronômetro no evento, então o número honesto é *"mais de 2,6 s"*, não "6 s".

O expediente **já está carregado** — a página de perfil do mesmo tenant lista os sete dias com
seus horários. O servidor sabe, antes de renderizar o trilho, quais datas não abrem. Está-se
cobrando uma ida à rede para informar o que já se sabia, e num público que o próprio
`error.tsx` do projeto descreve como estando "numa rede de subsolo".

Não é bug — a tela se recupera bem. É **atrito na superfície de maior volume do produto**: 29% dos
toques do seletor terminam em espera e recomeço.

*(Nota menor de acessibilidade: o honeypot está corretamente fora da ordem de tabulação, mas sem
`aria-hidden="true"` um leitor de tela ainda o encontra navegando por campos e ouve "Não preencha
este campo". Uma linha.)*

---

## 1.66 · A mesma falha estrutural na landing — o corpo foi limpo, o cabeçalho não

Depois do B1, a hipótese óbvia: as outras guardas de "não promete demais" têm a mesma forma de
lista fechada. Testada rodando **os regex reais** contra a copy real **[M]**.

**`/precos` está limpa.** Todos os itens dos cartões usam verbo honesto — *"veja quem sumiu"*,
*"Chamar de volta a base inteira"* (imperativo: quem chama é você), e o `naoInclui` do Grátis diz
explicitamente *"no grátis **você** manda um a um"*. Nenhum verbo de ação automática. Nada a
corrigir.

**A landing tem o defeito, e num lugar específico.**

| Trecho | Verbo | A guarda pega? |
|---|---|---|
| `description` (metadata) | *"**calcula**… **mostra** quem atrasou e **te dá a mensagem pronta para chamar**"* | — honesto, três verbos verdadeiros |
| Card "Quem sumiu tem nome" | *"**calcula**… **mostra** quem passou do ponto… **texto pronto** para chamar"* | — honesto |
| **`title` + `openGraph.title`** | *"a agenda que **avisa** quem parou de voltar"* | ❌ **não** |
| **`<h1>`** | *"…e **traz de volta** quem sumiu"* | ❌ **não** |

> **O corpo do texto foi limpo com rigor. O título e o H1 ficaram.** É a mesma forma do B1 — lá a
> tela de sucesso foi consertada e o rótulo do campo acima dela não.

E o motivo de escaparem é mais constrangedor que no B1. A guarda proíbe **`/avisamos/i`**. A copy
diz **"avisa"**. Não é um quinto sinônimo — é **a mesma palavra em outra conjugação**:

```
guarda:  avisamos   enviamos   mandamos        (1ª pessoa do plural)
copy:    avisa      —          —               (3ª pessoa do singular)  ← passa
```

Banir `avisamos` e permitir `avisa` é incoerente **independentemente de qual copy se escolha**.
Isso é conserto de guarda, não de posicionamento, e vale fechar de qualquer forma.

### Por que eu não reescrevi, e a diferença para o B1

O B1 eu consertei sem perguntar porque era **fato**: alguém dava o telefone e esperava uma
mensagem que nenhuma rota manda. Havia uma pessoa esperando.

Isto é diferente, em dois pontos, e vale ser honesto sobre os dois:

1. **É ambíguo.** *"avisa quem parou de voltar"* lê como *"notifica os que pararam"* (falso — nada
   notifica cliente) **ou** como *"te avisa quem parou"* (verdade — é o que o Motor faz). Num
   título ao lado de um produto cuja funcionalidade desligada é justamente notificar cliente, a
   primeira leitura é a perigosa. Mas não é inequivocamente falso.
2. **É o posicionamento do produto.** *"traz de volta"* vem da linha do próprio `CLAUDE.md`:
   *"prevê quando cada cliente volta e **traz de volta automaticamente**"*. Reescrever o H1 e o
   título é decidir como o produto se apresenta — **é decisão do dono**, não conserto de bug.

**A recomendação, com as alternativas prontas** (todas mantêm a força e nenhuma promete canal):

| Hoje | Alternativa |
|---|---|
| `title`: "a agenda que **avisa** quem parou de voltar" | "a agenda que **mostra** quem parou de voltar" |
| `<h1>`: "…e **traz de volta** quem sumiu" | "…e **te mostra** quem sumiu — com a mensagem pronta" |

E, decidida a copy, fechar a lacuna de conjugação na guarda junto — as duas coisas na mesma
mudança, porque a guarda sozinha reprovaria a copy atual.

*(Nota: o `openGraph.description` — a prévia que aparece quando o link é colado no WhatsApp — diz
"Para barbearia, unhas, cílios, sobrancelha, depilação e estética". É o I1 na peça de maior
distribuição do produto.)*

---

## 1.67 · As telas por token — e o buraco que elas revelam

Auditadas as quatro superfícies que o cliente do salão abre vindo de um link: `/confirmar/[token]`,
`/avaliar/[token]`, `/lista-espera/[token]`, `/orcamento/[token]` **[M]**.

**A copy está limpa.** Nenhuma promessa de canal, nenhum número inventado. E é copy boa: *"Confirma
seu horário?"* com *"Vou sim"* / *"Preciso desmarcar"* — linguagem de gente, não de sistema. Quem
desmarca ganha um botão *"Marcar outro horário"* que leva ao `/[slug]/agendar` — o erro não vira
beco. Os estados de erro dizem o que fazer (*"Tente de novo em instantes"*). Nada a corrigir aqui.

**Mas auditar o `/confirmar` levou a um buraco de produto, e ele não é de copy.**

### D1 · O cliente desmarca pelo link e ninguém fica sabendo **[M]**

`notificarEquipe()` existe (`mensageria.ts:151`) e é chamada em dois lugares:

| Evento | Chama `notificarEquipe`? |
|---|---|
| Cliente **agenda** pela página pública (`public-booking.ts:405`) | ✅ |
| Cliente **aprova/recusa orçamento** (`orcamentos.ts:170`) | ✅ |
| **Cliente desmarca pelo link de confirmação** (`public/appointments/cancel/[token]`) | ❌ **ninguém** |

E há um segundo efeito, pior. Quando o **profissional** cancela pelo painel
(`api/v1/appointments/[id]/route.ts:85`), o código chama `notificarProximoDaLista()` — oferece o
horário liberado a quem está na fila de espera. Quando o **cliente** cancela pelo link, não chama.

| Quem cancela | Equipe avisada | Fila de espera acionada |
|---|---|---|
| Profissional, pelo painel | (ele mesmo fez) | ✅ |
| **Cliente, pelo link** | ❌ | ❌ |

O caminho que fica sem nada é justamente **aquele para o qual o link de confirmação existe**: a
pessoa desmarcando sozinha, provavelmente fora do horário comercial — que é a razão de se mandar
um link em vez de ligar.

**O custo é dinheiro, e é o dinheiro que o produto promete defender.** Uma cadeira vazia que
alguém da fila de espera teria pago, e um profissional que só descobre o buraco ao abrir a agenda.
O CICLO tem `waitlist`, tem `notificarProximoDaLista`, tem a tela `/lista-espera/[token]` para
reivindicar o encaixe — a máquina inteira está construída e **este gatilho não está ligado**.

### O conserto se divide exatamente na linha do F0a/F0b (§6)

E a divisão importa, porque metade é segura hoje e a outra metade **não pode** ser feita agora:

| Metade | Destinatário | Depende de | Status |
|---|---|---|---|
| `notificarEquipe` no cancelamento público | **o dono** — push VAPID | nada | ✅ **seguro hoje** (F0a) |
| `notificarProximoDaLista` no cancelamento público | **o cliente da fila** — lê `phone_e164`/`email` **[M]** | WhatsApp/e-mail | 🔒 **travado** (F0b) |

Ligar a segunda metade agora começaria a mandar mensagem para cliente final sem a credencial
confirmada — exatamente o que o portão do `25` F0 existe para impedir. A primeira metade é o mesmo
`void notificarEquipe(...).catch(...)` que o agendamento público já faz três arquivos ao lado.

**Não implementei.** Ao contrário do B1 — que era uma frase falsa no ar e eu corrigi — este é um
**comportamento novo**: o produto passaria a mandar uma notificação que hoje não manda. Merece um
sim explícito, mesmo sendo push para o próprio dono. Está pronto para executar em uma linha.

---

## 1.7 · O que os grandes fazem no dia 1 — e o que disso cabe aqui

O padrão é um só, e nenhum deles mostra estado vazio no primeiro acesso:

| Produto | O que faz no dia 1 | Mecanismo |
|---|---|---|
| **Slack** | manda você trocar mensagem com o Slackbot antes de ter equipe | valor **dentro** do fluxo, não depois |
| **Stripe** | painel com dados em modo de teste já circulando | ver o produto funcionando antes de integrar |
| **Shopify** | guia de configuração com progresso persistente | progresso dotado (P7) |
| **Canva / Figma** | abre num modelo, nunca numa tela em branco | remover a página em branco |
| **Duolingo** | primeira lição **antes** de criar conta | valor antes do compromisso |

> **A regra comum: no dia 1, mostre o produto trabalhando com o que já existe — nunca o vazio.**

E o CICLO tem com o que trabalhar: o catálogo da profissão **já foi carregado** (A3). A tela do dia
1 não precisa inventar dado nem prometer nada — precisa dizer o que acabou de acontecer:

> **Seu catálogo de barbearia está pronto**
> 6 serviços, com duração e preço sugerido. Ajuste quando quiser.
> **Falta 1 passo para receber agendamento sozinho:** compartilhe seu link → `copiar`

É o P7 (progresso dotado) aterrissando no lugar exato onde o A1 deixa um buraco.

---

## 2. A camada de persuasão — o que construir, e por que funciona

Cada peça abaixo tem três partes: **o que é**, **a psicologia** (por que converte, com o mecanismo
nomeado) e **o dev** (onde no código isso mora).

---

### P1 · Teste reverso — 14 dias de Avançado, aterrissando no Grátis

**O que é.** Tenant novo nasce com o plano mais alto ligado por 14 dias. No fim, **não bate num
paywall** — ele *desce* para o Grátis, com a base intacta.

Isso é diferente das duas coisas que normalmente se chama de "teste":

| Modelo | Fim do prazo | Exige cartão | Problema |
|---|---|---|---|
| Teste tradicional (14 dias → paywall) | perde acesso | quase sempre | penhasco de churn; exige cartão, o que contradiz o "sem cartão" da `/precos` **[M]** |
| Grátis para sempre (**o estado atual**) | nada acontece | não | **nunca experimenta o pago** — é o Achado 1 |
| **Teste reverso** | desce para o Grátis | **não** | nenhum dos dois |

**A psicologia.** É **efeito de posse + aversão à perda** (Kahneman e Tversky: a dor de perder é
medida em cerca de o dobro do prazer de ganhar). A pergunta que o tenant responde no dia 14 não é

> *"vale R$ 49 ligar campanhas?"*

que é uma pergunta abstrata sobre um benefício futuro. É

> *"vale R$ 49 **não perder** as campanhas que eu usei nas últimas duas semanas?"*

São perguntas diferentes, com taxas de resposta diferentes. É o modelo do Slack, Notion, Canva,
Figma e Linear — e é o único dos três que **não tem nada de manipulativo**: ninguém é trancado
fora, e o Grátis continua exatamente o que a `/precos` promete ("Para sempre, sem cartão").

**Restrição de honestidade — e ela é séria.** O Avançado inclui `envio_em_lote`, que depende de
`campaigns`, que **não roda** (Achado 3). Dar teste de Avançado hoje é entregar um recurso
quebrado — exatamente a classe de defeito que este repositório já tem teste-guarda para
(`precos-nao-promete-demais`, `home-nao-promete-demais`).

> **O teste reverso concede o que funciona hoje.** Enquanto o F0b não estiver ligado, o teste
> concede tudo **menos** as capacidades que dependem de cron de mensagem. Quando o motor ligar,
> uma linha muda.

**O dev.**
- Migration: `tenants.trial_tier plan_tier` (a coluna `trial_ends_at` **já existe**) + backfill
  `null` para os tenants atuais.
- `src/core/billing/planos.ts`: função pura nova `planoVigente(plan, trialTier, trialEndsAt, agora)`
  — decide entre plano e teste. Pura, testável, sem I/O; é onde a regra tem que morar (regra 5 do
  `CLAUDE.md`).
- `src/server/services/planos.ts`: `contextoDePlano` passa a usar `planoVigente`.
- `src/server/services/onboarding.ts`: carimba `trial_ends_at = now() + 14 dias` na criação.
- UI: faixa persistente com dias restantes + o que se perde no dia 15 (nomeando os recursos, não
  "faça upgrade").
- **Teste-guarda:** teste puro do relógio (dia 13 → Avançado, dia 15 → Grátis, `trial_ends_at`
  nulo → plano da coluna) **visto reprovando por mutação** — o padrão da casa.

---

### P2 · O extrato mensal do Motor — push para o dono

**O que é.** Todo dia 1, cada tenant recebe um push:

> **O Motor trouxe R$ 1.240 em agosto**
> 8 agendamentos de clientes que estavam sumindo.

E um card correspondente na home durante os primeiros dias do mês.

**A psicologia.** Três mecanismos empilhados, todos honestos porque o número é medido:

1. **Reenquadramento de custo em retorno.** R$ 49 ao lado de R$ 1.240 não é uma despesa, é uma
   razão de 25×. Ninguém cancela uma razão de 25× — o cancelamento passa a exigir justificar a
   perda dos R$ 1.240, não economizar R$ 49.
2. **Ancoragem.** O primeiro número que a pessoa vê no mês passa a ser o que o produto rendeu,
   não o que ele custa.
3. **Efeito Zeigarnik / laço aberto.** "3 clientes sumiram, R$ 240 parados" é trabalho pendente
   com valor nomeado. Agenda só se abre quando há agendamento; dinheiro parado se abre sozinho —
   é literalmente o `18` §I.2.

**Por que é a peça de maior alavancagem do documento.** Ela é ao mesmo tempo o gatilho de
**retenção** (motivo semanal de abrir), de **upgrade** (o extrato do tenant no teto de 50 clientes
diz o que ele está deixando na mesa) e de **recuperação de churn** (o e-mail do `18` §I.4). Uma
peça, três funções.

**E não depende de credencial nenhuma** — VAPID é autogerado, o destinatário é o próprio usuário
logado. Sai hoje.

**O dev.**
- Rota `src/app/api/cron/motor-extrato/route.ts`, no mesmo padrão das outras (janela de hora local,
  `dentroDaJanela`, heartbeat guardado por `processados > 0`).
- Entra em `ROTAS_DE_CRON` **e** em `ROTAS_AGENDADAS` de `src/core/cron/agendadas.ts` — as guardas
  `saude-vigia-so-o-que-roda` e `cron-cobre-os-fusos` já cobram isso automaticamente.
- Reusa `receitaAtribuidaAoCiclo()` e `enviarPush`. Zero regra de negócio nova.
- Uma linha nova no `schedule` do `cron.yml` (dia 1, hora local ~9h).
- **Cuidado medido:** o `CLAUDE.md` já registra que promessa de canal só vale com rota **agendada**
  e credencial existente. Push satisfaz os dois — mas só depois que a rota estiver no `schedule`,
  não antes.

---

### P3 · O anual, com a âncora certa

**O que é.** `PRECO_ANUAL_CENTS` ao lado do mensal, a 10× o mensal (2 meses grátis):
Essencial R$ 490/ano · Equipe R$ 990 · Avançado R$ 1.790.

**A psicologia.** **Efeito de contraste + custo de troca.** Mostrar os dois lado a lado, com o
anual em destaque e a economia escrita em reais ("economize R$ 98"), não em porcentagem — em
ticket baixo, R$ 98 é mais concreto que 17%.

**O que NÃO fazer:** esconder o mensal, ou pré-selecionar o anual sem dizer. Ancoragem honesta é
mostrar as duas opções com clareza; escura é dificultar a menor.

**O dev.** `PRECO_ANUAL_CENTS` no `core/billing/planos.ts` (a mesma fonte única que já governa
`PRECO_MENSAL_CENTS`), `tenants.billing_period`, e o cartão em `lib/planos-cartoes.ts`. A guarda
`preco-em-um-lugar-so` já impede a quinta cópia aparecer.

---

### P4 · A indicação do salão, deixada de ser invisível

**O que é.** Transformar o `referred_by` que já funciona num laço automático:

1. Cada cliente ganha um link próprio: `/{slug}?ind={token}` — o mesmo HMAC de
   `token-assinado.ts`, sem coluna nova.
2. Quem agenda por esse link nasce com `referred_by` preenchido.
3. Os pontos dos dois lados já são creditados sozinhos na primeira visita **[M]**.
4. Card na home do dono: *"Suas clientes trouxeram 4 novas este mês."*
5. Botão "Pedir indicação" na ficha, mandando o link pelo `wa.me` que já existe.

**A psicologia.** **Reciprocidade** (a cliente ganha algo por indicar) e **prova social de par**
(recomendação de conhecido vale ordens de grandeza mais que anúncio — é o `18` §H.4 aplicado um
nível abaixo). Para o **dono**, o card é **progresso visível**: o produto mostrando que trabalhou
sem ele.

**Por que essa e não a B2B.** A B2B precisa de ≥20 pagantes para significar alguma coisa. Esta
funciona com **um** tenant e ataca a métrica que mais importa agora — retenção. E cada link
compartilhado carrega uma página do CICLO com o selo.

**O dev.** Sem migration (token assinado, não coluna). Serviço em `public-booking.ts` para resolver
o token no agendamento; card em `hoje.tsx`; botão na ficha. O módulo `loyalty` é do plano Equipe —
**decisão a tomar:** o *link* de indicação deveria estar no Grátis, com só os *pontos* no Equipe?
Recomendo que sim: o laço de distribuição interessa ao CICLO em todo degrau.

---

### P5 · Instrumentação: `product_events`

**O que é.** Uma tabela, oito eventos, uma view de funil:

```
conta_criada → profissao_escolhida → primeiro_cliente → primeiro_agendamento
→ pagina_publica_visitada → primeiro_agendamento_pelo_link  ← o "aha" do §I.1
→ teste_terminou → assinou
```

**Por que importa aqui e não é desvio.** Sem isto, tudo acima vira anedota. Com isto, a pergunta
*"o teste reverso converte?"* tem resposta numérica em 30 dias, e o piloto do `25` F3 gera dado em
vez de impressão.

**O dev.** Migration com RLS (`enable` + `force` + política por tenant, o padrão da casa — a
revisão de 2026-08-27 confirmou que todas as 18 tabelas novas seguem isso). Um helper
`registrarEvento(db, tenantId, tipo, meta)` que **nunca lança** (evento perdido não pode derrubar
o fluxo que ele observa — mesma regra do heartbeat). View `v_funil_ativacao` com
`security_invoker = true`.

---

### P6 · O paywall que mostra o dinheiro — ⚠️ **já existe. Eu propus o que já estava construído.**

> **Correção de 2026-08-27, na revisão deste documento.** A versão original desta seção descrevia
> esta tática como nova, chamava-a de *"a peça que só o CICLO consegue fazer"* e dizia *"por que
> ninguém copia isso"*. **Está construída, e bem.** Eu propus sem conferir — o erro exato que este
> documento acusa em outros lugares.

O que existe **[M]**: `components/ui/bloqueio-plano.tsx` recebe uma `evidencia` com
`quantidade` + `valorCents` e renderiza *"…somando R$ X"*. O comentário do próprio arquivo já
enuncia a tese inteira:

> *"o que converte, além disso, é mostrar o valor concreto do outro lado **COM O DADO DELA**.
> Sem isto vira folheto."*

E está ligado ao dado real: `recuperar.tsx:242` passa
`{ quantidade: itensSelecionados.length, valorCents: valorSelecionadoCents }` **[M]** — o valor em
risco calculado pelo Motor, para os clientes que a pessoa acabou de selecionar. Um tenant do Grátis
que tenta chamar em lote vê exatamente a peça que descrevi.

**O que sobra de proposta, e é bem menor.** O gatilho existe em **um** lugar: a tentativa de envio
em lote em `/admin/recuperar`. O aviso de **teto de clientes** (`clientes/page.tsx`, a partir de
80% do limite **[M]**) é neutro — fala de limite, não de dinheiro.

E aqui é preciso respeitar uma decisão já tomada: o comentário daquele arquivo diz
*"Nada aqui usa urgência inventada nem prazo (§5.10)"* **[M]**. A neutralidade é deliberada.

A pergunta que sobra, então, não é *"por que não fizeram isto?"* — é **"o número medido do Motor
conta como urgência inventada?"**. Eu diria que não: R$ 890 parados é fato calculado, não prazo
falso, e é a mesma evidência que o `bloqueio-plano` já usa três telas ao lado. Mas é **decisão do
dono**, não lacuna a preencher — e proposta contra uma posição pensada, não contra um esquecimento.

**A lição de método, que vale mais que a tática.** Eu cheguei a esta ideia por raciocínio de
mercado e ela estava certa — o time chegou primeiro, e escreveu a justificativa no código. Ler o
código antes de propor não é burocracia: é a diferença entre somar e repetir.

---

### P7 · Progresso dotado — a lista que já começa com dois riscos

**O que é.** Um cartão de ativação na home dos primeiros dias, com 5 passos — e os **dois
primeiros já marcados**:

```
Sua conta está pronta em 40%
  ✓ Conta criada
  ✓ Catálogo de barbearia carregado (6 serviços)
  ○ Compartilhe seu link          → copiar
  ○ Traga sua lista de clientes   → importar
  ○ Receba o primeiro agendamento pelo link
```

**A psicologia.** Isto é **progresso dotado** (*endowed progress*), e tem medição famosa: Nunes &
Drèze (2006) deram a clientes de lava-rápido dois cartões — um de 8 selos vazio e um de 10 selos
com 2 já carimbados. **Mesmo trabalho.** A conclusão saiu de 19% para **34%** **[P]**. A tarefa
não muda; o que muda é começar de zero ou começar já andando.

*(Os dois números são citados de memória da literatura, não de fonte lida nesta sessão. O efeito é
sólido e replicado; se algum dia forem para uma peça de venda, confira a fonte primeiro — é a
mesma regra de "Suposto vestido de Medido" que o `18` §2.4 aplica aos números do próprio produto.)*

No CICLO os dois riscos são **verdadeiros**: a conta foi criada e o pacote da profissão realmente
preenche serviços, duração e preço **[M]**. Não é um selo de brinde — é o produto reconhecendo
trabalho que ele mesmo fez.

Somado ao **efeito Zeigarnik** (tarefa aberta ocupa memória até fechar), o cartão vira o motivo
de voltar no dia 2 — que é exatamente onde SaaS de autônomo perde gente.

**O quinto passo é o "aha".** O `18` §I.1 nomeia: *"o primeiro agendamento que chega sozinho pela
página pública"*. Hoje nada no produto conduz até lá — espera-se que aconteça. O passo 3
("compartilhe seu link", com um toque para mandar pelo `wa.me` que já existe) transforma a espera
em ação.

**O dev.** Uma função pura em `core/` — `passosDeAtivacao(fatos) → Passo[]` — alimentada por
contagens que já existem (`services.count`, `clients.count`, primeiro `appointment` com
`source='public'`). Componente na home, sumindo sozinho quando os 5 fecham. Cada passo emite
evento em `product_events` (P5), então o funil se instrumenta sozinho.

**E é aqui que o A1 se resolve.** A guarda `deveMostrarHeroiDoMotor()` tem hoje dois estados
possíveis — herói do Motor ou "FATURADO HOJE R$ 0,00" — e o tenant novo cai sempre no segundo
(§1.6 A1). São necessários **três**:

| Estado do tenant | O que a home mostra |
|---|---|
| Tem movimento hoje | faturamento — como já é |
| Estabelecido, dia fraco (`atribuicaoCount > 0`) | herói do Motor — como a F1 já faz |
| **Recém-criado** (`atribuicaoCount === 0` **e** ativação incompleta) | **este cartão** — o catálogo pronto + o passo que falta |

A decisão continua pura e testável: `estadoDaHome(fatos) → 'faturamento' | 'motor' | 'ativacao'`,
substituindo o booleano por um veredito de três valores. O teste-guarda existente passa a cobrir a
terceira coluna — que é exatamente o caso que o `25` §2.2 descreveu e que nenhum teste pega hoje.

---

### P8 · O selo que converte, e que dá para medir

Três mudanças pequenas no `footer` de `secoes.tsx`:

1. **Atribuição:** `href="/?de={slug}"` + registro do evento. Destrava a medição que o `18` §G5
   pede e hoje é impossível (I3).
2. **Copy voltada a quem lê:** o leitor é cliente do salão, não o salão.
   *"Feito com CICLO"* → **"Sua agenda também pode ser assim — CICLO, grátis"**.
   Continua verdade: o Grátis é grátis para sempre, sem cartão.
3. **Página de exemplo com selo.** O `/dom-rocha` linkado da landing está em Avançado de cortesia
   e por isso não mostra o selo (I3). Ou a vitrine mostra o produto como a maioria vai vê-lo, ou
   ela não é vitrine.

**A psicologia.** É **prova social por contexto**: quem vê o selo acabou de ter uma experiência boa
de agendamento. A associação já está formada quando a oferta aparece — é o momento de maior
disposição, e é grátis.

---

### P9 · A landing que fala com as 17 profissões

Corrigir I1 não é trocar palavra — é decidir posicionamento. Duas saídas, e recomendo a segunda:

**(a) Listar as 17.** Barato e honesto. Mas "servimos todo mundo" é a mensagem mais fraca que uma
landing pode dar.

**(b) Herói por profissão.** A rota `/{profissao}` já teria dado de catálogo para se sustentar:
`/para/eletricista` com o herói, os serviços e o preço sugerido daquela profissão — dado que a
migration `0026` já semeou **[M]**. É a mesma landing, com o subtítulo, os exemplos e a seção
"FEITO PARA" trocados por profissão.

**A psicologia.** **Especificidade auto-referente**: *"para eletricistas"* converte mais que *"para
profissionais de serviço"* porque a pessoa se reconhece sem precisar traduzir. É o que Stripe faz
com `/use-cases`, e a Shopify com landing por segmento.

**E resolve a armadilha do SEO do `18` §G.1** — que diz que páginas `/{slug}` finas e quase
idênticas são penalizadas, e que o laço só vale com dezenas de páginas com conteúdo real. Uma
página por profissão, com catálogo e preço próprios, é conteúdo real **desde a primeira** — e não
depende de ter tenants.

**O dev.** Rota `(public)/para/[profissao]/page.tsx` lendo `professions` + `profession_services`
(as duas já populadas e com política de leitura pública **[M]**), reusando as seções da landing.
`generateStaticParams` a partir do catálogo, `sitemap.ts` incluindo as 17.

---

### P10 · Promessa de canal em um lugar só — o conserto do B1 que não é um quinto regex

**O errado.** Acrescentar `/confirmação chega/i` à lista da guarda. Fecha esta frase e deixa a
sexta aberta ("avisamos assim que confirmar", "chega no seu WhatsApp", "te retornamos por aqui"…).
O defeito não é a frase; é **prosa solta afirmando um canal**.

**O certo, e é o padrão que a casa já usa duas vezes.** `NOME_DO_PLANO` resolveu preço em cinco
lugares virando **uma** definição; `ROTAS_AGENDADAS` resolveu a lista de cron virando **uma** cópia
ancorada nas duas direções. Mesma forma aqui:

```ts
// core/messaging/promessa.ts — puro, sem I/O
export function textoDoCanalDeConfirmacao(remindersAgendada: boolean): string {
  return remindersAgendada
    ? 'É por aqui que a confirmação chega.'
    : 'Usamos para falar com você se precisar remarcar.'
}
```

O que muda:

- **A copy deixa de ser prosa** e passa a ser retorno de função. Não há onde uma sexta frase
  nascer, porque não há mais frase escrita à mão na tela.
- **A guarda deixa de caçar sinônimos** e passa a testar a função: com `false`, não promete
  chegada; com `true`, promete. Duas asserções, ambas mutáveis, ambas verificáveis por mutação —
  o critério do `CLAUDE.md`.
- **Vira reversível sozinha.** No dia em que o F0b ligar `reminders`, a frase verdadeira volta em
  todas as telas de uma vez, sem ninguém caçar string.
- **Serve as outras superfícies.** A mesma função atende a home, a `/precos` e a tela de
  confirmação — que hoje têm cada uma a sua guarda própria, com a sua própria lista de regex e o
  seu próprio quinto jeito de dizer esperando.

**E uma guarda estrutural nova, essa sim fechável:** nenhum arquivo sob `app/(public)/` pode
conter prosa que afirme chegada de mensagem **fora** dessa função. Isso é uma varredura de
`readFileSync` — o formato que este projeto já domina — e casa com o que muda quando o defeito
volta: alguém escrevendo a frase à mão de novo.

---

## 3. O que **não** fazer — e por quê

O pedido citou "o que apps e sites grandes usam para converter". Boa parte do que eles usam é
manipulação, e neste repositório ela não passaria nem no teste automatizado.

| Tática comum | Por que está fora |
|---|---|
| *"Restam 2 vagas neste horário"* | Falso. E `home-nao-promete-demais.test.ts` **já reprova prova social inventada** — proposto aqui, o build quebra. Corretamente. |
| Contador regressivo na `/precos` | O preço não sobe quando ele zera. Urgência falsa em produto de ticket baixo compra uma conversão e perde a confiança do bairro inteiro. |
| Cobrar cartão no cadastro para "reservar" o teste | Contradiz o "Para sempre, sem cartão" da `/precos` **[M]**. O teste reverso existe justamente para não precisar. |
| Cancelamento escondido | O `18` Fase K exige que cancelar custe os mesmos toques que assinar. Além de ser lei (CDC art. 49). |
| Cobrança automática no fim do teste | Não há cartão para cobrar — e o teste reverso não cria essa expectativa. |
| Anúncio pago | O `18` §13.1 já mediu: o CAC não fecha nesta categoria. |

**A linha que separa as duas coisas é simples: urgência honesta é urgência verdadeira.**
*"Seu teste acaba em 3 dias"* é verdade e é útil. *"Restam 2 vagas"* não é.

---

## 4. A ordem

Três fases. O critério de ordenação não é esforço — é **o que destrava medição, e depois o que
compõe**.

### E0 · A tarde de correções — horas, não dias

Quatro achados de superfície (§1.5) cujo conserto é copy e uma linha de código. Nenhum depende de
decisão, migration ou terceiro. Fazer isto **antes** do resto, porque é o que torna o resto
mensurável e porque cada dia com a landing errada é tráfego mal atendido.

| # | Conserto | Achado | Tamanho |
|---|---|---|---|
| 1 | Subtítulo do herói e "FEITO PARA" cobrindo as 17 profissões | I1 | copy |
| 2 | CTA no meio da landing, ao fim da seção do Motor | I2 | 1 componente |
| 3 | `href="/?de={slug}"` no selo + evento | I3 | 1 linha |
| 4 | Copy do selo voltada a quem lê; exemplo com selo visível | I3/I4 | copy + config do tenant demo |
| 5 | **Endereço real na interface** (ou comprar o `ciclo.app`) | A2 | 2 linhas — mas a **decisão é do dono** |
| 0 | ✅ ~~Tirar a promessa de confirmação da página do cliente~~ (P10) | **B1** | **feito** — `cbba771`, `2757af5` |
| 6 | Dias fechados desabilitados no trilho, sem ida à rede | B2 | o expediente já está carregado |
| 7 | **Título e H1 da landing** + fechar a conjugação na guarda | **C1** | copy — **decisão do dono** (§1.66) |
| 8 | **Avisar a equipe quando o cliente desmarca pelo link** | **D1** | 1 linha — **aguarda um sim** (§1.67) |

**O item 0 vem antes de tudo e está numerado assim de propósito.** É a única coisa em todo este
documento que está **quebrada em produção agora**, na superfície de maior volume, contra uma regra
escrita no próprio `CLAUDE.md` — e com a guarda que deveria pegá-la passando verde. Trocar a
string é trabalho de minutos; a função do P10 pode vir depois. O que não pode é continuar no ar.

O item 5 é o único de E0 que não é só execução: é escolher entre comprar o domínio da marca ou
parar de exibi-lo. Enquanto não se decide, a interface promete um endereço que não responde.

### E1 · A máquina — sem depender de decisão de ninguém

| # | Peça | Depende de | Retorno |
|---|---|---|---|
| 5 | **`product_events`** (P5) | nada | destrava medir tudo abaixo |
| 6 | **Teste reverso** (P1) | nada | maior conversão-por-esforço do documento |
| 7 | **Extrato do Motor por push** (P2) | rota nova + linha no `cron.yml` | retenção + upgrade + churn-save |
| 8 | **Progresso dotado** (P7) | item 5, para instrumentar | ativação no dia 2 |

Nenhuma toca WhatsApp, cartão de crédito ou conta em terceiro. Todas verificáveis com
`pnpm test:unit`.

### E2 · Quando houver sinal (≥1 tenant ativo de verdade)

| # | Peça | Gate |
|---|---|---|
| 9 | ~~Paywall que mostra o dinheiro~~ — **já existe** (P6). Sobra só levar a mesma moldura ao aviso de teto, e isso é decisão do dono | contra uma posição já pensada (§5.10) |
| 10 | **Landing por profissão** (P9) | nada técnico — é volume de conteúdo, vale quando houver tráfego para dividir |
| 11 | **Anual** (P3) | precisa de cobrança funcionando — `18` Fase J |
| 12 | **Indicação do salão** (P4) | 1 tenant com base real; não precisa de pagante |
| 13 | **Reativação de quem desceu** (`18` §I.4) | precisa do evento `teste_terminou` do item 5 |

**Fora da lista, de propósito:** painel de sinais de churn (`18` §I.3). Com 2 tenants é consulta
SQL, não produto — ver §7.4. E o `18` §I.3 precisa de uma correção: dos três sinais que ele dá como
calculáveis, **um é direto, um exige encanamento e um não existe**.

### E3 · Travado, e a trava está certa

| # | Peça | Gate | Fonte |
|---|---|---|---|
| 7 | **Indicação B2B com crédito** | **≥20 pagantes** | `18` Fase H, `DECISOES.md` |
| 8 | **Cobrança automática** (Mercado Pago / Pix Automático) | decisão de negócio | `18` Fase J |

---

## 5. Como saber se funcionou

Uma métrica por peça, todas calculáveis com o que a E1 constrói:

| Peça | Métrica | Alvo honesto **[E]** |
|---|---|---|
| Selo atribuível (E0.3) | visitas em `/?de=` → cadastro | **medir antes de mirar** — hoje é zero por falta de parâmetro, não por falta de laço |
| Landing multi-profissão | % dos cadastros que escolhem profissão fora de beleza | qualquer número > 0 já refuta a landing atual |
| Teste reverso | % que assina até 7 dias depois do fim | 3–5% (referência de produto sem vendedor) |
| Extrato do Motor | % de tenants que abrem o app em 48h do push | > 40% |
| Progresso dotado | % que fecha os 5 passos em 7 dias | > 34% seria repetir o resultado do lava-rápido **[P]** |
| Paywall do dinheiro | % que sobe de plano vindo dele vs. vindo da `/precos` | o vindo dele deveria ser múltiplo do outro |
| Anual | % dos assinantes que escolhem anual | 20–30% |
| Indicação do salão | clientes novos com `referred_by` / total | > 10% |
| Funil | conta criada → 1º agendamento pelo link | é o "aha" do `18` §I.1; medir antes de mirar |

**A métrica que continua sendo a única que importa** é a do `25` F3: *quantos reais o Motor trouxe,
por tenant, no mês*. Tudo acima existe para que esse número aconteça mais vezes.

---

## 6. Onde este documento discorda do `25` — e por quê

O `25` §3 diz: **F0 bloqueia todas as outras fases**, e F0 depende da credencial da Meta.

Concordo com a regra e discordo do recorte. O motivo do bloqueio é honestidade comercial: *"cobrar
antes da F0 é vender o que não está ligado"*. Isso é correto **para a promessa que fala com o
cliente final** — lembrete, confirmação, campanha.

Mas o F0 embala junto o laço que fala **com o dono**, e esse não tem a mesma dependência nem o
mesmo risco (Achado 3). Proposta:

- **F0a — voltado ao dono.** Push do extrato do Motor. Sem credencial de terceiro, sem tocar em
  telefone de cliente, risco reputacional zero. **Destravado hoje.**
- **F0b — voltado ao cliente final.** Lembrete, confirmação, campanha. **Continua travado** nos
  passos 2–4 do `25`, exatamente como está escrito.

E a restrição que amarra os dois: enquanto o F0b não ligar, **o teste reverso não concede
capacidade que dependa do F0b**. É a mesma regra da casa — não prometer canal sem rota agendada.

Com isso, a E1 inteira sai do bloqueio sem furar a regra que criou o bloqueio.

---

## 7. Riscos, ditos antes

1. **O teste reverso pode canibalizar o Grátis.** Se o Grátis já resolve, 14 dias de Avançado só
   adiam a descoberta. **Mitigação:** é justamente o que o evento `teste_terminou` + conversão
   mede. Se a conversão vier perto de zero, o problema não é o teste — é que os degraus pagos não
   resolvem dor suficiente, e isso é informação cara e boa.
2. **Push tem taxa de permissão baixa em PWA** **[E]**, sobretudo no iOS (exige o app instalado na
   tela de início). **Mitigação:** o extrato **também** é card na home; o push é o empurrão, não o
   único canal.
3. **Anual sem cobrança automática é boleto na mão.** Não construir o anual antes da Fase J.
4. **Tudo isto pressupõe tráfego que ainda não existe.** A E1 é barata de propósito: se o piloto
   do `25` F3 não trouxer ninguém, perdeu-se pouco — e a instrumentação continua valendo para a
   próxima tentativa.

---

## 7.2 · A tela mais usada do produto leva ~4,3 s para mostrar um horário

Medido no ar em `/dom-rocha/agendar`, três amostras consecutivas cada, com `cache: 'no-store'`
**[M]**:

| | 1 | 2 | 3 |
|---|---|---|---|
| HTML da página | 1290 ms | 1329 ms | 1241 ms |
| **API de disponibilidade** | **2901 ms** | **3669 ms** | **2872 ms** |

Não é cold start — as três amostras da API batem entre si. O primeiro carregamento da sessão, esse
sim frio, deu TTFB de 4196 ms e primeiro horário visível perto de **7,6 s** **[M]**.

Em regime, quem abre o link do salão espera **~1,3 s pela página e mais ~3 s pelo primeiro
horário**. Numa rede móvel de verdade — a "rede de subsolo" que o `error.tsx` do próprio projeto
cita — é pior.

### O que eu consegui medir da causa

Eu havia escrito aqui "quatro idas em série, e o passo 4 já está paralelizado corretamente".
**Estava errado, e para menos.** Ao abrir a função inteira, o `Promise.all` das três consultas
está **dentro de um laço sobre os profissionais** **[M]**:

```
1. tenantPeloSlug(svc, slug)                             ← await
2. services                                              ← await
3. professionals                                         ← await
4. for (const prof of profissionais) {                   ← await POR PROFISSIONAL
     Promise.all([business_hours, time_off, appointments])
   }
```

São **3 + N idas em série**, com N = número de profissionais. A Barbearia Dom Rocha tem **3**
**[M]** — então eram **seis** travessias em série, não quatro. É um N+1 clássico: o `Promise.all`
paraleliza dentro de cada profissional, e o laço serializa entre eles.

Os passos 2 e 3 também não dependem um do outro — os dois só precisam do `tenant` do passo 1.

**E as duas pontas estão em continentes diferentes** **[M]**:

| | Onde | Fonte |
|---|---|---|
| Banco | Supabase **sa-east-1** (São Paulo) | `DECISOES.md:30` |
| Função | Vercel **`iad1`** (Washington) — o padrão | `vercel.json` é só `{"crons": []}`, **sem `regions`** |

Cada uma das quatro idas atravessa ~7.500 km nos dois sentidos.

### O que é inferência, e precisa ser dito

**Não provei a causa daqui.** Provar exige medir de uma função em `gru1` e comparar. O que está
medido é: o tempo, o número de saltos em série, a ausência de configuração de região e a distância
entre as duas pontas. A conclusão de que a latência transcontinental responde por boa parte dos
3 s é **inferência plausível, não medição**.

### Dois consertos, e só um depende de terceiro

**(a) Região da função — uma linha, mas pode esbarrar no plano.**
`"regions": ["gru1"]` no `vercel.json` põe a função na mesma cidade do banco. **Atenção:** o projeto
está no plano **Hobby** (`DECISOES.md`), e a escolha de região para Serverless Functions é
historicamente um recurso de plano pago na Vercel — **isso precisa ser conferido antes de contar
com o conserto**. Se for restrito, é um argumento novo (e melhor que o do cron) para a conversa de
upgrade — mas o `25` §5 já decidiu não subir para Pro por causa de cron, e isso continua valendo:
US$ 20/mês são 2,4 assinantes Essencial.

**(b) ✅ FEITO — o N+1 saiu.** Commit `1e689ec`.

Duas mudanças, nenhuma altera semântica:

- `services` e `professionals` em paralelo — só dependem de `tenant`, não um do outro. **A ordem
  das checagens de erro é a de antes**, de propósito: paralelizar muda quando as consultas partem,
  nunca qual erro a pessoa vê.
- **os profissionais também em paralelo** — nada no corpo do laço era compartilhado além do
  acumulador (virou o retorno), e a lista já era ordenada por `startsAt` no fim, então a ordem de
  chegada nunca importou.

**De `3 + N` para `3` idas em série.** Para a Dom Rocha, de seis para três — metade. Para um salão
com cinco profissionais, de oito para três.

typecheck, eslint e 848 testes limpos. **Mas o "depois" ainda não foi medido**: a mudança está no
branch, e comparar exige deploy. O número acima é previsão a partir da contagem de saltos, não
medição — e é justamente a distinção que o `18` §2.4 chama de "Suposto vestido de Medido". Medir
de novo depois do merge é um passo do plano, não um detalhe.

### O padrão não é sistêmico — varri o resto e não há segundo caso

Depois de achar o N+1 em `public-booking`, varri **todos** os `for`/`forEach`/`while` com `await`
dentro em `src/server/` e `src/app/api/` **[M]**. Vinte ocorrências. Nenhuma outra vale conserto,
e as razões são boas:

| Padrão | Onde | Por que está certo |
|---|---|---|
| **Paginação** | `caixa.ts`, `ciclo.ts`, `crm.ts`, `importacao-clientes.ts` | Só se sabe se há próxima página depois que a atual volta. Sequencial é a natureza do laço, não descuido. |
| **Envio de mensagem** | `mensageria.ts`, `lembretes.ts`, `recuperar-receita.ts` | Serializar **é** a correção: há teto diário, e o dedupe lê `last_campaign_at` que o próprio laço escreve. Paralelizar criaria corrida e mandaria mensagem repetida. |
| **Escrita com efeito** | `estoque.ts`, `recorrencia.ts`, `job-queue.ts`, `lgpd.ts` | Movimento de estoque, ocorrência de série (que disputa a constraint de sobreposição), fila de jobs. Ordem é semântica. |
| **N pequeno, caminho frio** | `comanda.ts` (itens de uma comanda) | 1 a 4 itens, uma vez por atendimento, e é caminho de dinheiro. Risco maior que o ganho. |
| ✅ **já paralelizado** | `alertas-estoque.ts` | `Promise.all(duvidosos.map(...))`, com comentário raciocinando exatamente sobre isto: *"Esta tela roda a cada carregamento de 'Hoje': N consultas por padrão seria caro à toa."* |

O último é o mais interessante: **alguém já teve essa preocupação nesta base, no lugar certo, e
escreveu o porquê**. O caso do `public-booking` não era ignorância do padrão — era um lugar onde
ele escapou.

**Por que isto importa mais do que parece.** Esta é a superfície que o laço de crescimento produz:
todo cliente de todo tenant passa por ela, e é a primeira impressão que alguém tem do CICLO sem
saber que é o CICLO. Uma página de agendamento que demora 4 s para mostrar um horário é a
diferença entre "que prático" e "trava".

---

## 7.24 · Token inválido deixava o orçamento carregando para sempre

A auditoria das telas por token (§1.67) cobriu a copy e **não cobriu a expiração**. Cobrindo agora,
com token inválido de propósito **[M]**:

| Tela | O que a API responde | O que a pessoa vê |
|---|---|---|
| `/avaliar/{token}` | 404, *"Esse link de avaliação não é mais válido."* | ✅ *"Não consegui abrir"* + a mensagem |
| **`/orcamento/{token}`** | **404 em ~400 ms**, *"Link inválido ou expirado."* | ❌ ***"Carregando orçamento…"* por mais de 15 s** — sem mensagem, sem ação, sem saída |

> **O servidor fazia tudo certo — mensagem boa, resposta rápida — e o cliente engolia.**

E o defeito é de uma linha, de ordem:

```ts
if (estado === 'carregando' || !dados) { …carregando… }   // ← vinha primeiro
if (estado === 'erro')                 { …erro…       }   // ← inalcançável
```

O `|| !dados` estava lá para o **TypeScript** estreitar o tipo no resto da função. E **erro é
exatamente o caso em que `dados` é `null`** — então o guard do typechecker decidia o que a pessoa
vê, e decidia errado. Typecheck feliz, testes verdes, pessoa esperando para sempre. O irmão
`/avaliar` nunca teve o `|| !dados`, e por isso sempre funcionou.

> ✅ **CORRIGIDO** (commit `a74d45f`). A decisão virou `telaDoOrcamento()`, pura e testada — mesmo
> padrão de `deveMostrarHeroiDoMotor`, porque o projeto não tem harness de render de componente.

**A classe é de um caso só.** Depois do conserto, varri `src/` inteiro atrás do mesmo padrão em
duas formas — ramo de render com `|| !algo` antes do ramo de erro, e a variante sem `||` **[M]**.
Único acerto: `avaliar.tsx:25`, que é **falso positivo** (está dentro do `fetch`, definindo o
estado de erro — o padrão correto). Nenhum segundo caso.

**E os estados "já usado" — o outro buraco da §1.67 — estão todos certos** **[M]**:

| Situação | O que acontece |
|---|---|
| `/confirmar` clicado duas vezes | a rota devolve **sucesso** com o status atual, não erro. Comentada: *"Clicar duas vezes no link não pode parecer quebrado"* |
| `/lista-espera` já reivindicado | ramo de erro mostra a mensagem do servidor (*"Esse encaixe já foi usado."*) |
| `/orcamento` já aprovado/recusado | ramos próprios, alcançáveis |

**Duas notas de método, e as duas são sobre erro meu.**

1. **Reintroduzi o bug dentro do próprio conserto.** Na primeira tentativa mantive a ordem e só
   troquei a condição por `tela === 'carregando' || !dados` — que engole o erro pelo mesmíssimo
   caminho. Só não foi commitado porque reli antes.
2. **A primeira mutação não aplicou, e o teste passou verde.** Se eu tivesse lido aquele verde como
   prova, teria concluído que a guarda funcionava sem nunca tê-la visto reprovar — o passo 3 do
   procedimento do `CLAUDE.md` existe exatamente para isso, e cobrou. Refeita, a guarda reprova
   nomeando *"o defeito exato que estava no ar"*.

---

## 7.25 · Acessibilidade medida no renderizado — e um anel de foco apagado

O projeto tem `tests/unit/design/contraste.test.ts`, que recalcula o contraste **dos tokens** a
partir do `globals.css`. É bom e não prova o que a pessoa vê: token certo com composição errada
(texto claro sobre superfície clara aninhada) passaria. É a classe "verde não é prova" do
`CLAUDE.md`. Então medi o DOM renderizado.

**Contraste: aprovado, sem ressalva.** 53 elementos de texto visíveis em `/dom-rocha/agendar` a
375 px, cada um comparado com o **fundo real herdado** (subindo a árvore até achar cor opaca), com
o limiar certo por tamanho e peso (3:1 para texto grande, 4,5:1 para o resto): **zero reprovados**
**[M]**. O trabalho de tokens se sustenta na composição.

**Uma medição minha que era falsa, e eu descartei.** Primeiro medi foco chamando `.focus()` em
cada elemento focável: 38 de 38 "sem anel". **Falso positivo** — o projeto usa `:focus-visible`
(globals.css:308), que por definição **não** casa com foco programático. Descartada. Tentei refazer
com `Tab` de verdade e o teclado não alcança o painel nesta sessão, então **a renderização do anel
continua não verificada** — fica registrado como não medido, não como aprovado.

**O que a leitura do código achou, e é real:**

`admin/caixa/seletor-de-dia.tsx` tinha um `<input type="date">` com `outline-none` **e nenhum
substituto** **[M]**. A borda visível ali é do `<label>` em volta, que não reage ao foco do input —
então quem chegava por teclado não via sinal nenhum. WCAG 2.4.7.

A ironia está no próprio arquivo: o comentário três linhas acima elogia o campo nativo porque
*"já vem acessível e traduzido"* — e a classe seguinte remove exatamente a acessibilidade elogiada.
É o reflexo mais comum de front-end: apagar o outline feio do navegador sem pôr nada no lugar.

> ✅ **CORRIGIDO** (commit `0ab9cc9`), no padrão que a casa já usa: `components/ui/input.tsx`
> mantém o anel global e só acrescenta cor de borda, com comentário dizendo isso.

**E virou guarda**, porque a próxima pessoa vai ter o mesmo reflexo: varre todo `className` com
`outline-none` e exige um indicador de foco no mesmo `className`. **Não proíbe apagar — proíbe
apagar sem repor.** Vista reprovando nas duas direções:

1. devolvendo o defeito exato no seletor de dia → vermelho, nomeando arquivo e classe;
2. tirando o `focus:border-acc-2` do `assistente-flutuante` (o caso **legítimo**, que apaga e
   repõe) → vermelho. Isso prova que a guarda distingue os dois, em vez de só detectar a string.

---

## 7.3 · O fallback de mensagem alcança a metade errada da base

`enviarComFallback` tenta três canais em ordem: **WhatsApp → push → e-mail** **[M]**. O código é
bom — nada falha em silêncio: sem e-mail ele lança *"Cliente sem e-mail cadastrado — nenhum canal
de fallback disponível"* e grava em `messages` a linha `failed` com os três erros concatenados.
Não é ramo morto silencioso, que era a hipótese. É outra coisa.

**O push para o cliente nunca dispara, para ninguém** **[M]**. `inscricoesPushDoCliente` resolve
`clients.user_id` antes de consultar `push_subscriptions` — indireção correta. Só que **nada no
projeto inteiro escreve `clients.user_id`**. O comentário da coluna na 0001 diz o porquê: *"se
criou conta no app da cliente"* — um app de cliente que não existe, e que o FAQ da landing promete
que não vai existir (*"Quem vai marcar precisa baixar app ou criar conta? Não."*). É andaime,
como o `trial_ends_at`.

**E o e-mail só alcança quem não veio pela página pública** **[M]**:

| Como o cliente entrou na base | WhatsApp | Push | E-mail | Alcançável hoje? |
|---|---|---|---|---|
| Importado por CSV com e-mail | ❌ sem credencial | ❌ | ✅ | **sim** |
| Cadastrado à mão com e-mail | ❌ | ❌ | ✅ | **sim** |
| Cadastrado à mão sem e-mail | ❌ | ❌ | ❌ | não |
| **Agendou pela página pública** | ❌ | ❌ | ❌ **o formulário não coleta e-mail** | **não, por construção** |

`EsquemaBookingPublico` tem `name`, `phone`, `address`, honeypot — **nenhum campo de e-mail**
**[M]**. `EsquemaCliente` (cadastro manual) e a importação de CSV têm **[M]**.

### Por que isso muda a conversa do F0

O `25` F0, passo 2, justifica a cautela assim:

> *"Sem elas [as credenciais do WhatsApp] o provider cai no fallback de e-mail — que **também é
> envio real**."*

Verdadeiro, e **mais estreito do que parece**. Cruzando com a tabela acima, ligar `reminders` sem
WhatsApp entregaria mensagem exatamente para a metade errada:

- **Quem receberia:** a base importada/cadastrada à mão — justamente onde mora o risco que o passo 1
  do F0 existe para medir (telefone/e-mail de gente real vs. semente), e quem o salão já tem outro
  jeito de contatar.
- **Quem não receberia nada:** quem **acabou de agendar pela página pública** — que é quem mais
  espera retorno, porque acabou de digitar o próprio telefone num formulário, e é a população que
  o laço de crescimento do produto gera.

> O canal disponível hoje alcança quem menos precisa dele e não alcança quem mais precisa.

**A consequência prática para o B1.** A frase que corrigi (*"É por aqui que quem vai te atender
fala com você"*) não era só a mais honesta disponível — para quem agenda pela página pública, é a
**única** verdade possível: nenhum canal automático alcança essa pessoa, e quem vai falar com ela é
mesmo uma pessoa.

### O conserto barato, e o seu custo

**Um campo opcional de e-mail no formulário público.** Daria ao fallback de e-mail uma população
real e tornaria `reminders` entregável a quem agenda online **antes** de o WhatsApp existir.

Mas o formulário tem hoje **dois campos obrigatórios** e isso é uma força medida (§1.65). Todo
campo novo cobra conversão, mesmo opcional. Então:

- **Não decidir isoladamente.** Se o WhatsApp vier (F0b), o e-mail vira redundante para este uso.
- **Se a decisão do F0b demorar**, o campo opcional é o caminho mais barato de tornar o produto
  capaz de confirmar um agendamento — e o passo que permitiria a frase verdadeira do B1 voltar a
  ser a promessa forte.

É **decisão do dono**, encadeada à do F0b — não lacuna a preencher.

---

## 7.4 · Retenção — e um `[M]` do `18` que é 1 de 3

O `18` §I.3, sobre sinais de churn, afirma:

> *"Queda de agendamentos criados/semana · sem login há 14 dias · página pública sem visita há 30
> dias. Todos calculáveis com timestamps que **já existem** **[M]** — **não exigem instrumentação
> nova**."*

Conferido contra o schema **[M]**:

| Sinal | Calculável hoje? | Onde mora |
|---|---|---|
| Queda de agendamentos criados/semana | ✅ **sim, direto** | `appointments.created_at` (0001), com RLS e índice |
| Sem login há 14 dias | ⚠️ **sim, com encanamento** | `auth.users.last_sign_in_at` — existe, mas **fora do schema `public`** |
| Página pública sem visita há 30 dias | ❌ **não** | não existe nada |

**O segundo merece precisão, porque quase escrevi que era impossível.** O Supabase Auth mantém
`last_sign_in_at`, e o `service_role` que `withNovoTenant` já entrega alcança via
`auth.admin.listUsers()`. Não precisa de migration nem de coluna nova. Mas também não é "só
consultar": está fora do `public`, então **não dá para juntar com dado de tenant em SQL** — a
listagem é paginada, vem de todos os usuários, e precisa ser cruzada com `memberships` no código
para virar "este tenant não entra há N dias". Nada disso existe hoje (**zero** uso de `auth.admin`
no projeto **[M]**). É viável e é trabalho.

**O terceiro é simplesmente falso.** Não há nenhuma contagem de visita de página pública — foi o
achado da rodada 1 (o P5 existe justamente porque não há instrumentação nenhuma). E é exatamente
neste que a frase *"não exigem instrumentação nova"* erra: ele exige, e é o P5 inteiro.

> Placar honesto: **um direto, um com encanamento, um que não existe.** A frase do `18` §I.3
> deveria dizer "um dos três", não "todos".

### E eles não pertencem ao P2 — a premissa estava errada, inclusive a minha

Eu tinha anotado "desenhar como os sinais de churn entram no extrato do Motor (P2)". Ao olhar,
não entram, e o motivo é de público:

- **P2 é do tenant para o tenant** — "o Motor te trouxe R$ 1.240".
- **Sinal de churn é da plataforma sobre o tenant** — "o salão X não entra há 14 dias". Quem lê é
  o Eduardo, não o dono do salão.

São superfícies diferentes com destinatários diferentes. Enfiar um no outro faria o produto avisar
o cliente de que ele está prestes a cancelar.

**E, com 2 tenants reais, a resposta honesta é que isto não é feature.** É uma consulta SQL que se
roda quando quiser. Construir painel de churn para dois tenants é a mesma "máquina sem combustível"
que trava a indicação B2B em ≥20 pagantes (`18` Fase H) — e este documento perderia a autoridade
de dizer aquilo se recomendasse isto.

**O que já existe do lado do tenant, e é o que importa agora:** a Central de Ações já mostra
*"N clientes estão sumindo"* com o valor e o caminho **[M]**. O sinal de desaceleração do negócio,
para o dono, já tem superfície — e ela vem com alavanca, que é a diferença entre informar e
desanimar. Dizer a um profissional "seu movimento caiu" sem dar o que fazer é cobrança; dizer
"12 clientes estão atrasados, R$ 890" é o produto trabalhando.

---

## 7.5 · Auditoria deste documento

Revisado como um todo em 2026-08-27, procurando o que ele mesmo acusa nos outros: contradição
interna, tática proposta sem conferir o código, e `[M]` afirmado sem medição.

**Um achado grave, corrigido:** o **P6** descrevia como nova uma peça **já construída e ligada ao
dado real** (`bloqueio-plano.tsx` + `recuperar.tsx:242`), e ainda a chamava de "a peça que só o
CICLO consegue fazer". Reescrito com a correção em cima, sem apagar o erro — porque o erro é o
argumento: **é exatamente o que acontece quando se propõe antes de ler.**

**Uma imprecisão, corrigida:** o "~6 segundos" do B2 era amostragem em dois instantes, não
cronômetro. Trocado por "mais de 2,6 s", que é o que de fato se mediu.

**Duas atenuações:** os números do estudo de progresso dotado (P7) passaram a declarar que são
citados de memória; o `[M]` de "`dom-rocha` em Avançado de cortesia" foi conferido contra
`DECISOES.md:2513` — estava certo, mas eu o havia escrito de memória.

**O que resistiu:** os demais `[M]` foram medidos nesta sessão (código lido linha a linha ou DOM
medido no ar) e nenhuma contradição interna apareceu entre as seções. A divisão F0a/F0b do §6 se
sustentou sozinha quando o D1 (§1.67) caiu exatamente em cima dela duas rodadas depois — o que é
um bom sinal de que a distinção é real, e não uma conveniência escrita para justificar a §6.

---

## 7.6 · Quando parar — e por que o próximo passo não é meu

Dezesseis rodadas de análise. Vale dizer honestamente o que ainda rende e o que já não rende.

### O que os consertos ainda NÃO fizeram

**Nada disto está em produção.** Conferido nesta sessão: `/orcamento/{token-inválido}` continua
travado em *"Carregando orçamento…"* no site publicado **[M]**. Os quatro consertos vivem no branch
`manutencao-noturna` e esperam revisão e merge.

Isso inverte a prioridade: **mesclar vale mais que continuar procurando.** Um bug corrigido num
branch não consertou nada para ninguém.

### O ritmo caiu, e o número diz

| Rodadas | Achados reais |
|---|---|
| 1–5 (interface, fluxo, agendamento, landing) | 4 defeitos + 4 gaps de conversão |
| 6–12 (token, retenção, mensageria, performance) | 3 defeitos |
| 13–16 (N+1 em outros lugares, a11y semântica, classe do orçamento) | **1 defeito, 3 varreduras limpas** |

As varreduras limpas **não são desperdício** — "procurei e não há" é resultado, e foi o que
permitiu dizer que o N+1 não é sistêmico e que a classe do orçamento é caso único. Mas o custo por
achado subiu, e isso é o sinal normal de que a veia está se esgotando.

### O que ainda valeria investigar

| Alvo | Por que vale | Por que não fiz |
|---|---|---|
| **Admin a 375 px** (`hoje`, `agenda`, `clientes`) | são as telas mais usadas pelo dono e nunca foram medidas nesta análise | exige sessão de tenant, que não tenho; só daria leitura de fonte, e o método que achou tudo foi **medir** |
| **Medir de novo depois do merge** | o ganho do N+1 é previsão, não medição (§7.2) | depende do deploy |
| **Instrumentar o funil** (P5) | sem isso, tudo na §2 é hipótese sem placar | é construção, não análise |

### O que virou rendimento decrescente

Continuar varrendo o código atrás de mais defeitos da mesma família. As três últimas varreduras
foram limpas, e o padrão dos quatro achados diz por quê: **eles não estavam no código — estavam na
diferença entre o código e o que a pessoa vê.** Sem sessão de tenant e sem tráfego real, as
superfícies que sobram para medir acabaram.

### A recomendação

1. **Revisar e mesclar o branch** — quatro defeitos esperando, um deles no ar agora.
2. **Responder as cinco decisões** (§Sumário). Duas delas — `ciclo.app` e o título da landing —
   sangram a cada dia que passa e custam minutos para decidir.
3. **Depois, medir de novo** o que o merge mudou, e só então decidir se vale outra rodada.

Análise a mais, agora, rende menos que qualquer uma dessas três.

---

## 8. Higiene — e ela é maior do que o `25` §6 estimou

O `25` §6 registra que o `CLAUDE.md` ainda abre com *"profissionais da beleza"*, enquanto a virada
multi-profissão já aconteceu no código. Está certo, e a medição desta sessão mostra que o problema
não parou no documento interno:

| Onde | O que diz | Alcance |
|---|---|---|
| `CLAUDE.md` | "profissionais da beleza (barbearia, unhas, cílios…)" | enviesa toda sessão de desenvolvimento |
| **Landing publicada** | "barbearia, unhas, cílios, sobrancelha, depilação, estética" + 8 verticais em FEITO PARA **[M]** | **enviesa todo visitante** |
| Catálogo do produto | **17 profissões**, 9 delas fora de beleza **[M]** | é o que o código realmente faz |

São três descrições do mesmo produto, e a única correta é a terceira. O `CLAUDE.md` custa
retrabalho interno; a landing custa mercado — é o E0.1, e é a correção de maior alcance por
caractere digitado deste documento inteiro.
