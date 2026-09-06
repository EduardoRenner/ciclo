# 53 · VANTAGEM REAL, DE ZERO A UM — PLANO

> **Para quem chega frio.** Leia nesta ordem: `CLAUDE.md` → `docs/47` → `docs/48` → `docs/49` →
> `docs/50` → `docs/51` → `docs/52`. Este é o sucessor do `52`.
>
> **Nada aqui foi implementado. É plano.** Os tickets são handoff para um prompt de execução
> separado.

| Tag | Significado |
|---|---|
| `[M]` | Medido no repositório em 2026-09-06 |
| `[P]` | Pesquisa externa com link e data de acesso (todas no `docs/52`) |
| `[E]` | Estimativa — não vira fato por repetição |
| `[V]` | Fere veto de projeto |

---

# 1 · A aposta

> **Os outros te mostram quanto você faturou. O `docs/48` fez o CICLO mostrar quanto sobrou. Esta
> rodada descobre por que ninguém mais vai fazer isso: em 2026 quem dá a agenda de graça é quem
> ganha da sua maquininha — e essa pessoa nunca vai te dizer que a taxa dela é um custo seu.**

Dito como mecanismo, e não como frase: **o CICLO é o único sistema do mercado que sabe as quatro
parcelas do custo de um atendimento e não ganha um centavo de nenhuma delas.** É por isso que ele
pode dizer o que a taxa comeu. É por isso que o processador não pode.

E é uma aposta que **fica mais forte quanto mais fintech entrar na agenda**, que é exatamente a
direção para onde o mercado está indo.

## 1.1 · A segunda lente: execução também é vantagem, mesmo sem ser `0→1`

A missão original filtra por originalidade estrutural (Parte 2), e é o filtro certo para chamar
algo de **fosso**. Mas existe uma segunda pergunta, que a missão não fazia e que passou a fazer
parte deste plano por decisão do dono, discutida em 2026-09-06: **um candidato `1→n-paridade` pode
ainda valer a pena, se a diferença estiver em quão bem ele é executado, não em ele existir.**

O exemplo que fundamenta isto não é hipotético — é o mercado de navegador inteiro. Firefox e Chrome
fazem, em essência, a mesma coisa desde 2008. Nenhum dos dois tem uma feature que o outro não pode
copiar em semanas. Chrome ganhou por **execução**: velocidade percebida, integração, polimento de
interface — não por fazer algo estruturalmente impossível de copiar. É `1→n`, e mesmo assim um dos
dois dominou o mercado inteiro.

**A diferença entre isto e "feature de paridade que não vale nada" (`docs/52` V7, IA no WhatsApp,
reprovado ali) está em duas condições, e as duas precisam estar presentes:**

1. **A execução tem que estar amarrada a um dado que o concorrente não tem** — senão é só gastar
   mais em polimento numa corrida onde quem tem mais dinheiro sempre vence, e o CICLO não tem mais
   dinheiro que a InfinitePay ou o Simples Agenda. Sem essa amarração, "fazer melhor" é aposta sem
   fosso nenhum por trás — bonita, mas do tamanho do orçamento de quem construir.
2. **O canal em que a execução acontece tem que já estar disponível** — senão o trabalho de
   qualidade é investido num tubo fechado. É exatamente o caso do candidato da §1.2: a IA de
   WhatsApp não pode ser testada, refinada nem lançada enquanto o F0 (`docs/25`) não estiver ligado.

**Isto não reabre os sete candidatos `1→n-paridade` que o `docs/52` §6 reprovou.** Aquela reprovação
continha a palavra **vantagem** — nenhum deles constrói fosso, e isso continua verdadeiro. O que
esta seção abre é uma categoria diferente, tratada à parte na §1.2 e na priorização abaixo: **aposta
de qualidade de execução, com uma condição de dado amarrado, sem pretensão de ser `0→1`.** Ela entra
no plano porque o dono decidiu que vale, não porque passou nos cinco filtros da Parte 2 da missão —
e o plano registra essa diferença de origem em vez de escondê-la atrás do mesmo selo de "vantagem".

## 1.2 · O candidato de execução: o agente de IA no WhatsApp, com o Motor de Ciclo na conversa

**A reprovação do `docs/52` §6 V7 continua correta como resposta à pergunta "isto é vantagem
estrutural?"** — não é. Seis concorrentes brasileiros novos (`52` §3.2 N3-N6) já têm IA
conversacional no WhatsApp, e o Simples Agenda tem duas (GAIA + Gendo Zap). Um agente de IA que só
agenda, remarca e tira dúvida é `1→n-paridade` puro.

**O que muda a resposta é a condição 1 da §1.1: o CICLO tem um dado que nenhum desses seis tem, e
ele cabe dentro da mesma conversa.** `client_cycles` sabe, por pessoa, de quanto em quanto tempo
aquele cliente específico costuma voltar, e se ele já está atrasado. Nenhum concorrente com IA no
WhatsApp usa isso na conversa — o que eles têm é um roteiro de agendamento genérico, igual para
qualquer cliente que escreve. A diferença não está em "ter IA no WhatsApp"; está em a IA saber, sem
perguntar, que aquele cliente específico está 5 dias atrasado do próprio ritmo — e puxar isso na
resposta, em vez de esperar o dono abrir `/admin/recuperar` e mandar mensagem manual.

