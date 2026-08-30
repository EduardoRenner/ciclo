# 30 · INDICAÇÃO — PESQUISA E PLANO

Pedido: *"uma funcionalidade de indicação, a pessoa que indica ganha e a que recebeu também;
pesquisa o que é eficiente pra vender e escalar; deixa mais visual; e gera mais necessidade de
upgrade de plano"*. Este documento é **pesquisa e desenho**. Nenhuma linha de código foi escrita.

---

## 1 · A resposta curta

Você perguntou se o CICLO já tem algo assim. Tem — e a resposta é mais estranha que sim ou não:

| Peça | Estado |
|---|---|
| Coluna `clients.referred_by` | existe desde a migration 0001, com índice próprio (0021) |
| Recompensa **para os dois lados** | existe e está escrita em `fidelidade.ts:120-132` |
| Configuração "Bônus por indicação" | existe na tela, com valor padrão de 20 pontos |
| "Veio por indicação de" na ficha | existe |
| "Quem esta cliente indicou" no CRM | existe |
| **Alguém que ESCREVA `referred_by`** | **não existe** |

O programa de indicação do CICLO está construído inteiro e **desligado da tomada**. Nenhum caminho
do produto — nem o cadastro manual, nem o agendamento público, nem a importação de CSV — grava
`referred_by`. `EsquemaCliente` não tem o campo. Logo `cliente?.referred_by` é sempre `null`, e a
linha que credita os dois lados nunca roda.

O único lugar do repositório que grava aquela coluna é `scripts/seed-demo-barbearia.mjs`. **Na
demonstração o recurso funciona; em todo tenant de verdade, não.** É por isso que ninguém percebeu,
e é por isso que o `docs/27` §Achado 4 escreveu *"já está construído e funcionando"* — a frase foi
conferida contra o tenant `dom-rocha`, que é semeado.

Isto é o **quarto** caso da mesma classe nesta base, depois de `fee_cents` (quadro "Taxa" sempre
zerado), `media.consent_id` (portfólio que nunca lista nada) e `tenants.plan` (trava de plano sem
escritor): **coluna lida por todo mundo e escrita por ninguém.** Entra na auditoria como achado
H1, com guarda de mão dupla na mesma forma das outras três.

**O que este plano faz**, então, não é "criar indicação". É três coisas:

1. **ligar** o que existe (um escritor para `referred_by`, e ele é um link assinado, sem migration);
2. **pedir** no momento certo, com a moldura certa — e é aqui que a pesquisa muda o desenho;
3. **usar o laço como motor de upgrade**, que é a parte que hoje não existe em lugar nenhum.

---

## 2 · A pesquisa, e as cinco coisas que ela muda no desenho

### 2.1 · O buraco entre querer e fazer: 83% contra 29%

**83% dos clientes satisfeitos dizem que indicariam. 29% indicam.** Esse número define o problema:
não falta vontade, falta remover atrito e medo. Programa de indicação que só cria um prêmio está
resolvendo a metade que já estava resolvida.

### 2.2 · A descoberta que decide tudo: o incentivo pode ATRAPALHAR

A pesquisa sobre por que a indicação não acontece encontra um mecanismo específico, e ele é
contraintuitivo:

> Quem indica enxerga a indicação incentivada como uma **atividade de troca**, e isso é incompatível
> com o vínculo **comunal** que ela tem com a amiga. O resultado é desconforto, conflito e culpa.

Ou seja: *"Indique e ganhe R$ 20"* diz para a cliente que ela vai **vender a amiga por R$ 20**.
Muita gente prefere não indicar a se sentir assim. O prêmio, mal enquadrado, **é** a barreira.

O antídoto está na mesma literatura: quem indica pesa **risco social** contra **capital social** —
indicar é botar a própria reputação como fiadora. Quando o que ela entrega é um **presente**, os
dois pratos viram a favor: o risco cai (ela está dando, não vendendo) e o capital sobe (ela é a
amiga que conseguiu o mimo).

