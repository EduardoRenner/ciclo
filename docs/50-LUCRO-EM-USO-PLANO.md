# 50 · O LUCRO EM USO — PLANO (só plano)

> **Para quem chega frio.** Este documento é uma especificação de execução. Quem for executá-lo
> não precisa da conversa que o gerou, mas precisa ler, nesta ordem:
> `CLAUDE.md` → `docs/47-INOVACAO-PESQUISA.md` → `docs/48-INOVACAO-PLANO.md` →
> `docs/49-INOVACAO-EXECUCAO.md`. Este é o sucessor do `49`.
>
> **Nada aqui foi implementado.** É plano.

| Tag | Significado |
|---|---|
| `[M]` | Medido no código/banco em 2026-09-06 |
| `[E]` | Estimativa — não vira fato por repetição |
| `[V]` | Fere veto de projeto |

---

# 0 · O estado medido, em uma página

A rodada `47`/`48`/`49` mudou a tese do produto: de *"SaaS de agendamento com CRM"* para *"o
sistema que mostra quanto cada cliente deixa de lucro e avisa antes de você perder ele"*. Nove
tickets entregues na branch `vantagem/fosso-competitivo` `[M]`:

| Onde | O que passou a existir |
|---|---|
| Fechamento de comanda | Forma de pagamento obrigatória; `tickets.fee_bps`/`fee_cents` congelados (`0066`) |
| Custo de serviço | Sai da ficha de consumo × `products.avg_cost_cents`, e a ficha ganhou tela |
| Comanda fechada | "Sobrou" por atendimento + o que ainda falta descontar, atrás de `report:read` |
| Ficha do cliente | *"Vem a cada 18 dias, veio faz 31"*; "Sobrou" e lucro projetado por ano |
| Caixa | Quadro "Taxa" de volta; concentração de lucro por profissional |
| `config/planos` | Margem por assinante do clube, no ciclo de cobrança |
| `admin/recuperar` | Fila ordenada por **lucro** em risco (`0067`); prestação de contas do Motor |

Módulos de regra pura criados: `core/comanda/taxa-de-pagamento.ts`,
`core/comanda/custo-do-servico.ts`, `core/comanda/sobra-explicada.ts`,
`core/ciclo/ritmo-do-cliente.ts`, `core/caixa/concentracao.ts`,
`core/loyalty/margem-do-clube.ts`, `core/crm/lucro-do-cliente.ts`,
`core/cycle/prestacao-de-contas.ts`, e `lucroEsperadoCents`/`lucroEmRiscoCents` em
`core/cycle/valor-em-risco.ts`.

---

# 1 · O diagnóstico, e ele é o plano inteiro

**O mecanismo existe e nasce vazio.**

As três entradas de que o lucro depende não têm valor em nenhum tenant hoje `[M]`:

| Entrada | Estado em produção | Consequência na tela |
|---|---|---|
| `tenants.settings.payment_fees_bps` | **nunca preenchida** — a tela nasceu na `I-01` | Caixa mostra a faixa *"o Sobrou ainda não desconta a maquininha"* |
| `service_products` (ficha de consumo) | **vazia** — a tela nasceu na `I-02b` | Comanda mostra *"falta descontar o produto"* |
| Comissão por profissional | Preenchida só onde o dono cadastrou time | Lucro de salão de uma pessoa já está certo |

Ou seja: **hoje, para todo mundo, as nove telas novas dizem que estão incompletas.** Isso é o
comportamento correto — foi desenhado assim, e o `48` §Fase 3 chama de *estado incompleto honesto*.
Mas é também o retrato exato do risco: um produto que muda de categoria e chega ao dono dizendo
"me diga três coisas primeiro" não muda categoria nenhuma; ele vira uma tela de configuração a
mais que ninguém preenche.

**A rodada anterior construiu a vantagem. Esta faz ela existir na vida de alguém.**

Por isso este plano tem três eixos, nesta ordem de dependência:

1. **Ativação** — fazer o dado entrar, sem pedir o que o dono não sabe.
2. **Porta** — a tese aparecer antes da assinatura, não depois.
3. **Composição** — o número virar decisão, e o histórico virar custo de troca.

Fazer 2 antes de 1 é vender uma tela que vai dizer "falta descontar o produto" no primeiro dia de
uso. Fazer 3 antes de 1 é otimizar um número que ainda é zero.