**Isto não é o mecanismo do `docs/46`/`docs/52` de novo travestido.** O mecanismo de custo de troca
(previsão registrada + calibração por salão) continua sendo o fosso estrutural, intocado por este
candidato. O que este candidato faz é **dar um canal novo e melhor para um dado que já existe**, sem
criar dado novo nenhum. É distribuição, não descoberta — e por isso é tratado como aposta de
qualidade, nunca anunciado como "vantagem que os outros não têm", porque a capacidade de ter IA no
WhatsApp, essa parte, eles têm.

**A dependência que domina tudo: F0.** `docs/25` §3 registra que `reminders` e `campaigns` — as duas
rotas que falam com o cliente final — estão desligadas em produção, por decisão consciente do dono,
até confirmar credencial WhatsApp (`WHATSAPP_PHONE_NUMBER_ID`, `ACCESS_TOKEN`, `APP_SECRET`) e rodar
um disparo manual de teste. **Nenhuma linha deste candidato pode ser construída, testada ou
lançada antes disso.** Não é ordem de prioridade — é ordem de existência: um agente conversacional
sem canal ligado não tem com quem conversar.

---

# 2 · Priorização

Restrições decididas **antes** de gerar a lista, herdadas do `46`/`48`/`50` e da Parte 5 da missão:
veto permanente de vitrine; nada de cobrança, preço ou envio automático sem confirmação humana;
nada que dependa de F0; nada que peça credencial de terceiro nova; nada que cruze fronteira de
tenant; nunca inventar número para preencher tela.

**Uma exceção registrada, e só uma:** o candidato **G** (§1.2) depende de F0 por natureza — é um
agente que fala pelo WhatsApp, e não existe versão dele sem o canal ligado. Ele não é avaliado como
`vantagem` sob os cinco filtros da Parte 2 (é aposta de execução, §1.1), e por isso não está sujeito
ao mesmo veto que blindava os candidatos daquela lista contra depender de um canal desligado. Fica
**fora da fila principal**, com o F0 como portão explícito, nunca como detalhe a resolver depois.

| # | Candidato | Eixo (fosso) | Depende de | Custo `[E]` | Risco | Por que agora |
|---|---|---|---|---|---|---|
| **A** | **V4 · O que a forma de pagamento custou** — o número mensal da taxa por forma, com a comparação entre as formas que **aquele salão já usa** | **Counter-positioning** (o único que prende o líder) + recurso cativo pela `0071` | `0066` aplicada + o dono responder a taxa | **2 tickets** | Baixo. Não sugere preço, não pede credencial, não fala com ninguém | É a única parcela do "Sobrou" que o dono muda **na semana seguinte**, sem mexer em preço nem em comissão |
| **B** | **V4 · A frase que nomeia o conflito**, em `/precos` e na demo | Counter-positioning (comunicação do A) | A funcionando numa conta real | 1-2 tickets | **Médio** — afirmação sobre concorrente em página pública exige fonte datada, e é declaração da empresa | Sem isto, A é um número bonito que ninguém procura |
| **C** | **V1 · O extrato do profissional** | Nenhum — é conserto de afirmação falsa, não vantagem | nada | 1-2 tickets | Baixo | O `docs/50` L-10.3 **afirma que já existe e não existe** (`52` §2.2). Documento que mente sobre o código é dívida cara |
| **D** | **V2 · A cadeira vazia com piso de lucro** | Tecnologia proprietária (eixo 1), **condicional ao piso** | A + histórico de ocupação + custo completo | **4-5 tickets** | **Alto** `[V]` se mal desenhado — precificação automática é vedada | ~US$ 44 mil/ano por profissional de lacuna `[P]`. Mas é o mais caro e o único com risco de veto |
| **E** | **V5 · NFS-e nacional** | Nenhum — higiene regulatória | decisão de escopo (está fora do MVP) | 5+ tickets `[E]` | Médio — é norma pública, erro é multa do cliente | Vale desde 01/01/2026 `[P]`. **Não é vantagem, é motivo de troca de sistema.** Entra na lista para não ser esquecido, não para ser feito agora |
| **F** | **Validação de campo** (herda o `L-05`, nunca feito) | Prova | A + B | 0 tickets de código | Nenhum | Continua sendo a coisa mais barata que pode derrubar a tese inteira, e continua não feita |
| **G** | **Execução · Agente de IA no WhatsApp com o ritmo do cliente** (§1.2) | Nenhum estrutural — é qualidade de execução amarrada ao dado do Motor de Ciclo | **F0 completo** (credencial + disparo de teste + `schedule` ligado, `docs/25`) | 5-6 tickets `[E]` | **Alto**, mas de reputação de canal, não de veto de produto — mensagem errada em massa custa o número de WhatsApp | É o único candidato onde "fazer igual, só que melhor" tem um dado real amarrado (§1.1). Sem F0, custo de oportunidade zero: não há o que perder esperando |

## A ordem: **A → C → F → B → D**, com E fora da fila e G represado atrás do F0

**Por quê, em uma linha cada:**

- **A primeiro** porque é o único `0→1` da rodada e o de menor dependência (`52` pergunta 10).
- **C logo depois** porque é barato, não bloqueia nada, e existe um documento afirmando um
  comportamento que o código não tem — dívida que a próxima rodada pagaria em confusão.