**O que muda no CICLO:** a mecânica de premiar os dois lados já está certa. O que precisa de
desenho é a **frase** — e isso não é enfeite, é o mecanismo.

| Não | Sim |
|---|---|
| "Indique e ganhe 20 pontos" | "Dê R$ 20 de desconto pra uma amiga" |
| o prêmio de quem indica no título | o presente de quem recebe no título; o seu embaixo e menor |
| "seu código de indicação" | "seu convite" |

### 2.3 · Qual lado premiar, e o costume brasileiro que puxa para o lado errado

Experimentos de campo mostram que **premiar só quem recebe funciona tão bem quanto premiar só quem
indica** — o prêmio de quem recebe gera o sinal de confiança, o de quem indica amplifica a
motivação, e juntos batem qualquer programa de um lado só. A maioria dos programas usa valores
**iguais** ("dá 10, ganha 10").

O costume do mercado de beleza brasileiro puxa para o outro lado: a estrutura que se vê é **50
pontos para quem indica e 30 para quem chega**.

**Recomendo valores iguais**, contra o costume, exatamente por causa do §2.2: dar mais a quem indica
reforça a leitura de "comissão de venda", que é o que trava. Igual reforça "presente".

### 2.4 · O argumento que vende o CICLO para o dono do salão

Isto é medido, e é o que o produto deve mostrar:

- **Cliente indicado vale pelo menos 16% mais** que um cliente equivalente vindo por outro caminho
  (~10 mil clientes de um banco alemão acompanhados por quase três anos). E o diferencial tem duas
  partes: a margem é maior e **cai** com o tempo; a retenção é maior e **não cai** — persiste.
- Dois mecanismos explicam: **encaixe melhor** (quem indica conhece o serviço e a pessoa, e faz uma
  triagem que anúncio nenhum faz) e **enriquecimento social** (a nova cliente já chega ligada a
  alguém de dentro).
- No setor de beleza brasileiro, **68% dos clientes novos chegam por indicação**; programas de
  fidelidade bem estruturados sobem o retorno em até 30% e o ticket médio em 15%.

**O que muda no CICLO:** o card do dono não pode dizer só *"4 clientes vieram por indicação"*. Tem
que dizer o que aquilo significa — **quem vem por indicação volta mais**. É o que transforma número
bonito em motivo de usar.

### 2.5 · Quando pedir: o pico, não o calendário

Pede-se **logo depois de um pico positivo**. O efeito pico-fim diz que a memória de uma experiência
é dominada pelo ponto mais intenso e pelo fim, não pela média — e pedir horas depois de um bom
atendimento supera consistentemente pedir semanas depois. O gatilho clássico é a nota 9 ou 10 numa
pesquisa de recomendação.

**O que muda no CICLO, e é o achado mais barato deste documento:** o produto **já tem** a tela de
avaliação por token assinado (`/(public)/avaliar/[token]`), que já termina em "Obrigado pela
avaliação!". Uma cliente que acabou de dar **5 estrelas** é, literalmente, a promotora no instante
de pico. O convite cabe naquela tela sem construir fluxo nenhum.

### 2.6 · O que faz escalar, segundo quem escalou

Dropbox cresceu 3.900% em 15 meses com indicação de dois lados — o programa passou a responder por
**35% dos cadastros diários** e subiu o cadastro em 60% de forma permanente. PayPal pagou US$ 20 por
lado e cresceu 7-10% ao dia. Airbnb triplicou reservas diárias.

Duas lições úteis aqui:

1. **A recompensa que funciona é "mais do que a pessoa já valoriza no produto"** — o Dropbox deu
   espaço, não dinheiro. No salão, o que a cliente valoriza é **atendimento**: desconto no próximo
   horário, ou um serviço curto de brinde, valem mais que "pontos".
2. **O programa não fabricou boca a boca — capturou o que já existia.** Com 68% dos clientes novos
   do setor já vindo por indicação, o CICLO não precisa criar o comportamento: precisa **medir e
   recompensar** o que a cliente já faz de graça.