---

# 2 · Os candidatos, e a tabela que não deixa escolher por gosto

Restrições decididas **antes** de gerar a lista, herdadas do `46`/`48`:

- veto permanente de nunca mostrar concorrência ao cliente final do salão;
- nada que dependa de F0 (WhatsApp ligado) — continua parado e fora do controle do time;
- nada que exija número que o produto não tem como saber (o `48` §Fase 3, literal: *estado
  incompleto honesto, nunca número inventado*);
- **nada que peça ao dono o que a pesquisa diz que ele não sabe** — `47` P02: 73% não sabem
  calcular o custo de um serviço.

| # | Candidato | Eixo | Depende de | Custo `[E]` | Valor se der certo | Risco |
|---|---|---|---|---|---|---|
| **A** | Completude do lucro como primeiro passo em "Hoje" | Ativação | nada | 2 tickets | **Alto** — é o gargalo de todos os outros | Virar mais um alarme ignorado |
| **B** | Ficha de consumo semeada pelo pack da profissão | Ativação | A | 2-3 tickets | Alto — troca "digite" por "confira" | Semear custo inventado `[V]` |
| **C** | Primeira dobra e demo falando de lucro | Porta | A | 2 tickets | Alto — muda a pergunta na porta da barbearia | Prometer o que a conta nova não mostra |
| **D** | `/precos` com a tabela comparativa do `48` §Fase 4 | Porta | C | 1-2 tickets | Médio-alto | Afirmação sobre concorrente sem fonte datada |
| **E** | "Por que sobra pouco": a razão ao lado do número | Composição | A+B | 2 tickets | Alto — número vira decisão | Sugerir preço sozinho `[V]` |
| **F** | Resumo do mês do dono (os cinco números da tese) | Composição | A | 2 tickets | Alto — é o artefato que ele mostra pra alguém | Virar relatório que ninguém abre |
| **G** | Série mensal de lucro por salão (o fosso que acumula) | Composição | A+F | 2 tickets | Médio hoje, **alto em 12 meses** | Nada — só tempo |
| **H** | Papéis mais finos para dado sensível | Risco | nada | 1-2 tickets | Médio — evita dano social | Travar demais e o dono não ver o próprio negócio |
| **I** | Validação com 3 donos reais | Prova | A+C | 0 tickets de código | **Alto** — é a única coisa que derruba a tese cedo | Nenhum |
| **J** | C8 · preço sugerido para horário ocioso | — | tudo acima | 4-5 tickets | Alto | Precificar sem pedido `[V]` se mal desenhado |

## A escolha

**A → B → C → I → E → F → D → G → H.** J continua adiado, pelo mesmo motivo do `48`.

**Por quê nessa ordem, em uma linha cada:**

- **A e B primeiro** porque tudo depois deles mostra "falta descontar" sem eles.
- **C antes de E/F** porque a tese precisa chegar em alguém para valer a pena refinar.
- **I logo depois de C**, e não no fim: três conversas de 40 minutos com dono de salão derrubam ou
  confirmam a tese mais rápido que seis tickets. O `48` §Fase 3 já nomeou a fragilidade (custo
  desconhecido) e mandou testar com cliente real. **Continua sendo a primeira coisa a testar.**
- **G por último dos que entram** porque ele é o único que fica melhor sozinho, com o tempo.
- **H fora da fila principal** porque é seguro fazer a qualquer momento e não bloqueia nada.

---

# 3 · Red team — as quatro coisas que derrubam este plano

### 1. "Completude" vira mais um alarme que ninguém lê

É o risco real de A. Esta base já documentou o mecanismo: *"alarme que sempre toca deixa de ser
lido"* (`core/cron/agendadas.ts`, e o `/api/health` que devolvia 503 por meses).

**A mitigação tem que estar no desenho do ticket, não na boa intenção:** a ação de completude
**some quando respondida** — inclusive respondida com zero. Um salão que só recebe em dinheiro e
Pix respondeu, e para ele o assunto acabou. Se o card continuar lá, o plano falhou.

### 2. Semear ficha de consumo é semear custo inventado

É o risco real de B, e ele é fatal se mal desenhado. O pack da profissão **não pode** semear
`products.avg_cost_cents` — ninguém sabe quanto aquele salão paga na tinta.