- **F antes de B**, e isto é uma inversão consciente em relação ao `docs/50` (que punha o `L-05`
  depois da porta): **a pergunta da taxa é a única pergunta do roteiro de campo que o A torna
  crítica.** O `docs/48` §Fase 3 apostou que *"a taxa da maquininha é um único percentual que todo
  dono sabe de cor"*. Se essa premissa cair, **o A cai junto**, e é melhor descobrir antes de
  escrever a copy pública que o defende.
- **B depois de F** pela regra do `docs/50` §3.3, que o `docs/51` §5.4 aplicou e continua valendo:
  a porta não promete o que a conta de hoje não mostra. E as migrations `0066`-`0072` **continuam
  sem estar em produção** `[M]`.
- **D por último** porque é o mais caro, o único com risco de veto, e porque o piso de lucro que o
  torna defensável **é o A funcionando**. Fazer D antes de A é sugerir desconto sem saber o chão.
- **E fora da fila** porque não é vantagem e a decisão de escopo é do dono, não do executor.
- **G represado, não descartado.** Ele não compete com A pela mesma vaga — compete pelo canal que
  não existe ainda. Assim que o F0 for ligado (decisão do dono, fora desta execução), G sobe para o
  topo da fila de qualidade de produto, porque nesse momento passa a ser a coisa que mais rápido
  torna o WhatsApp do CICLO diferente do WhatsApp dos seis concorrentes que já o têm ligado.

---

# 3 · Red team — o ataque aos três do topo

## 3.1 · Contra A (o custo da forma de pagamento)

**Ataque 1 — "isso já existe, você só não achou."**

É a acusação mais provável e ela quase pega. O que existe, verificado `[P]`: todo processador
mostra a taxa **na venda** (é obrigação de recibo), e a InfinitePay tem **calculadora de taxas** no
app e na maquininha. O que **não** existe em nenhum dos 31: a taxa **agregada no mês, ao lado do que
sobrou, comparada com as outras formas que aquele salão já usa**. A diferença não é cosmética: uma
calculadora responde *"quanto vai custar esta venda?"* e o CICLO responderia *"quanto custou o seu
mês, e quanto teria custado do outro jeito"*. A primeira é uma ferramenta de precificação; a
segunda é uma acusação contra quem a hospeda.

**Onde eu posso estar errado:** não consegui verificar o **EiBarber**, que declara ter um *"motor de
precificação"* — o domínio não resolveu DNS em 06/09/2026 (`52` §3.2 N5). **É a primeira coisa a
conferir antes de escrever uma linha do ticket A-01.** Se ele fizer isto, A cai de `0→1` para
`1→n-10x` e a copy do B tem que mudar.

**Ataque 2 — "é fácil de copiar, apesar do teste dos seis meses."**

Para os SaaS que não processam (Trinks, Simples Agenda, Barberia.io): **tecnicamente sim, em
semanas.** O que os trava não é dificuldade — é que eles precisariam antes construir as quatro
parcelas de custo, e a Zenoti já demonstrou publicamente que essa é a parte que se abandona (relatório
legado, cortado desde abr/2022) `[P]`. É um argumento probabilístico, não uma impossibilidade, e
está escrito assim de propósito.

Para os processadores (InfinitePay, modoPAG): **não copiam, e aqui é estrutural de verdade.** Um
número que diz ao lojista *"a taxa desta empresa comeu R$ 363 do seu mês"* dentro do app dessa
mesma empresa é uma peça que o produto não deixa passar. É o mesmo desenho do app do cliente que o
`docs/43` §2 achou: a reclamação nº 1 é o modelo de negócio.

**Ataque 3 — "a premissa pode estar errada."**

A premissa é do `docs/48` §Fase 3: *"a taxa da maquininha é um único percentual que todo dono sabe
de cor"*. Ela **nunca foi testada**, e o `docs/51` §5.2 item 4 registra que o `L-05` continua não
feito. Se o dono não souber a taxa de cor, A não morre — mas muda de forma: em vez de *"você
respondeu 2,69%, e isso custou R$ 363"*, vira um trabalho de descoberta, e aí o V10 (ler a
maquininha) volta à mesa com a dependência de credencial que o `52` reprovou. **Por isso F vem
antes de B.**

**Ataque 4, e é o mais desconfortável — "isto não é um eixo novo."**

Correto, e está admitido no `52` §6 V4. A missão pediu eixos além da granularidade financeira, e o
sobrevivente é o eixo financeiro visto por outra lente. A defesa é que **o filtro vale mais que a
novidade**: dos dez candidatos, oito falharam nos filtros da Parte 2, e sete deles falharam por
paridade — não por falta de imaginação, mas porque o mercado de 2026 está denso. Escolher um
candidato mais novo e mais fraco para parecer produtivo é o erro nomeado na Parte 7 da própria
missão.

## 3.2 · Contra C (o extrato do profissional)

**Ataque 1 — "isso enfraquece o dono, que é quem paga."**

É o ataque sério, e o `52` pergunta 7 já o nomeia: o território está vazio **por viés de comprador**.
Dar ao profissional a capacidade de conferir tira do dono a possibilidade de ajustar sem conversa.
Um produto vendido ao dono construir isso não é obviamente inteligente.