E o mecanismo visual com melhor retorno documentado é a **barra de progresso**: tarefa quase
terminada é o gatilho mais forte que existe para completar.

---

## 3 · Dois laços diferentes, e não confundir

O pedido "sistema de indicação" cabe em dois desenhos, e eles têm donos, prazos e riscos
diferentes:

| | **B2C — a cliente indica** | **B2B — o salão indica** |
|---|---|---|
| Quem indica | a cliente do salão | o dono do salão |
| Quem ganha | as duas clientes | os dois donos |
| Quem paga o prêmio | **o salão** | **o CICLO** |
| Cresce a base de | o salão | o CICLO |
| Fraude custa dinheiro de | ninguém (é desconto do próprio salão) | **do CICLO** |
| Existe hoje | mecânica sim, escritor não | nada |
| Pré-requisito | nenhum | **≥ 20 pagantes** (`docs/18` Fase H) |

**Este plano é o B2C.** O B2B está desenhado inteiro no `docs/18` Fase H (crédito em centavos,
recompensa só no 1º pagamento do indicado, antifraude por CPF/telefone/instrumento de pagamento,
teto de 12 meses por ano) e está travado atrás de 20 pagantes **de propósito**. Programa de
indicação com zero pagantes é máquina sem combustível: ninguém tem mensalidade para descontar, e o
antifraude que ele exige é trabalho de verdade defendendo receita que não existe. **Recomendo
manter a trava.**

E o reenquadramento que faz o B2C valer mais para você agora:

> **O programa de indicação que faz o CICLO ganhar dinheiro não é o do CICLO — é o do salão.**

Salão cuja base cresce sozinha **dentro** do CICLO não cancela o CICLO. É retenção, e num produto de
R$ 49 retenção vale mais que aquisição. De quebra, cada convite compartilhado é uma página
`/{slug}` do CICLO circulando no WhatsApp de quem nem é usuário — com o selo do plano Grátis.

---

## 4 · O desenho

### 4.1 · O convite é um link assinado, e não tem migration

Cada cliente ganha `/{slug}/agendar?ind=<token>`, com o mesmo HMAC de `token-assinado.ts` que já assina
confirmação, avaliação, lista de espera e orçamento. Escopo próprio (`indicacao`), validade longa
(180 dias, como o orçamento), e o `id` do lado de dentro é o `client_id` de quem indicou.

Sem coluna nova, sem tabela nova. E o escopo na assinatura garante que um token de avaliação não
vire um token de indicação.

### 4.2 · O que acontece quando alguém agenda pelo link

1. `agendarPelaPaginaPublica` recebe o `ind`, verifica a assinatura e resolve o `client_id`.
2. Se a pessoa é **cliente nova** naquele tenant (o `phone_hash` não bate com ninguém), ela nasce
   com `referred_by` preenchido. **É o escritor que faltava.**
3. Se já é cliente, o token é ignorado em silêncio — indicação é para trazer gente nova, e
   `visits_count === 0` já é a trava que `fidelidade.ts` usa.
4. Na **primeira visita concluída** dela, `pontuarAtendimentoConcluido` credita os dois lados. Esse
   código já existe e está certo: premiar no cadastro seria convite para fraude; premiar no
   atendimento concluído custa o tempo de uma cadeira.

### 4.3 · A moldura de presente, escrita

O que a cliente compartilha no WhatsApp (modelo pronto, editável — o `mensagens-prontas.ts` já tem
o slot `indicacao`, hoje com um texto que fala de desconto para os dois sem entregar o link):

> *"Oi! Adoro me atender no {salão}. Te dei R$ 20 de desconto no seu primeiro horário — é só
> agendar por aqui: {link}"*

O que a amiga vê ao abrir o link, no topo da página de agendamento:

> **A Ana te deu R$ 20 de desconto no primeiro horário aqui.**
> *(discreto, um Card com a cor de destaque — não um banner)*