**O que o pack pode semear:** o *nome* do produto e a *quantidade* típica na ficha (30 ml de
oxigenada por coloração é conhecimento de ofício, não preço). O custo continua vindo da compra que
o dono registra. E a tela precisa continuar dizendo *"N produtos da ficha não têm custo
registrado"*, que já existe desde a `I-02b`.

Dito de outro jeito: o pack responde *"o que esse serviço gasta"*; só o dono responde *"quanto
você pagou"*. Misturar os dois é a coisa que este plano mais precisa não fazer.

### 3. A porta promete o que a conta nova não mostra

É o risco de C e D. Hoje, uma conta recém-criada abre o caixa e vê "o Sobrou ainda não desconta a
maquininha". Se a landing disser *"veja quanto sobra de cada corte"*, a primeira sessão desmente a
primeira dobra — e a guarda `home-nao-promete-demais` existe exatamente para essa família.

**Mitigação:** C só entra depois de A, e a copy da porta tem que ser verdadeira no minuto 1 de uso.
A frase segura é a que descreve o que o produto **pergunta**, não o que ele já sabe: *"o CICLO
pergunta três coisas e passa a mostrar quanto sobra de cada atendimento"* é honesto; *"veja quanto
sobra"* só fica honesto depois que A e B funcionam.

### 4. O plano inteiro é sobre um produto que nenhum dono usou ainda

A rodada `49` entregou nove telas que **nenhum dono de salão viu**. Este plano propõe mais nove.

**É o argumento mais forte a favor de I subir na fila** — e o item I não é ticket de código, é
trabalho de campo. Se as três conversas disserem que o dono não liga para lucro por atendimento e
quer mesmo é agenda cheia, este plano inteiro muda, e é melhor descobrir isso antes de E, F, G.

---

# 4 · Os tickets

> Convenção: cada ticket tem **objetivo**, **critério de aceite** (o que precisa ser verdade),
> **onde mexer** e **armadilhas**. O executor decide o desenho; o critério é o contrato.
>
> Vale para todos: um ticket, um commit, mensagem em português (`CLAUDE.md` §12). `pnpm verify`
> antes de cada commit. Teste-guarda novo **precisa ser visto reprovando** — o procedimento de
> mutação do `CLAUDE.md` não é opcional.

## L-01 · A completude do lucro entra em "Hoje"

**Objetivo.** O dono descobre o que falta para o "Sobrou" ficar verdadeiro no lugar onde ele já
olha todo dia, e não numa tela de configuração que ele nunca abre.

**Critério de aceite**

1. `centralDeAcoes` (`server/services/crm.ts`) passa a produzir até duas ações novas:
   - *"Você ainda não disse quanto a maquininha cobra"* → `/admin/config/taxas`, quando
     `taxaEstaConfigurada(settings)` é falso;
   - *"N serviços ainda não têm ficha de consumo"* → lista de serviços, quando existir serviço
     ativo sem linha em `service_products`.
2. **As duas somem quando respondidas, inclusive com zero.** Salão só de dinheiro e Pix que salvou
   a tela de taxas nunca mais vê a primeira; salão que preencheu todas as fichas nunca mais vê a
   segunda.
3. Nenhuma das duas aparece para quem não tem `report:read` — é dinheiro do negócio.
4. Nenhuma das duas aparece em conta que ainda não começou (o ramo `PRIMEIROS_PASSOS` continua
   ganhando): pedir ficha de consumo para quem não tem cliente é ruído.
5. Guarda: um teste que reprove se a ação continuar sendo produzida com a resposta dada.

**Onde mexer.** `server/services/crm.ts` (`centralDeAcoes`, `PRIMEIROS_PASSOS`),
`core/comanda/taxa-de-pagamento.ts` (só leitura, já pronto).

**Armadilhas.** `centralDeAcoes` já faz oito consultas num `Promise.all` — as novas entram lá, não
em série. E "serviço sem ficha" é `count` por `service_id`, não `select` das linhas.

---

## L-02 · O caixa e a comanda levam até a resposta em um toque

**Objetivo.** Fechar o laço que a `I-01`/`I-03` abriram: a faixa que diz o que falta já existe; o
que falta é ela custar um toque, não uma caçada.

**Critério de aceite**