**A resposta, e ela é limitada:** o extrato do CICLO é congelado no fechamento `[M]` — mudar o
percentual depois já não reescreve nada. O poder de ajustar retroativamente **já não existe**. O que
C acrescenta é só quem enxerga. E o `docs/47` P07 registra que o maior medo do dono é o profissional
sair levando metade da clientela — desconfiança de comissão alimenta exatamente isso.

**Mas C não é vantagem, e o plano não finge que é.** É conserto de documento com efeito colateral
bom.

**Ataque 2 — "pode existir e eu não achei."** Vagaro tem portal de folha `[P]`; não verifiquei se o
profissional vê o extrato item a item ou só o total. Assumo `1→n` e não reivindico originalidade.

## 3.3 · Contra D (a cadeira vazia)

**Ataque 1 — "o número de 44 mil dólares é de outro mercado."**

Verdade parcial. A Zenoti mede 30 mil negócios globais, com peso enorme de medspa e salão grande
`[P]`. Uma barbearia brasileira de três cadeiras tem outra estrutura de custo e outra elasticidade.
**O número prova que a lacuna existe e é a maior do conjunto; ele não prova o tamanho dela no
Brasil.** Marcado `[P]` e nunca convertido em `[M]` sem medir num salão real.

**Ataque 2 — "isto vira precificação automática pela porta dos fundos."**

O risco é real e é a razão de D ser o último. A mitigação tem que estar no desenho do ticket, não
na boa intenção: a sugestão nunca é aplicada, nunca é o padrão, e o texto nomeia o piso
(*"abaixo de R$ X este horário dá prejuízo"*) em vez de nomear o preço. A guarda
`veto-de-precificacao` já existe como **molde de permitidos** (`docs/51` §3 item 13) e é ela que
decide se o ticket passa.

**Ataque 3 — "o dono não quer descontar, quer encher."**