O que a cliente que indicou vê depois, na mensagem de agradecimento do salão:

> *"A Paula veio pelo seu convite. Seus R$ 20 já estão aqui pro seu próximo horário."*

Repare no que **não** está escrito em lugar nenhum: "ganhe", "código", "programa", "cadastre-se".

### 4.4 · Onde pedir — três momentos, em ordem de retorno

| # | Momento | Por quê | Custo |
|---|---|---|---|
| 1 | **Depois de 5 estrelas na avaliação** | é o pico (§2.5), e a tela já existe | baixo |
| 2 | Botão "Indicar" na ficha da cliente | o dono pede na hora que quiser, pelo `wa.me` que já existe | baixo |
| 3 | Na confirmação do agendamento público | a cliente acabou de ter uma boa experiência com o produto | baixo |

O primeiro é o que vale mais e é o mais barato: na tela de "Obrigado pela avaliação!", **se e
somente se a nota foi 4 ou 5**, aparece uma linha e um botão de compartilhar. Nota 1 a 3 não vê
nada — pedir indicação a quem reclamou é o jeito mais rápido de transformar uma nota ruim numa
avaliação pública ruim.

### 4.5 · Antifraude, na medida

No B2C **nenhum dinheiro do CICLO está em jogo** — o prêmio é desconto que o próprio salão decidiu
dar. Então o antifraude é proporcional e cabe em três linhas:

- não dá para indicar a si mesma (`referred_by !== id`);
- o crédito só existe na **primeira visita concluída** (já implementado);
- o `clients_unique_phone` por tenant já impede a mesma pessoa virar duas clientes.

Nada de CPF, nada de instrumento de pagamento. Isso é o desenho do B2B, e ele fica no `docs/18`.

---

## 5 · O motor de upgrade — a parte que hoje não existe

A pesquisa sobre conversão de grátis para pago é direta ao ponto, e vale colar aqui:

> **Conversão de freemium é problema de desejo, não de pressão.** A pessoa faz upgrade quando bate
> num limite **que significa alguma coisa**, não porque alguém inventou urgência.

E o segundo achado, que é o que amarra este documento inteiro:

> **Viés de compromisso:** quem realiza várias ações — convidar gente, criar coisas — passa a
> justificar o upgrade. Quanto mais a pessoa construiu ali dentro, mais caro fica sair.

Ou seja: **a indicação não é um recurso ao lado do upgrade. Ela é o mecanismo do upgrade.**

### 5.1 · A corrente, em quatro elos

```
convite compartilhado
   -> cliente nova entra no CICLO (não numa agenda de papel)
      -> base do salão cresce
         -> encosta no teto de 50 clientes do Grátis
            -> o upgrade acontece porque o produto FUNCIONOU
```

Bater no teto porque a coisa deu certo é o melhor momento de venda que existe. O limite deixa de ser
cancela e vira **prova**.

### 5.2 · O problema que precisa ser decidido antes: `loyalty` está no terceiro degrau

Hoje o módulo `loyalty` — que é quem credita os pontos dos dois lados — pertence ao **Equipe
(R$ 99)**. Consequência: o salão do Grátis e o do Essencial **não conseguem recompensar indicação
nenhuma**. O laço morre exatamente onde ele geraria mais pressão de upgrade.

**Recomendação — partir o recurso em dois:**

| Peça | Degrau | Por quê |
|---|---|---|
| Link de convite, `referred_by`, "quem trouxe quem", card do dono | **Grátis** | cada link é uma página do CICLO circulando com o selo; e é o laço que enche o teto de 50 |
| Pontos automáticos dos dois lados, níveis, extrato | **Equipe** | é a automação, e automação é o que se cobra |

O salão do Grátis continua recompensando **na mão** ("dá 10% no próximo") — o que funciona para
sempre e não custa nada. Ele só não tem o produto fazendo isso sozinho.