1. A faixa do caixa (`admin/caixa/caixa.tsx`) e a da comanda (`admin/comanda/[id]/comanda.tsx`)
   levam direto à tela que resolve — a de taxa já leva; a de ficha leva para a lista de serviços,
   e deveria levar para **a ficha do serviço daquela comanda**.
2. Depois de responder, voltar para a tela de origem, não para o hub.
3. Nenhuma faixa nova: as duas já existem. Este ticket é sobre o destino delas.

**Armadilhas.** `toque-48` em dois links que dividem linha de texto corrida deixa o segundo
intocável — medido em `/cadastro` (`CLAUDE.md`). Se a faixa ganhar dois destinos, eles não podem
dividir linha.

---

## L-03 · O pack da profissão semeia a ficha de consumo (o que gasta, nunca quanto custa)

**Objetivo.** Trocar "digite a ficha de cada serviço" por "confira a ficha que já veio", sem
inventar preço.

**Critério de aceite**

1. Os packs de profissão (`0057_packs_hair_tattoo_general.sql` e o catálogo em `core/`) passam a
   carregar, por serviço, uma lista de `(nome do produto, quantidade típica, unidade)`.
2. No onboarding, esses produtos são criados com `avg_cost_cents = 0` e `is_retail = false`, e a
   ficha é criada com as quantidades do pack.
3. **Nenhum custo é semeado.** A tela de ficha continua dizendo *"N produtos da ficha não têm
   custo registrado"* até o dono registrar a compra.
4. Guarda: um teste que reprove se algum pack semear `avg_cost_cents` diferente de zero.
5. O dono pode apagar linha da ficha semeada sem que ela volte no próximo login.

**Onde mexer.** `supabase/migrations/` (migration nova, não editar a `0057` aplicada),
`server/services/onboarding.ts`, `core/` do catálogo de profissões.

**Armadilhas.** Seed que parece certo e é absurdo no agregado é falha conhecida desta base: medir a
distribuição, não só `count(*) > 0`. E semear produto de insumo com `is_retail = true` faria ele
aparecer para venda no balcão a preço nulo — a `adicionarItemComanda` já recusa isso, mas o item
apareceria na lista.

---

## L-04 · A primeira dobra muda de agenda para resultado

**Objetivo.** O `48` §Fase 4 diz que a mudança de categoria muda a primeira dobra, a demo e a
pergunta do vendedor — *de "como você organiza os horários?" para "você sabe quanto sobra de cada
corte?"*. Hoje a landing ainda vende agenda + Motor de Ciclo.

**Critério de aceite**

1. A primeira dobra de `src/app/page.tsx` fala de **resultado**, não de organização.
2. A frase é verdadeira no minuto 1 de uso de uma conta nova. Descrever o que o produto
   **pergunta** é honesto; afirmar que ele já sabe, antes de `L-01`/`L-03`, não é.
3. A demo embutida na landing mostra o "Sobrou" com as três parcelas (material, taxa, comissão),
   e os números batem com o que `/admin/comanda/[id]` desenha de verdade.
4. `home-nao-promete-demais` continua passando — e se a copy nova falar de módulo pago, ela nomeia
   o degrau. **Atenção:** a palavra "comissão" dispara a regra do módulo `team` naquela guarda; a
   `I-07` já enfrentou isso e resolveu com *"o que sai para quem atende"*, porque a ordenação por
   lucro não depende do módulo. Se a copy nova de fato depender, nomeie o plano.

**Armadilhas.** A landing tem guarda de tempo prometido, de módulo pago e de preço em um lugar só.
Ler as três antes de escrever.

---

## L-05 · Validação com três donos de salão (sem código)

**Objetivo.** Descobrir cedo se a tese vale — e não depois de mais nove tickets.

**Critério de aceite**

1. Três conversas de ~40 minutos com donos de salão/barbearia que **não** conheçam o produto.
2. Roteiro fixo, na ordem, sem explicar o CICLO antes:
   - *"Quanto sobra de um corte aqui?"* — anotar a resposta literal e o tempo até responder;
   - *"Como você sabe disso?"* — planilha, caderno, cabeça, não sabe;
   - *"Quanto a maquininha cobra de você no crédito?"* — a premissa do `48` é que todo dono sabe
     de cor. **Esta pergunta testa a premissa central do plano anterior**;
   - *"O que esse serviço gasta de produto?"* — testa a premissa do `L-03`;
   - só então mostrar a tela do "Sobrou" e perguntar o que ela mudaria na semana dele.