Provável, e é o mesmo formato da fragilidade que o `docs/46` §Fase 3 achou (*"o dono não se importa
com acurácia"*). Consequência de projeto: a tela nunca lidera com desconto. Lidera com **"terça às
14h está vazia há 6 semanas"** — que é um fato — e o preço é a segunda tela, atrás de um toque.

## 3.4 · Contra G (o agente de IA no WhatsApp)

**Ataque 1 — "isto é só copiar o que os outros seis já têm, com um enfeite."**

É o ataque mais forte, e a defesa não é fingir que G é original — é o próprio §1.2: G nunca é
vendido como vantagem estrutural. Se o "enfeite" (o ritmo do cliente entrando na conversa) for
removido do escopo, **G deixa de valer a pena e vira só mais um concorrente do meio do pelotão** —
não há razão de negócio para construir a versão genérica. O critério de aceite do ticket tem que
travar nisso: sem o dado do Motor de Ciclo na conversa, o ticket não está pronto, está pela metade.

**Ataque 2 — "o dado amarrado não muda a decisão de compra, só decora a conversa."**

Risco real, do mesmo formato do `docs/46` §Fase 3 ("o dono não se importa com acurácia"). Se o
cliente final não perceber diferença entre "oi, quer marcar um horário?" e "oi, faz tempo que você
não vem, bora marcar?", o diferencial de dado não se traduz em experiência, e G volta a ser
`1→n-paridade` pura, sem a exceção da §1.1. **Mitigação:** o critério de aceite do G-01 exige medir,
não supor — comparar taxa de resposta e taxa de conversão da mensagem com e sem o ritmo do cliente,
antes de declarar a diferença como real.

**Ataque 3 — "canal de IA errando em massa é reputação de número de WhatsApp queimada, não bug de
tela."**

É o motivo do risco ser marcado **Alto** na tabela do §2, mesmo sem violar veto de produto. Um
agente que interpreta mal e manda mensagem errada em volume tem uma consequência que uma tela com
bug não tem: o número do WhatsApp Business do CICLO pode ser banido pela Meta, e isso afeta **todos
os tenants ligados**, não só o que recebeu a mensagem errada. A mitigação não é nova — é reaproveitar
o que o F0 já construiu: teto diário por tenant (`mensageria.ts`, `dentroDoTetoDiario`) e o
interruptor manual de pausa (`tenants.settings.messaging.paused`). G herda os dois sem escolha.

**Ataque 4 — "o F0 pode nunca ligar, e G fica sendo trabalho morto."**

Verdadeiro, e é por isso que G não tem ticket detalhado além do esqueleto abaixo: detalhar cinco
tickets de um agente que não tem canal para existir é planejar sobre premissa não confirmada — o
mesmo erro que o `docs/51` §0 documenta para D. **G fica registrado como intenção com portão
explícito, não como trabalho pronto para começar.**

---

# 4 · Os tickets — **NÃO EXECUTADOS NESTA RODADA**

> Convenção da casa: cada ticket tem **objetivo**, **critério de aceite**, **onde mexer** e
> **armadilhas**. O executor decide o desenho; o critério é o contrato. Um ticket, um commit,
> mensagem em português. `pnpm verify` antes de cada commit. **Guarda nova precisa ser vista
> reprovando** — o procedimento de mutação do `CLAUDE.md` não é opcional, e o `docs/51` §4 registra
> sete guardas cegas numa rodada só.

## A-00 · Conferir o EiBarber antes de tudo

**Objetivo.** Fechar o único buraco de verificação do `docs/52`.

**Critério de aceite.** O EiBarber (`eibarber.com.br`, fora do ar no acesso de 06/09/2026) é aberto
ao vivo, e a central de ajuda / catálogo de relatórios dele é lida — não a landing. A resposta a
duas perguntas entra no `docs/52` §3.2 N5 com data: (1) o "motor de precificação" desconta custo, ou
só sugere preço de tabela? (2) alguma tela mostra a **taxa de pagamento** como parcela do que sobra?

**Se a resposta às duas for sim, A-01 muda de classificação e B muda de copy.** Registrar isso é o
entregável, não uma nota de rodapé.

**Armadilha.** Landing page é o que eles querem que você acredite. Se o site voltar, ler central de
ajuda e formulário de cadastro de serviço.

---

## A-01 · O que a forma de pagamento custou no mês

**Objetivo.** O dono vê, em reais e no mês dele, quanto cada forma de pagamento levou — e o que o
mesmo mês teria custado nas outras formas que **ele já usa**.

**Critério de aceite**

1. Em `/admin/mes` (ou seção do caixa), um bloco que quebra o mês por `tickets.payment_method`:
   quantas comandas, quanto entrou, **quanto saiu de taxa** (`tickets.fee_cents`, já congelado pela
   `0066`).
2. Ao lado, a contrafactual **restrita**: o mesmo volume, avaliado com os percentuais das outras
   formas que **estão preenchidas em `tenants.settings.payment_fees_bps` daquele tenant**. Forma
   sem percentual respondido **não entra** — nem com zero, nem com média de mercado.
3. Quando o dono não respondeu nada, o bloco **não aparece**, e a ação de completude que já existe
   (`L-01`, `centralDeAcoes`) é o caminho. Estado "ainda não sei" é obrigatório e honesto.
4. Nenhum número novo é calculado a partir de comanda fechada: a taxa vem de `fee_cents`
   congelado. **Recalcular do percentual de hoje sobre o passado é o defeito da `0070` de volta**.
5. Atrás de `report:read`.
6. Guarda: um teste que reprove se alguma forma **não respondida** aparecer na comparação, e outro
   que reprove se a taxa do mês for recalculada em vez de somada de `fee_cents`.

**Onde mexer.** `src/app/admin/mes/`, `src/server/services/caixa.ts`,
`src/core/comanda/taxa-de-pagamento.ts` (só leitura), possivelmente um módulo puro novo em
`src/core/caixa/`.

**Armadilhas.**
- **Não inventar a forma que ele não usa.** Comparar com "Pix, que seria zero" quando o salão não
  aceita Pix é número para preencher tela, e é vedado.
- O dia do salão não é UTC: `caixa.ts` e `comissao.ts` já pagaram esse bug duas vezes cada.
- `/admin/mes` já compõe cinco consultas num `Promise.all` (`docs/50` L-07). A nova entra lá, não
  em série.
- **Não prometer economia.** *"Você economizaria R$ X"* é promessa sobre comportamento futuro do
  cliente dele. *"Este mês, no crédito, custou R$ 363"* é fato.

---

## A-02 · A taxa entra na razão do "por que sobra pouco"

**Objetivo.** A parcela dominante do `L-06` passa a saber dizer quando a culpada é a taxa, e a levar
até o A-01.

**Critério de aceite**

1. `core/caixa/margem-do-servico.ts` já classifica `parcelaDominante` como `'comissao' | 'material'
   | 'taxa'` `[M]`. Quando for `'taxa'`, a frase leva ao bloco do A-01, não ao catálogo.
2. O texto nomeia a alavanca sem puxá-la, como manda o `L-06`: *"a taxa da maquininha leva R$ X
   deste serviço"*. **Nunca** *"troque de maquininha"* nem *"suba o preço"* — o primeiro é conselho
   comercial que o CICLO não tem base para dar, o segundo é o veto de precificação `[V]`.
3. A guarda `veto-de-precificacao` (molde de permitidos, `docs/51` §3.13) continua passando, e é
   estendida se a copy nova pedir.

**Armadilha.** A frase existe em dois lugares (lista de serviços e comanda). O `docs/51` §2.2
documenta o custo de três chamadores remontando a mesma pergunta por conta própria: **a decisão
mora no módulo puro, não na tela.**

---

## C-01 · O profissional vê o próprio extrato

**Objetivo.** Fechar a lacuna medida no `docs/52` §2.2 e tornar verdadeira a frase do `docs/50`
L-10.3.

**Critério de aceite**

1. O papel `professional` alcança **o próprio** extrato de comissão, e só o próprio. Isso exige um
   verbo novo na tabela de `server/auth/rbac.ts` (`commission:own`, no molde de `appointment:own`)
   — **`own` é alcance, não verbo**, e a consulta ainda precisa filtrar pelo próprio profissional.
2. **Duas camadas, sempre**: permissão na rota **e** política de RLS. Uma só está errada
   (`CLAUDE.md` §1 e o comentário de `rbac.ts`).
3. `/api/v1/commissions/extract` hoje aceita `professionalId` arbitrário sob `commission:read`
   `[M]`. Com `commission:own`, o `professionalId` do parâmetro **tem que ser ignorado** e
   substituído pelo do contexto — nunca confiar no corpo/query (`CLAUDE.md`, armadilha do
   `tenant_id`).
4. O extrato do profissional mostra **comissão**, e nada de lucro do salão: `report:read` não
   alcança `professional`, e isso não muda. Ele vê o que é dele.
5. Guarda: um teste que reprove se um profissional conseguir ler o extrato de outro — e ele tem que
   ser visto reprovando com a permissão frouxa de volta.
6. `docs/50` L-10.3 é **corrigido por escrito** no mesmo commit, dizendo que a frase descrevia uma
   intenção e não o estado.

**Onde mexer.** `src/server/auth/rbac.ts`, `src/app/api/v1/commissions/extract/route.ts`, rota nova
em `src/app/admin/`, `supabase/migrations/` (política), `tests/rls/isolation.test.ts`.

**Armadilhas.**
- **Falhar fechado.** O `docs/51` decisão `[D]` 5 registra a regra: `papel` ausente esconde, nunca
  abre. Um `undefined` distraído não pode virar porta para dinheiro alheio.
- Tabela/política nova sem teste de isolamento **quebra o build**, e é assim que tem que ser.
- Não reaproveitar a tela do caixa: ela compõe seis coisas que o profissional não pode ver.

---

## B-01 · A frase que nomeia o conflito

**Objetivo.** A `/precos` diz, com fonte datada, por que quem dá a agenda de graça não pode mostrar
o que ela custa.

**Critério de aceite**

1. Uma linha nova na tabela comparativa do `docs/48` §Fase 4: **"Mostra quanto a forma de pagamento
   custou no seu mês"**, com fonte e data de acesso por concorrente, como o `L-08` já exige.
2. A linha sobre o CICLO só entra se for verdadeira **numa conta que respondeu a taxa** — não "em
   tese", e não antes de `A-01` estar no ar.
3. **Não responder número de marketing com número de marketing** (`docs/50` §5.6). Nada de "economize
   30%". O único número honesto é o do salão de quem está lendo, e ele não existe antes do cadastro.
4. `home-nao-promete-demais` e `precos-compara-com-honestidade` continuam passando.

**Armadilhas.**
- **A porta não promete o que a conta nova não mostra.** As `0066`-`0072` continuam sem estar em
  produção `[M]` (`docs/51` §5.2 item 1). Enquanto não estiverem, este ticket **não pode ser feito**
  — é a mesma decisão que segurou o `L-04`/`L-08`, pelo mesmo motivo.
- Afirmação datada sobre produto de concorrente numa página pública é **declaração da empresa**, e
  essa é do dono, não do executor (`docs/51` §5.4).

---

## D-01 a D-05 · A cadeira vazia com piso — **desenhados, não detalhados**

Ficam propositalmente em esboço: D depende de A funcionar numa conta real e da validação de campo.
Detalhar cinco tickets antes disso é planejar sobre premissa não testada, que é o erro que o
`docs/51` §0 documenta.

O contrato mínimo, para quem for detalhar depois:

1. A ocupação por faixa de horário sai do que já existe (`appointments` + expediente), sem tabela
   nova até que a medição prove que precisa.
2. **O piso é obrigatório e vem do custo completo.** Sugestão sem piso é precificação no escuro e
   não passa.
3. A tela lidera com o **fato** ("terça 14h vazia há 6 semanas"), nunca com o preço.
4. Nada é aplicado sem confirmação humana. `[V]` se for.

---

## G-00 a G-04 · O agente de IA no WhatsApp com o ritmo do cliente — **desenhados, atrás do F0**

Ficam em esboço pelo mesmo motivo de D, e mais um: G não tem canal. Nenhuma linha de execução entra
antes do F0 estar ligado em produção (`docs/25`, credencial confirmada + disparo de teste +
`schedule` de `reminders`/`campaigns` ativo).

O contrato mínimo, para quem for detalhar quando o F0 estiver resolvido:

1. **G-00 · Portão.** Confirmar, por consulta em `messages` e `/api/health`, que `reminders` e
   `campaigns` estão rodando de verdade em produção — não só que a credencial existe. Sem isto,
   nenhum ticket seguinte começa.
2. **G-01 · O roteiro reaproveita o catálogo do assistente interno.** `server/assistente/ferramentas.ts`
   já resolve agenda, cliente, serviço e orçamento com a regra "número nunca vem do modelo, só de
   consulta real" (`docs/26`). O agente de WhatsApp usa o mesmo catálogo, nunca um caminho paralelo
   que acessa o banco direto — a mesma exigência de RLS de sempre.
3. **G-02 · O ritmo do cliente entra na conversa como contexto, nunca como decisão automática.**
   Quando `client_cycles.state` daquele cliente for `late`/`at_risk`/`lost`, a IA pode nomear isso
   na saudação. **A IA nunca decide sozinha oferecer desconto, remarcar sem pedir ou confirmar
   presença por conta própria** — o mesmo veto de precificação e de ação automática vale aqui.
4. **G-03 · Medir a diferença antes de declarar vitória** (ataque 2 da §3.4). Taxa de resposta e de
   conversão da conversa com ritmo do cliente vs. sem, antes de qualquer copy pública dizer que o
   CICLO "sabe quando seu cliente vai sumir" pelo WhatsApp.
5. **G-04 · Herdar as duas travas do F0 sem exceção.** Teto diário por tenant e interruptor de
   pausa (`tenants.settings.messaging.paused`) cobrem o agente do primeiro commit — nunca depois.

---

# 5 · O que NÃO fazer, e por quê

1. **Não tentar ser o grátis.** A InfinitePay entrega agenda + link + sinal + lembrete de graça
   para 6 milhões de comerciantes em 100% das cidades desde 19/01/2026 `[P]`. Competir em preço com
   quem subsidia pela taxa é escolher o campo onde se perde por definição — o mesmo erro do
   candidato A do `docs/46`.
2. **Não construir benchmark entre salões**, nem anonimizado. Rejeitado no `46`, e a rejeição
   endureceu: Zenoti publica benchmark de 30 mil negócios, Simples Agenda declara 250 mil, o CICLO
   tem zero pagantes `[M]`.
3. **Não construir vitrine, diretório ou app do cliente.** Veto permanente com guarda
   (`pagina-do-negocio-e-so-dele`). Barberia.io e BestBarbers venderem app de marca própria não
   reabre a discussão.
4. **Não pedir credencial de maquininha para ler a taxa** (V10 do `52`). A força do A vem de o
   CICLO **não** estar ligado ao fluxo de dinheiro. Ler a taxa pela API do processador troca o
   fosso por conveniência.
5. **Não vender o cofre clínico como diferencial.** Agendiva já entrega anamnese com assinatura
   digital em todos os planos e estoque com lote `[P]`. O CICLO está **atrás** ali, não à frente.
6. **Não sugerir preço automaticamente**, em lugar nenhum, nem em D. Continua vedado.
7. **Não reconstruir previsão retroativa** para engordar a prestação de contas (`docs/50` §5.4).
8. **Não prometer canal** enquanto o F0 estiver parado — e observar que a InfinitePay **manda
   lembrete** e o CICLO não. Isso é motivo para o dono ligar o F0, nunca para o produto prometer o
   que não faz.
9. **Não repetir a frase "0 de 27 não mostram lucro".** Ela está errada (`52` §4.1). A frase certa
   é *"nenhum dos 31 desconta a taxa nem o custo fixo, e a líder mundial cortou a versão dela em
   abril de 2022"* — e essa precisa da fonte junto.
10. **Não escrever uma linha de código do agente de WhatsApp (G) antes do F0 estar confirmado
    rodando em produção.** Não é questão de prioridade, é questão de existência: sem o `schedule`
    ligado, não há canal para testar, e trabalho de qualidade investido num tubo fechado é
    exatamente o risco que a §1.1 nomeia.
11. **Não lançar G sem o dado do Motor de Ciclo na conversa.** Um agente genérico de agendamento
    por WhatsApp é `1→n-paridade` sem exceção nenhuma (`52` V7) — a única razão de construir é a
    condição da §1.1, e ela não é opcional no escopo.

---

# 6 · Validação de campo — o `L-05`, corrigido

O `docs/50` L-05 continua não feito (`docs/51` §5.2 item 4) e **sobe de posição**: nesta rodada ele
não é só a coisa mais barata que derruba a tese — ele testa a premissa exata de que o candidato A
depende.

**Três conversas de ~40 minutos, com donos que não conheçam o produto. Roteiro fixo, nesta ordem,
sem explicar o CICLO antes.** As quatro primeiras são as do `L-05`, na íntegra. A quinta é nova.

1. *"Quanto sobra de um corte aqui?"* — anotar a resposta literal e **o tempo até responder**.
2. *"Como você sabe disso?"* — planilha, caderno, cabeça, não sabe.
3. *"Quanto a maquininha cobra de você no crédito?"* — **esta é a premissa central do `docs/48`
   §Fase 3 e de todo o candidato A.** Anotar se respondeu de cor, se procurou, ou se não sabe.
4. *"O que esse serviço gasta de produto?"* — testa a premissa do `L-03`.
5. **Nova:** *"Se eu te dissesse quanto a maquininha levou do seu mês passado, isso mudaria alguma
   coisa?"* — e, **só se ele perguntar de volta**, dizer que é possível. Não mostrar tela.
6. Só então mostrar a tela do "Sobrou" e perguntar o que ela mudaria na semana dele.

**Entregável:** um `docs/54-VALIDACAO-CAMPO.md` com as respostas **literais, não interpretadas**, e
uma seção final dizendo **qual premissa caiu**.

**Os dois portões, decididos agora para não serem negociados depois:**

- Se **nenhum dos três** souber a taxa de cor, o `docs/48` §Fase 3 precisa ser corrigido por
  escrito, e o A-01 muda de forma antes de ser construído.
- Se **nenhum dos três** reagir à pergunta 5, o candidato A perde a aposta e **D sobe**, porque
  cadeira vazia é uma dor que o dono sente sem precisar de explicação.

**Armadilha, a mesma do `L-05`:** não mostrar a tela antes das cinco perguntas. Mostrar primeiro
contamina as respostas e transforma validação em demonstração.

---

# 7 · Onde este plano diverge do `docs/45`/`46`, e por quê

| O que o `45`/`46` decidiu | O que este plano faz | Por quê |
|---|---|---|
| O fosso é **custo de troca** por acumulação (previsão + calibração por salão) | **Mantido, sem alteração.** É a resposta da pergunta 1 do `52` | Nada nesta pesquisa o derrubou. E ele já está gravando `[M]` |
| Benchmark entre salões: rejeitado porque o líder vence por volume | **Mantido, e reforçado** com números novos (30 mil / 250 mil / 6 milhões vs. zero) | A assimetria piorou, não melhorou |
| Portabilidade radical: rejeitada porque a LGPD já obriga | **Mantido** | Nada mudou |
| Previsão de no-show: rejeitada porque o fosso seria "prevemos e eles não" | **Mantido** | E o `core/risk/no-show-score.ts` já existe e é usado na agenda `[M]` — não é candidato, é feature entregue |
| **O poder é acumulação, não posição** (`46` §Fase 3.2: *"isto não é counter-positioning"*) | **Divergência: esta rodada acha um counter-positioning de verdade** — o do fluxo de pagamento (`52` pergunta 4) | O `46` estava certo sobre a **previsão**: nada prende o líder ali. Sobre a **taxa**, prende: a receita do processador é o custo do lojista. É um poder diferente, num eixo diferente, e os dois convivem |
| A frase de dez segundos é *"o sistema aprende de quanto em quanto tempo os SEUS clientes voltam"* | **Não substituída.** A frase desta rodada é sobre a taxa, e é a **segunda** | Trocar a manchete de maior atenção por outro diferencial não é ganho — é a lição do `docs/43` §7, medida em pixels |
| A missão original (Parte 2) descarta todo candidato `1→n-paridade` como "não é vantagem — é feature" | **Divergência explícita, por decisão do dono em 2026-09-06 (§1.1):** um candidato `1→n-paridade` pode entrar no plano como **aposta de execução**, se a diferença de qualidade estiver amarrada a um dado que o concorrente não tem. É o candidato **G** | O `docs/52` §6 V7 (IA no WhatsApp) continua reprovado como **vantagem estrutural** — essa parte da Parte 2 não mudou. O que mudou é que este plano passa a registrar uma segunda categoria, tratada com rótulo próprio, em vez de forçar G para dentro do selo de "vantagem" ou descartá-lo por completo |

**Nenhum candidato deste plano contradiz uma decisão de `docs/DECISOES.md`.** Conferido `[M]`: o
veto de vitrine (2026-09-05) segue intocado e é reafirmado no §5.3; a decisão do `L-10` sobre o
`manager` e a concentração por profissional (2026-09-06) não é tocada pelo C-01, que trata de
comissão própria e não de relatório de equipe; nada aqui reativa cron de produção, nada aqui muda
preço, nada aqui envolve MEI ou Pix Automático.

---

# 8 · Como saber que funcionou

Não é "os tickets fecharam". São cinco perguntas, com medição:

| Pergunta | Como medir |
|---|---|
| O EiBarber faz isto? | A-00, com data de acesso. **É o único portão que pode invalidar a rodada inteira** |
| O dono sabe a taxa de cor? | Pergunta 3 do §6, três respostas literais |
| O número apareceu para alguém? | % de tenants ativos com ≥1 forma de pagamento respondida **e** ≥1 mês com `fee_cents` somado |
| O número virou decisão? | Alguma mudança de forma de pagamento aceita, ou de mix, **depois** de o dono ver o bloco — e isso só se descobre perguntando |
| O profissional confere sozinho? | C-01 no ar, e a frase do `docs/50` L-10.3 verdadeira |

E uma sexta, que só o tempo responde: **em doze meses, a série do `0071` com a taxa quebrada por
forma é a curva que nenhum concorrente pode desenhar** — o que não processa não tem o custo, e o
que processa não pode mostrá-lo. Ela não precisa de mais nenhum ticket. Precisa de uso.

---

# 9 · Estado do repositório para quem for executar

- Branch base: **`lucro/custo-que-o-ciclo-inventou`** (PR #76, aberto), que contém
  `vantagem/fosso-competitivo` (PR #75, aberto) inteira. `main` está 59 commits atrás e **não tem
  nada desta série** `[M]`. Ramificar de `main` refaz o erro que o `docs/51` §3 `[D]` 1 já pagou.
- **As migrations `0063` a `0072` não estão aplicadas em produção** `[M]`. `compararSchema`
  (`core/schema/versao.ts`) vai acusar "banco ATRÁS do código". Aplicar **antes** do deploy é a
  ordem segura — o código novo lê colunas que o banco não tem, e a ordem errada quebra o app.
- `pnpm verify` roda typecheck, lint, `test:unit`, `test:integration`, `test:rls` e build. Os dois
  do meio precisam de Supabase local (Docker); sem Docker a CI é o único lugar onde rodam.
- A CI reprova por FK sem índice, por tabela nova sem RLS e por guarda de varredura. Nenhuma é
  opcional.
- Ao apendar em `docs/DECISOES.md`: **rebasear antes de abrir o PR**. Todos apendam no fim e dois
  PRs abertos conflitam sempre.