Isso **aumenta** a pressão de upgrade em vez de diminuir: quem está no Grátis vê a indicação
acontecendo, vê a lista crescer, e a única coisa que falta é o automático.

### 5.3 · Os três gatilhos, e todos são no contexto

A pesquisa é explícita: em freemium, o que converte é **gatilho no contexto de uso**, não e-mail com
prazo. Os três, em ordem:

**1. A barra que enche — `38 de 50 clientes`**

Visível na lista de clientes desde o primeiro dia, não só quando estoura. É o efeito de progresso
dotado: barra de progresso é o gatilho mais forte que existe, e a barra que enche **sozinha, por
indicação** é a melhor propaganda que o Essencial pode ter. Quando passa de 40, ganha uma linha:

> *"38 de 50 clientes. Quando lotar, o Essencial tira o limite — R$ 49/mês."*

**2. O paywall que aparece no instante da prova**

Quando uma indicação converte e o salão está no Grátis ou Essencial:

> *"A Paula veio pelo convite da Ana. No Equipe, a Ana ganharia os 20 pontos automaticamente."*

Não é bloqueio: é o valor entregue **primeiro** e a automação oferecida **depois**. O padrão de
paywall que mostra dinheiro em vez de dizer "faça upgrade" já existe nesta base (`docs/27` §P6).

**3. O extrato mensal do que o laço rendeu**

> *"Suas clientes trouxeram 4 novas este mês. Quem vem por indicação costuma voltar mais."*

A segunda frase é o §2.4 traduzido. Sem ela, o card é um número; com ela, é um motivo.

### 5.4 · O que NÃO fazer para gerar upgrade

- **Não** criar contagem regressiva, banner piscando ou "últimas horas". A mesma pesquisa que
  aponta o gatilho no contexto aponta a urgência artificial como o que não funciona em freemium.
- **Não** tirar recurso que já era grátis para criar dor. Aversão à perda converte quando a pessoa
  **experimentou** e o teste acabou (é o teste reverso do `docs/27` §P1, que já é decisão sua e não
  vou reabrir aqui) — não quando ela é punida por ter usado.
- **Não** cobrar pelo **link**. O link é distribuição do CICLO: cada um carrega uma página com o
  selo para dentro do WhatsApp de gente que nunca ouviu falar do produto.

---

## 6 · A interface

Regras da casa que valem para tudo abaixo: 390 px, alvo de toque ≥ 48 px, pt-BR sem jargão, e
estado de carregando/vazio/erro em cada tela nova. Componentes que já existem e devem ser
reusados: `Card`, `StatTile`, `EmptyState`, `Button` (com `motivoDesabilitado`), `Chip`, `Sheet`,
`SectionHeader`, `AlertBanner`.

### 6.1 · Uma trava que não pode ser esquecida

O convite sai **pelo `wa.me`, com o dono ou a cliente tocando em compartilhar**. Nunca por envio
automático. A rota `reminders` continua fora do `on.schedule` do `cron.yml`, e o produto não pode
dizer "a gente avisa sua amiga". As guardas `promessa-de-canal` e
`agendamento-publico-nao-promete-demais` já reprovam essa copy — e estão certas.

### 6.2 · Tela por tela

**a) `/(public)/avaliar/[token]` — o pico.** Depois do "Obrigado pela avaliação!", e **só com nota
4 ou 5**: uma frase e um botão de 48 px.

```
        Obrigado pela avaliação!

  ┌──────────────────────────────────┐
  │  Dê R$ 20 pra uma amiga           │
  │  Ela ganha no primeiro horário —  │
  │  e você ganha quando ela vier.    │
  │                                   │
  │  [  Mandar no WhatsApp  ]         │
  └──────────────────────────────────┘
```

O título é o presente. O prêmio de quem indica é a segunda linha, menor. É o §2.2 aplicado.

**b) `/{slug}/agendar?ind=` — a chegada.** Um `Card` no topo do agendamento, antes dos horários:

> **Correção da implementação (I-1):** este documento chegou a escrever `/{slug}?ind=` — o perfil do
> tenant, não a tela de agendar. O CTA "Agendar" do perfil (`secoes.tsx`) não repassa query string
> nenhuma para `/{slug}/agendar`, então um convite para a raiz perderia o token no primeiro toque.
> O link aponta direto para `/{slug}/agendar`, que é onde `?ind=` de fato é lido.

> **A Ana te deu R$ 20 de desconto no seu primeiro horário.**

Prova social de par: a nova cliente não está lendo um anúncio, está lendo o nome de alguém que ela
conhece. É o que a pesquisa chama de encaixe melhor, e acontece antes do primeiro clique.

**c) `/admin/clientes/[id]` — a ficha.** Um botão "Indicar" ao lado dos que já existem, abrindo um
`Sheet` com o texto pronto e o link, e um único botão que abre o WhatsApp. Na mesma ficha, o bloco
"Veio por indicação de" (que já existe) ganha o par: **"Trouxe: Paula, Júlia"**.

**d) `/admin/hoje` — o card do dono.** Só quando houve indicação no mês:

```
  ┌──────────────────────────────────┐
  │  Suas clientes trouxeram          │
  │            4                      │
  │  clientes novas este mês          │
  │  Quem vem por indicação           │
  │  costuma voltar mais.             │
  └──────────────────────────────────┘
```

Segue o padrão do `StatTile` herói que a tela já usa. E respeita o `hoje-heroi-do-motor`: não
disputa espaço com o herói do Motor de Ciclo — entra abaixo.

**e) `/admin/clientes` — a barra.** `38 de 50 clientes`, com barra, sempre visível. É o §5.3.

### 6.3 · O visual que carrega o peso: duas barras, e só duas

A pesquisa aponta barra de progresso como o mecanismo visual de maior retorno. Duas, e nenhuma a
mais — barra que não significa nada vira enfeite:

| Barra | Onde | Enche com | Serve para |
|---|---|---|---|
| `38/50 clientes` | lista de clientes | qualquer cliente nova | upgrade para Essencial |
| `2/3 indicações → próximo nível` | ficha da cliente | indicação convertida | engajamento da cliente (**só no Equipe**) |

A segunda é o mecanismo de níveis (1-2 iniciante, 3-9 intermediário, 10+ VIP), e é **deliberadamente
do Equipe**: é a automação, e é o que se cobra. No Grátis a ficha mostra a contagem sem a barra.

### 6.4 · Acessibilidade, porque a auditoria acabou de passar por aqui

- O botão de compartilhar, quando não houver telefone na ficha, fica travado **com
  `motivoDesabilitado`** ("Cadastre o telefone da cliente para poder mandar o convite") — a guarda
  `botao-travado-diz-por-que` reprova o contrário.
- O contador que muda sem trocar de rota (`38/50`) precisa de região `aria-live` que **nasce junto
  com a tela**, não com o conteúdo — a guarda `agendamento-anuncia-mudanca` já ensina a forma.
- O card de indicação na tela de avaliação aparece **depois** do envio: é troca de conteúdo sem
  troca de rota, mesma regra.

---

## 7 · Os tickets, em ordem de retorno por risco

Cada um é entregável sozinho. **Nenhum precisa de migration** — a mecânica de banco já existe.