3. Entregável: um `docs/51-VALIDACAO-CAMPO.md` com as respostas literais, não interpretadas, e uma
   seção final dizendo **qual premissa caiu**.
4. Se nenhum dos três souber a taxa da maquininha de cor, `L-01` muda de forma e o `48` §Fase 3
   precisa ser corrigido por escrito.

**Armadilhas.** Não mostrar a tela antes das quatro perguntas. Mostrar primeiro contamina as
respostas e transforma a validação em demonstração.

---

## L-06 · "Por que sobra pouco" — a razão ao lado do número

**Objetivo.** O número vira decisão. Um serviço com margem baixa mostra **qual** das três parcelas
está comendo o lucro, e as alavancas que existem — sem escolher nenhuma.

**Critério de aceite**

1. Na lista de serviços (`admin/config/servicos`), cada serviço mostra a margem média dos
   atendimentos fechados dele, e a parcela dominante quando a margem está abaixo de um piso.
2. O texto nomeia a alavanca sem puxá-la: *"a comissão leva 60% deste serviço"*, *"o produto leva
   R$ 30 de um serviço de R$ 80"*. Nunca *"suba o preço para R$ X"* — o veto de precificação
   automática do `CLAUDE.md` vale aqui `[V]`.
3. Serviço sem comanda fechada não mostra margem nenhuma, e diz por quê.
4. Atrás de `report:read`.

**Armadilhas.** A margem por serviço tem que sair de `ticket_items` + o lucro congelado da comanda,
com o mesmo rateio da `I-05` (`core/caixa/concentracao.ts`) — recalcular por fora cria a segunda
fonte que esta base já pagou uma vez no livro-caixa.

---

## L-07 · O resumo do mês do dono

**Objetivo.** Um artefato que ele abre uma vez por mês e mostra para alguém. É o que transforma
cinco telas em uma tese.

**Critério de aceite**

1. Uma tela `/admin/mes` (ou seção do caixa) com os cinco números da tese, nesta ordem: **entrou**,
   **sobrou**, **de quem depende**, **quanto está parado em quem sumiu**, **o quanto o Motor
   acertou**.
2. Cada número leva à tela onde ele é acionável.
3. Nenhum número novo é calculado aqui: todos já existem (`resumoMensal`, `concentracaoDoMes`,
   `listarParaRecuperar`, `prestacaoDeContasDoMotor`). Esta tela **compõe**, não recalcula.
4. Onde faltar dado, a mesma regra de sempre: dizer o que falta e levar até lá.

**Armadilhas.** Cinco consultas pesadas numa tela só — todas no mesmo `Promise.all`, e a de
`cycle_predictions` já tem janela de 12 meses (`I-09` + revisão).

---

## L-08 · `/precos` ganha a tabela comparativa do `48` §Fase 4

**Objetivo.** Cinco linhas em que só o CICLO tem ✅, e nenhuma precisa de parágrafo explicativo.

**Critério de aceite**

1. A tabela do `48` §Fase 4 entra em `/precos`, com **fonte e data de acesso por linha** sobre
   concorrente. Afirmação sobre produto alheio sem fonte datada não entra.
2. As linhas sobre o CICLO só entram se forem verdadeiras **hoje, numa conta que respondeu as três
   perguntas** — não "verdadeiras em tese".
3. A guarda `precos-compara-com-honestidade` continua passando; se ela não cobrir a exigência de
   fonte por linha, este ticket a estende.

**Armadilhas.** O `47` §1.6 registra que o concorrente mais próximo ancora com *"75% de retenção vs
40% do mercado"* e *"R$ 47 mil/ano recuperados"*. **Não responder número de marketing com número de
marketing.** O CICLO não tem essa medição, e inventá-la seria exatamente o que este produto acusa o
setor de fazer. A resposta honesta é mostrar o número **do salão do próprio dono**, que nenhum
concorrente pode mostrar.

---

## L-09 · A série mensal de lucro por salão — o fosso que só o tempo dá

**Objetivo.** O `46` escolheu como mecanismo de defesa o que **acumula por salão com o tempo de
uso**, não com escala. A `I-09` fez isso para a previsão. Falta fazer para o lucro.