| # | Ticket | Entrega | Risco | Depende de | Status |
|---|---|---|---|---|---|
| **I-1** | Escritor de `referred_by` | `?ind=` resolvido no agendamento público; cliente nova nasce indicada. **Liga o que já existe.** | baixo | — | ✅ feito |
| **I-2** | Guarda `indicacao-tem-escritor` | reprova se `referred_by` voltar a não ter escritor — a guarda da classe (`fee_cents`, `consent_id`, `plan`) | baixo | I-1 | ✅ feito |
| **I-3** | Convite na tela de avaliação (nota ≥ 4) | o pico, com a moldura de presente | baixo | I-1 | ✅ feito |
| **I-4** | Moldura de chegada em `/{slug}/agendar?ind=` | "A Ana te deu R$ 20" | baixo | I-1 | ✅ feito |
| **I-5** | Botão "Indicar" na ficha + "Trouxe: …" | o dono pede quando quiser | baixo | I-1 | ✅ feito |
| **I-6** | Barra `38/50` na lista de clientes | o gatilho de upgrade nº 1 | baixo | — | ✅ feito |
| **I-7** | Card "trouxeram 4 novas" no `/admin/hoje` | o extrato do laço | baixo | I-1 | ✅ feito |
| **I-8** | Reposicionar link/tracking para o Grátis | decisão de plano (§5.2) | **médio** | **decisão sua** | ✅ decidido e guardado (`indicacao-no-gratis.test.ts`) |
| **I-9** | Paywall no instante da prova | "no Equipe, a Ana ganharia sozinha" | baixo | I-8 | ✅ feito |
| **I-10** | Níveis e barra da cliente (Equipe) | gamificação | médio | I-8 | ⏸ aguarda §9.2/§9.3 (prêmio e valor ainda em aberto) |

**Comece por I-1 + I-2 + I-3.** Os três juntos são pequenos, e depois deles o laço existe de
verdade: alguém indica, alguém chega marcada como indicada, e os dois lados são creditados pelo
código que já estava lá.

**2026-08-30 — I-1 a I-9 mesclados.** O laço B2C está de ponta a ponta: link assinado, escritor,
convite no pico da avaliação, moldura de chegada, botão manual na ficha, barra de upgrade na lista
de clientes, extrato mensal no `/admin/hoje`, e o paywall que oferece a automação sem bloquear
nada. **I-10 fica pra depois**: ele grava nível/pontuação e isso depende de `referralBonusPoints` e
"valores iguais dos dois lados", que são as duas perguntas que §9 ainda deixa em aberto — construir
a barra de nível em cima de um valor que pode mudar seria trabalho jogado fora.

### O que medir, senão vira anedota

O `docs/27` §P5 já propõe `product_events`. Se ele existir, quatro eventos fecham este laço:
`convite_compartilhado`, `convite_aberto`, `indicada_agendou`, `indicada_concluiu`. Sem isso, a
pergunta "a indicação funciona?" só tem resposta por impressão — e a taxa que interessa
(compartilhado → concluiu) é justamente a que decide se vale construir os níveis do I-10.

---

## 8 · O que eu não recomendo, e por quê

| Ideia | Por que não |
|---|---|
| Construir a indicação B2B (salão indica salão) agora | trava de ≥ 20 pagantes é do `docs/18` e está certa: sem pagante não há mensalidade para descontar, e o antifraude é caro |
| Dar mais pontos a quem indica do que a quem chega | é o costume do mercado e é o que reforça "estou vendendo minha amiga" (§2.2/§2.3) |
| Mandar o convite automático por WhatsApp | `reminders` não está agendada; o produto não pode prometer canal que não entrega, e as guardas reprovam |
| Pedir indicação a quem deu nota baixa | o pedido no vale da experiência vira avaliação pública ruim |
| Ranking público de quem mais indicou | expõe cliente do salão para outras clientes; num salão pequeno é constrangimento, não jogo |
| Prêmio em dinheiro para a cliente | vira "comissão", ativa o problema do §2.2 — e o que ela valoriza é atendimento, não caixa (§2.6) |

---

## 9 · O que é decisão sua

> **Duas já foram decididas em 29/08 e estão em `docs/DECISOES.md`:** o link de convite fica no
> **Grátis** (com os pontos automáticos no Equipe), e a **auditoria é mesclada antes** de a
> indicação começar. As duas de baixo continuam abertas.

1. ~~**O link de convite fica no Grátis?**~~ **Decidido: sim** — link, `referred_by`, "quem trouxe
   quem" e card do dono no Grátis; pontos automáticos, níveis e extrato no Equipe. Isso torna o
   ticket **I-8 obrigatório**, e ele passa a ser pré-requisito do I-9.
2. **Qual é o prêmio, e quanto?** Hoje o padrão é 20 pontos dos dois lados. A pesquisa diz para dar
   "mais do que a pessoa já valoriza" — no salão isso é desconto em reais ou serviço curto de
   brinde, não ponto abstrato. Se for manter ponto, a tela precisa dizer quanto vale um ponto.
3. **Valores iguais dos dois lados?** Recomendo sim, contra o costume brasileiro (§2.3).
4. ~~**Entra antes ou depois de mesclar a auditoria?**~~ **Decidido: depois.** A auditoria vai
   primeiro, e as migrations `0045`/`0046` precisam alcançar produção antes de qualquer coisa nova
   entrar por cima delas.

---

## 10 · Fontes

- [Referral Programs and Customer Value — Schmitt, Skiera & Van den Bulte, *Journal of Marketing* 75(1)](https://journals.sagepub.com/doi/abs/10.1509/jm.75.1.46) · [PDF com o resumo dos resultados](https://www.marketing.uni-frankfurt.de/fileadmin/user_upload/dateien_abteilungen/abt_marketing/Bilder/Professor_Skiera/Publikationen/Do_Referral_Programs_Increase_Profits.pdf)
- [How Customer Referral Programs Turn Social Capital into Economic Capital — Van den Bulte, Bayer, Skiera & Schmitt, *JMR* 2018](https://journals.sagepub.com/doi/10.1509/jmr.14.0653)
- [The psychology of referral: what really motivates customers to refer](https://www.mention-me.com/blog/psychology-of-referral-what-really-motivates-customers-to-refer) — o buraco 83%/29% e o cálculo de risco social
- [The Psychology Behind Referrals — Referral Factory](https://referral-factory.com/learn/psychology-behind-referrals) — relação comunal contra relação de troca
- [Better Referral Rewards: The Case for Recipient Incentives — impact.com](https://impact.com/referral/better-referral-rewards-recipient-incentives/) — os experimentos sobre qual lado premiar
- [Double-sided referrals — Voucherify](https://www.voucherify.io/blog/how-to-launch-a-double-sided-referral-program) e [Referral Factory](https://referral-factory.com/learn/double-sided-referral-program)
- [The Dropbox Referral Program: 3900% em 15 meses — GrowSurf](https://growsurf.com/blog/dropbox-referral-program/) · [SaaSquatch, os números](https://www.saasquatch.com/blog/dropbox-customer-referral-program-by-the-numbers/) · [Viral Loops](https://viral-loops.com/blog/dropbox-grew-3900-simple-referral-program/)
- [Best Time to Ask for a Referral — ReferralCandy](https://www.referralcandy.com/blog/best-time-to-ask-for-a-referral) e [Peak-End Rule — Umbrex](https://umbrex.com/resources/frameworks/marketing-frameworks/peak-end-rule-experience-design/)
- [Milestone Referral Programs: tiered rewards — ReferralRock](https://referralrock.com/blog/milestone-referral-programs/) e [Gamified Referrals — ReferralCandy](https://www.referralcandy.com/blog/gamified-referral-program/)
- [Free-to-Paid Funnels: Triggers & Workflows — DataDab](https://www.datadab.com/blog/optimizing-free-to-paid-conversion-funnels-behavioral-triggers-and-automated-workflows/) e [Crafting Freemium to Premium Upgrade Journeys — Monetizely](https://www.getmonetizely.com/articles/crafting-freemium-to-premium-upgrade-journeys-that-actually-convert)
- [Programa de fidelidade para salão e barbearia — LOYAL/PASS](https://www.loyalpass.com.br/cartao-fidelidade/salao-barbearia) e [Como conseguir clientes por indicação — LeBy](https://blog.leby.com.br/atrair-clientes-por-indicacao/) — os 68% e a convenção 50/30 do mercado brasileiro