**Critério de aceite**

1. Uma tabela append-only com o fechamento mensal por tenant: mês, receita, material, taxa,
   comissão, sobra, nº de comandas — congelado, nunca recalculado.
2. Escrita por job mensal idempotente, e **nunca reescrita**: o mês fechado é registro contábil.
3. A tela mostra a série e a variação — *"seu lucro por atendimento subiu 12% desde março"*.
4. Nada cruza tenant. O `46` rejeitou benchmark entre salões com um argumento que continua valendo:
   mecanismo cuja força cresce com o tamanho da base é o campo onde o líder vence por definição.

**Armadilhas.** Recalcular o passado a partir de `tickets` a cada abertura da tela desfaz o ponto
inteiro — o valor está em ter congelado na época. E cron desta base atrasa horas: a rota mensal não
pode depender do relógio do disparo.

---

## L-10 · Papéis mais finos para o dado sensível

**Objetivo.** O `48` §Fase 3 nomeia o risco do C1/C7 como **social, não técnico**: o número expõe
que a comissão está alta e que o negócio depende de uma pessoa.

**Critério de aceite**

1. Revisar quem vê o quê: hoje `report:read` (owner, manager, finance) abre lucro por atendimento,
   concentração por profissional, margem do clube e lucro por cliente — tudo junto.
2. Decidir e registrar em `docs/DECISOES.md` se `manager` deve ver **concentração por
   profissional**, que é a informação mais delicada do conjunto dentro de uma equipe.
3. O profissional comissionado continua vendo o próprio extrato de comissão e nada mais.
4. Qualquer trava nova tem as duas camadas: permissão na rota **e** política de RLS.

**Armadilhas.** Travar demais é tão ruim quanto de menos: o dono precisa ver o próprio negócio, e
uma trava que o alcance vira chamado de suporte.

---

# 5 · O que NÃO fazer

1. **Não semear custo de produto.** Nunca. `L-03` inteiro depende disso.
2. **Não sugerir preço automaticamente** — nem em `L-06`, nem em lugar nenhum. C8 continua adiado.
3. **Não agregar dado entre tenants**, nem anonimizado. O `46` rejeitou com argumento estrutural.
4. **Não reconstruir previsão retroativa** para engordar a prestação de contas: previsão feita
   depois do fato não é previsão, e a série perde o único valor que tem.
5. **Não prometer canal** — nada de "você vai receber o resumo do mês por WhatsApp" enquanto F0
   estiver parado.
6. **Não responder número de marketing de concorrente com número de marketing.**

---

# 6 · Como saber que funcionou

Não é "os tickets fecharam". São quatro perguntas, respondidas com medição `[M]`:

| Pergunta | Como medir |
|---|---|
| O dado entrou? | % de tenants ativos com `payment_fees_bps` gravado e com ≥1 ficha de consumo |
| A tela parou de dizer que está incompleta? | % de comandas fechadas cujo `explicarSobra` volta sem lacuna |
| A tese chegou em alguém? | As três conversas do `L-05`, com as respostas literais |
| O número virou decisão? | Alguma mudança de preço, comissão ou ficha **depois** de o dono ver a margem — e isso só se descobre perguntando |

E uma quinta, que só o tempo responde: **em doze meses, a série do `L-09` e a prestação de contas
do `I-09` são a coisa que um concorrente não tem como copiar.** Elas não precisam de mais nenhum
ticket — precisam de uso.

---

# 7 · Estado do repositório para quem for executar

- Branch: `vantagem/fosso-competitivo`, PR aberto. `main` ainda não tem nada desta série.
- **Migrations `0066`, `0067` e `0068` não estão aplicadas em produção** `[M]`. Não existe Action
  que rode `supabase db push`; `compararSchema` (`core/schema/versao.ts`) vai acusar "banco ATRÁS
  do código" até alguém aplicar. Aplicar **antes** do deploy é a ordem segura.
- `pnpm verify` roda `typecheck`, `lint`, `test:unit`, `test:integration`, `test:rls` e `build`. Os
  dois do meio **precisam de Supabase local (Docker)**; sem Docker eles nem sobem, e a CI é o único
  lugar onde rodam.
- A CI reprova por FK sem índice, por tabela nova sem RLS e por guarda de varredura. Nenhuma delas
  é opcional.
