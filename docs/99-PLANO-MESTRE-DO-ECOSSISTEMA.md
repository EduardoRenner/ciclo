# 99 · Plano-mestre do ecossistema CICLO (v3): da ferramenta ao serviço entregue por software

Escrito em 2026-10-07, **v3 no mesmo dia** (a v3 está descrita na seção 2.5 e corrige a v2 com o que o
repositório e a concorrência já mostravam). **Rodada 2 do loop (mesmo dia):** preços ao vivo de Trinks e
BarbUp, texto oficial da Meta, regras do Pix Automático (seções 2.6, 3.6 e 4.7). A v1 juntou os `docs/97` e `98` com cobrança, agentes e
operação. **Esta v2 mescla o plano anterior ainda incompleto (`docs/91` a `96`: Motor de Retorno e
plataforma de decisão) e acrescenta a mudança de modelo que o Eduardo pediu: parar de vender a
ferramenta e passar a vender a entrega, usando o software por dentro.**

**É só plano: nenhuma linha de código deste documento foi escrita.** O destino é outra conta do
Claude, que vai estruturar o backlog inteiro e executar com todo o seu poder. Por isso o documento é
autossuficiente: traz o estado real, as regras, as decisões já tomadas, os conflitos entre planos e o
que está verificado ou não.

**Sobre uma palavra do pedido.** O Eduardo escreveu "saas e assas". Li como **"SaaS e o modelo
service-as-software"** (vender o serviço pronto, feito por software e agentes, em vez de vender a
ferramenta), e **não** como Asaas (a plataforma de cobrança). O Asaas continua no plano, mas só como
**infraestrutura de cobrança** (T6). Se a leitura estiver errada, só a seção 4 muda.

Documentos irmãos, nesta ordem: `docs/97` (esteira de dados), `docs/98` (Motor), `docs/26` (assistente
de IA: **regras de agente já decididas**), `docs/91` a `94` (Motor de Retorno e plataforma), `docs/95`
e `docs/96` (fila de chamadas e backlog), `docs/87` (cortesia), `docs/88` e `89` (custos), `docs/86`
(jurídico).

**Rótulos:** **[M]** medido ou lido no repositório · **[E]** estimado com conta · **[S]** suposto ou
de fonte externa não conferida. **Classes de decisão:** Decidido, Recomendado, Do Eduardo, Do advogado,
Bloqueado.

---

## 0. Como a outra conta deve usar este documento

1. Leia `CLAUDE.md`, `docs/00-BRIEFING.md` e **todos** os documentos irmãos acima, **inclusive os
   `docs/91` a `96`**, que são o plano que esta v2 mescla. **Não execute nada antes.**
2. Crie `docs/100-BACKLOG-MESTRE.md` no formato de `docs/96`: um ticket por item, com id, trilha (T1 a
   T11), dependências, critério de aceite verificável, prova (teste, mutação, navegador a 390 px) e a
   classe de decisão. **A estrutura do backlog é o primeiro entregável** e passa pela revisão do
   Eduardo antes de qualquer código.
3. **Resolva os conflitos da seção 2.3 antes de montar o backlog** (são decisões de preço, canal e
   regra de produção). Onde faltar decisão, o ticket nasce **Bloqueado**, não adivinhado.
4. Rode as trilhas em paralelo, cada uma em worktree e branch próprios (seção 13).
5. Atualize este documento quando uma decisão mudar. Plano que diverge do código é o defeito mais caro
   deste projeto.

## 1. A tese (v2)

1. O CICLO **não é uma agenda**. É um **motor de retorno de clientes**, e agenda é só o chão.
2. O mercado de salão é dominado por agenda e reserva; **retenção automática é o elo fraco de todos**
   (seção 3). O espaço está pouco ocupado.
3. O motor só é bom se **come qualquer dado** (`docs/97`), **prova que acerta** (`docs/98`) e
   **fecha a volta** (entra o dado, prevê, alguém age, mede, aprende, e o dono pode sair levando tudo).
4. **Mudança de modelo (v2):** o dono de salão **não quer software, quer o cliente de volta**. O
   mercado de software está migrando de "vender a ferramenta" para **"vender o trabalho feito, com IA
   por dentro, e cobrar pelo resultado"** (seção 3.3). O CICLO tem as três peças que isso exige: um
   motor que decide, uma fila que executa e uma **atribuição que mede**. **A oferta passa a ser uma
   escada de três degraus: Ferramenta, Assistido, Entregue** (seção 4).
5. **Agentes entram onde reduzem o trabalho de quem opera sem decidir por ninguém** (seção 7). O
   operador do serviço entregue é uma pessoa **supervisionando** um agente. A decisão de `docs/26`
   (assistente que propõe, pessoa aprova) continua de pé.
6. Tudo isso só vale se **cobrar for simples, confiar for possível e operar for barato** (T6, T9, T10).

## 2. O estado real (verificado em 2026-10-07)

### 2.1 O que existe

**Na `main`** [M]: Motor de Ciclo v1; **fila de chamadas** (um cliente por vez, WhatsApp do próprio
dono, link de agendamento com clique medido); perfil e nota do cliente; importação de CSV; exportação de
clientes em CSV; assistente de IA (Gemini, desligado sem a chave); mensageria e entrada de WhatsApp;
push; crons de lembrete, campanhas, segmentos e recálculo de ciclos; cobrança por Mercado Pago
(assinatura com cartão, webhook, cancelamento).

**Em PRs abertos, nada fundido** [M]:
- **#143** (`feat/cortesia-2026-10-03`): cortesia e faixa, **pausa que trava toda rota de escrita**,
  link público de negócio pausado, cancelar mantendo o mês pago, **`ACESSO_ABERTO` ligado** (toda conta
  usa tudo, sem pagar), `docs/97` a `99`.
- **#144** (`feat/juridico-2026-10-03`): inventário de dados, mapa de operadores, política gerada do
  código, aviso na página pública, reaceite dos termos, minutas jurídicas (fora do ar).
- **#142** (outra conta): textos de volta por perfil.
- Ao fundir #143 e #144: a rota `POST v1/legal/accept` precisa de uma linha `'permite'` em
  `core/billing/pausa.ts`, e há conflito de uma linha em `tests/unit/core/versoes-legais.test.ts`.

### 2.2 O plano anterior (`docs/91` a `96`) e o quanto já foi feito

| Peça do plano anterior | Estado [M] |
|---|---|
| **Fila de chamadas** (E0 a E3 do `docs/96`): sem seleção em lote, link de agendamento com clique, fila de um por vez, ordenação por lucro × nota, "pediu para não ser chamado" | **no ar** (#135 a #141) |
| Perfil e nota do cliente, calculados todo dia | no ar (#137) |
| Textos por perfil e "chamada que guarda o texto e a nota" | **PR #142 aberto** |
| Pendentes do `docs/96`: assistente mandar o link (E1.6), "VIP" (E2.6), ordenar por mais campos (E2.5), teto diário (E2.3) | a fazer |
| **Consentimento** com prova (`consents` append-only, link pessoal) | **não existe** |
| **Base de medição** com braço de controle (`message_exposures`, `return_outcomes`) | **não existe** (existe atribuição por clique em `messages`) |
| **Canal oficial** (API do WhatsApp via BSP, coexistência) | **não existe**; ficou **adiado** |
| Central de Decisões, casamento vaga × cliente, segunda visita, ciclo de obrigação | não existe |
| Modelo hierárquico, benchmark entre salões, uplift, bandido | **não existe e está bloqueado** (advogado, RIPD, ~30 negócios) |
| **Cobrança por resultado** | **foi cortada** no `docs/94` (seção 2.4) |

### 2.3 Conflitos entre os planos (resolver antes do backlog, **Do Eduardo**)

| # | Conflito | Onde | Leitura mais provável |
|---|---|---|---|
| C1 | **Canal:** `docs/91` quer API oficial; `docs/95` decidiu **reativação manual, sem API por enquanto** | 91 × 95 | vale o 95 (é o mais novo); a API volta por portão (seção 4.6) |
| C2 | **Preços:** `docs/87` vende **R$ 49 (Solo) e R$ 99 (Equipe)**; `docs/94` modela **R$ 37 (básico) e R$ 149 (recuperação)** | 87 × 94 | não dá para ter os dois; o plano de R$ 149 contava com mensagens da API incluídas |
| C3 | **Decisor:** os `docs/91` a `96` citam **"Vitor"** como quem decide e faz a papelada; este plano trata o **Eduardo** | 91–96 × 99 | **confirmar se são sócios ou a mesma pessoa** e quem decide o quê |
| C4 | **Regra de produção:** nesta conversa valia "nunca escrever em produção, nunca fundir, nunca `db push`"; o `docs/96` descreve CI verde, **auto-merge e migrations aplicadas em produção antes do código** | 96 × conversa | **perguntar qual vale** antes de tocar em produção |
| C5 | **Cobrança por resultado:** cortada no `docs/94`; esta v2 a **reintroduz de forma híbrida e com portões** | 94 × 99 | decisão deliberada, explicada na seção 4.5 |
| C6 | **Datas:** alpha 26/10, pública 09/11 e oficial 11/01/2027 vêm do `docs/87` e **perderam o sentido com o acesso aberto** | 87 × #143 | redefinir |
| C7 | **Guarda de valor do Mercado Pago:** o código exige que o valor autorizado **bata com o preço do plano** (`valorConfereComDegrau`). Uma cobrança **variável** (base + resultado) **quebraria essa guarda** | código × 99 | a cobrança variável **não** pode usar a assinatura do MP (seção 4.7) |

### 2.4 Por que o `docs/94` cortou a cobrança por resultado (e por que a v2 a traz de volta com cuidado)

O `docs/94` diz que ela "exige medição causal sólida por salão, que não existe com ~100 sumidos por
mês" [M]. É verdade: um salão pequeno não tem volume para provar, sozinho, que a mensagem causou a
volta. **A v2 não tenta resolver isso por salão.** Ela (a) cobra sobre uma **linha-base contratual**
em vez de uma medição causal individual, (b) mede o efeito **agregado** com um braço de controle de
**todos** os salões atendidos, (c) usa preço **híbrido** (a parte fixa cobre o custo) e (d) só liga a
parte variável depois de portões (seção 4.5). **Se esses portões não forem cumpridos, a v2 concorda
com o `docs/94`: não cobrar por resultado.**

### 2.5 O que já estava decidido e a v2 ignorou (a v3 corrige; **não reabrir sem evidência nova**)

Lidos hoje em `.claude/ciclo/` (`growth-opportunities.md`, `competitive-gaps.md`,
`market-intelligence.md`, `competitors/*`), `docs/43`, `45`, `83` e `DECISOES.md`:

| # | O que já estava decidido | Onde | O que muda neste plano |
|---|---|---|---|
| D1 | **A migração nunca pode ser barreira de pagamento.** A linha "migração assistida R$ 199" é **obsoleta**. Decidido: **1 mês do Essencial para quem importa com a data da última visita**, e o Eduardo **importa pelo WhatsApp as primeiras contas** | `docs/83`, decisões de 28/09 | **A v2 oferecia "taxa única pequena" no degrau 2. Removida.** O degrau 2 é **sempre grátis** |
| D2 | **Migração grátis é o mínimo do mercado, não diferencial** (BarbUp "sem custo extra"; Belasis com gerente dedicado). O diferencial possível é **na hora, sem chamado, com o resultado do Motor no mesmo minuto** (o AppBarber leva até 5 dias úteis, sem histórico) | `docs/83` §1 do sumário | o pitch do degrau 2 é **velocidade e resultado**, não "a gente faz de graça" |
| D3 | **Veredito GO-1: "não construir mais" importação de XLSX, PDF ou print** (confiança alta). Razões: menos de **30% dos salões usam sistema** (Sebrae via UAI, 18/09/2026), o concorrente principal é **o caderno e a memória**, e o caminho principal já é `ja-atendo` (digitação assistida) | `growth-opportunities.md` GO-1 | **Conflita com a esteira do `docs/97`.** Resolução na seção 2.6 |
| D4 | **GO-0 primeiro:** o funil não está instrumentado (só `conta_criada` e mais um evento gravados em produção), então **ninguém sabe onde a ativação morre**. GO-3 e GO-4 dependem dele | GO-0 | **GO-0 vira o primeiro ticket do backlog** (T1) |
| D5 | **Nenhum item de paridade urgente:** a pesquisa não achou feature que o CICLO não tenha e cuja falta faça alguém escolher o concorrente. A prioridade é **comunicar o que já é diferente** e **medir** | `competitive-gaps.md` | **não copiar feature de concorrente**; o degrau 3 é aposta de **modelo**, não paridade |
| D6 | **"WhatsApp incluído" não pode ser dito:** a rota `reminders` **não roda sozinha em produção** (só `recompute-cycles` e `segments`); ligar é **decisão do Eduardo** | GO-2 | qualquer texto do degrau 3 que prometa canal só vale **no dia em que for verdade** |
| D7 | **Não competir por aquisição** com quem tem rede (app do cliente e marketplace): AppBarber 1 milhão+ de instalações, Trinks 44 mil negócios, Fresha 450 mil profissionais, Booksy 330 mil | `docs/43`, `45` | o degrau 3 é **retenção da base que o salão já tem**, nunca "trazer cliente novo" |
| D8 | **Trinks saiu do foco:** o foco é **AppBarber, Belasis, BarbUp, caderno e planilha** | `docs/83`, decisões de 28/09 | a esteira não prioriza conversor do Trinks |
| D9 | **Nomear concorrentes no produto: sim, só com fato verificável** | `docs/83` | cuidado com tudo marcado [S] neste plano |

### 2.6 O que o nosso produto e o dos concorrentes já têm (o mapa que faltava)

**O que o CICLO já tem e nenhum concorrente pesquisado tem** [M, `competitive-gaps.md`]:
1. **Motor de Ciclo com ritmo por cliente e por serviço**, e não janela fixa. Todos os concorrentes
   tratam "sumido" por **janela igual para todos** (AppBarber: períodos escolhidos à mão num
   relatório; **Belasis: 30, 60 e 90 dias**; o setor: 45 dias) [S].
2. **Prestação de contas do Motor** ("o Motor acertou X%"): já em produção em `/admin/recuperar`.
3. **Preço 100% publicado** (o Trinks esconde tiers maiores) e **sem comissão por cliente novo**
   (Fresha cobra 20%, mínimo US$ 6, sobre cliente novo do marketplace).
4. **Onboarding que não pede planilha** (`ja-atendo`, digitação assistida por memória).
5. **Funciona ao lado do sistema atual**: "você não precisa largar o AppBarber hoje" (`docs/83`).

**O que os concorrentes têm e o CICLO não** (e que **não é** paridade urgente, mas é onde eles ganham):
**rede e marketplace** (app do cliente, descoberta); **escala** (ver D7); conta digital e maquininha
(Trinks, Booksy); **gerente dedicado e suporte 24 horas** (Belasis) [S]; app nativo do cliente.

**O concorrente mais próximo do degrau 3 é a Belasis** [S, site e blog dela]: promete "IA que traz
cliente de volta", CRM que acha quem sumiu há 30, 60 ou 90 dias e manda mensagem, **migração assistida
de clientes, agenda e histórico com gerente dedicado**, suporte 24 horas, e cita um depoimento de
**+30% de faturamento em 6 meses**. **Leitura:** serviço humano de implantação **já é o padrão do
concorrente direto**, então **o nosso "assistido" sozinho não diferencia**. O que a Belasis não
mostra (e a busca não achou): ritmo **individual** do cliente, **prestação de contas por salão** e
**cobrança atrelada a resultado com extrato**. É onde o degrau 3 se separa.

**Preços de referência.** Lidos **ao vivo em 07/10/2026** nos sites (marcados **[P hoje]**) e, onde não deu para
reler, os do repositório (**[P antigo]**, de `competitors/*`, 05/09 e 20/09, podem ter mudado):

| Sistema | 1 a 2 profissionais | 3 a 5 | 6 ou mais | Teste e garantia | Migração | WhatsApp |
|---|---|---|---|---|---|---|
| **CICLO** (proposta) | R$ 49 (solo, 1 prof.) | R$ 99 (até 5) | sob contato | acesso aberto, sem prazo | grátis (D1) | manual (D6) |
| **BarbUp** [P hoje] | **R$ 49,90** (até 2) | **R$ 89,90** (até 5) | R$ 129,90 (até 12) | **14 dias sem cartão e 30 dias de garantia de reembolso**, sem fidelidade | **assistida, sem custo** | configuração por WhatsApp; suporte em menos de 2 h úteis |
| **Trinks** [P hoje] | **R$ 76** (1 a 2) | R$ 110 (3 a 4) | sob consulta | **5 dias** grátis | assistida só no tier enterprise (P antigo) | **"rotina de mensagens por WhatsApp" é item adicional pago** |
| **AppBarber** [P antigo] | R$ 79,90 (1) | R$ 164,50 (2 a 5) | R$ 219,90 | n/d | por chamado, até 5 dias úteis | n/d |
| **Booksy** [P antigo] | US$ 29,99 mais US$ 20 por usuário | idem | idem | 14 dias sem cartão | n/d | n/d |
| **Fresha** [P antigo] | US$ 19,95 solo | US$ 14,95 por membro | idem | n/d | n/d | n/d |

**O que isso diz de verdade (corrige uma suposição minha):**
1. **Preço não é diferencial contra o BarbUp.** O CICLO solo (R$ 49, **1** profissional) custa o mesmo que o
   BarbUp básico (R$ 49,90, **até 2**), e o **Equipe (R$ 99) é mais caro** que o BarbUp intermediário
   (R$ 89,90, até 5). **Só ganhamos no preço do Trinks.** A tese precisa se sustentar em **ritmo
   individual, prova e serviço**, não em ser barato.
2. **O padrão de mercado de confiança é teste sem cartão mais garantia de reembolso de 30 dias** (BarbUp
   tem os dois). **Recomendação [Do Eduardo]:** oferecer **garantia de 30 dias no plano anual à vista**
   (o direito legal de arrependimento é de 7 dias; 30 dias é diferencial comercial e baixa o risco de
   pagar R$ 497 adiantado a um fornecedor novo).
3. **O Trinks cobra o WhatsApp como item adicional**, o que reforça o diferencial de "WhatsApp incluído"
   **no dia em que ele for verdade em produção** (D6).
4. **Comparação do degrau 3 [E]:** o exemplo de R$ 211 por mês fica **bem acima** de todos os planos de
   software (BarbUp R$ 129,90 no topo). **Não é o preço de uma ferramenta, é o de um serviço**, e só se
   justifica se o extrato mostrar retorno maior que o custo (seção 4.4). O variável de R$ 16 por retorno
   pagável (20% de R$ 80) é **menor que o mínimo de US$ 6 (cerca de R$ 33) que a Fresha cobra por
   cliente novo**, com a diferença de que aqui é cliente que **já é do salão**.

**Contexto de mercado novo** [S, matéria do UAI com dados do Sebrae e de pesquisas]: o uso de **CRM entre
pequenas empresas brasileiras foi de 23% para 29% entre 2024 e 2025** (TIC Empresas 2025), o que
**sustenta a leitura de que a maioria ainda não usa sistema** (D3); **cerca de 236 mil pequenos negócios de
beleza se formalizaram em 2025 (+18%)**; **79,5% das pessoas contataram marcas por WhatsApp no último
ano**; e o custo de **conquistar um cliente novo é de 5 a 25 vezes o de manter um existente** (citação
de pesquisa da Harvard Business Review, **não conferida por mim**).

### 2.7 Resolução do conflito entre a esteira (`docs/97`) e o veredito GO-1

O veredito GO-1 foi dado **sem dado de funil** e antes do pedido novo do Eduardo ("máquina de extração
de qualquer arquivo"). **Os dois têm razão em partes.** A resolução:

1. **O público real manda.** Menos de 30% têm sistema; **a maioria tem caderno, memória, WhatsApp e a
   agenda do celular.** O caminho principal continua **`ja-atendo`**, e **a esteira não o substitui**.
2. **A esteira serve três públicos** e ganha prioridade nesta ordem: **(a)** quem tem **sistema
   exportável** (AppBarber, Belasis, BarbUp): `.xlsx`, cabeçalho fora da linha 1, quarentena; **(b)** quem
   tem **contatos no celular ou lista no WhatsApp**: **vCard e texto colado sobem de prioridade**
   (eram "formatos extras", viram **Onda 1b**), porque é a lista digital que o público do caderno
   realmente tem; **(c)** quem só tem **foto do caderno**: OCR no aparelho, **com a ressalva honesta de
   que letra manuscrita é o pior caso do OCR** e a revisão linha a linha não é negociável.
3. **Portão de evidência antes de construir além da Onda 1:** instrumentar o funil (GO-0) e **medir a
   taxa de conclusão de `ja-atendo` e `importar`**. Se a conclusão for alta e o atrito for outro, a
   esteira **encolhe**. Se o atrito estiver **dentro da importação** (arquivo que não entra, data que
   não lê), a esteira **resolve exatamente isso**.
4. **O diagnóstico do degrau 2 é o teste de demanda mais barato:** o Eduardo já decidiu importar
   pelo WhatsApp as primeiras contas. **Fazer isso com 5 salões, antes de qualquer código novo, mede
   quem aceita o degrau 3**, quanto tempo leva e o que trava.

## 3. O mercado (pesquisado hoje; **nenhum produto foi testado**)

### 3.1 Agenda, reserva e retenção
Fresha, Booksy, Vagaro e Mangomint são fortes em reserva; os comparativos dizem que a **retenção
automatizada fica fraca ou exige camada de fora** [S]. **Phorest** é o voltado a retenção (campanhas de
retorno, fidelidade, reputação) e lançou o **"On Behalf Marketing"**, um marketing **totalmente
gerenciado** em nome do salão [S]: **o serviço entregue já aparece no segmento**, do lado do
marketing. Fresha e Booksy cobram **comissão por cliente novo** do marketplace [S, `docs/07`]: o dono
de salão **já entende "pagar por cliente trazido"**. Brasil: Trinks, Avec, AppBarber, Salão99, Belle,
Simples Agenda, Belasis, Actana: sem documentação pública de importação e exportação, com exceções (e
veja a seção 2.6 sobre a Belasis, o concorrente mais próximo do degrau 3):
AppBarber exporta pelo chat do suporte, e Belasis, Actana e Zenamu **migram os dados por você, de
graça, como parte da venda** [S].

### 3.2 Importadores de dados
Flatfile, OneSchema, Dromo, CSVBox, Ingestro: genéricos, embutidos em outro produto, **nenhum conhece o
destino**. Só o Dromo processa no navegador (opção paga) [S]. Detalhe em `docs/97`.

### 3.3 O modelo "serviço como software" e o preço por resultado (a pesquisa nova)

- **A tese** (Sequoia, abril de 2026) [S]: para cada **US$ 1 que as empresas gastam em software, gastam
  US$ 6 em serviços**. A próxima geração **vende o resultado e usa IA para entregá-lo**, junto com
  especialistas humanos; o fornecedor que **vende o trabalho** fica mais forte quando o modelo
  melhora, em vez de correr contra ele. O exemplo citado é a **Sierra**: o cliente **paga por problema
  resolvido**; sem resolução, sem cobrança.
- **Prova de mercado em suporte ao cliente** [S]: o agente **Fin, da Intercom, cobra US$ 0,99 por
  conversa resolvida** (e US$ 9,99 por lead qualificado); a taxa de resolução subiu de ~25% para
  **65 a 70%**; o produto está **perto de US$ 100 milhões de receita anual recorrente, cerca da metade da
  Intercom**. A **Zendesk** também cobra por resolução automática. **Definição de "resolvido"
  importa:** a Intercom conta por confirmação ou por **sumiço sem nova pergunta**; a Zendesk conta
  após **72 horas sem atividade**.
- **Os riscos do preço por resultado** [S]: **disputa de atribuição** (quem causou o resultado),
  **receita imprevisível** (varia com sazonalidade), **risco moral** (otimizar o ganho fácil e
  cobrável), **custo de instrumentação** (dado auditável custa caro). **O padrão que o mercado
  adotou é o híbrido: parte fixa mais bônus por resultado**, com **métrica binária e auditável**
  ("ticket resolvido"), linha-base documentada, mínimo de desempenho e processo formal de contestação.
- **Leitura para o CICLO:** a nossa unidade de resultado é **mais auditável** que "conversa resolvida":
  "cliente chamado pela fila, que agendou pelo link e **compareceu**" é um evento binário, com data,
  valor e id de agendamento, **já registrado pelo sistema**. É exatamente o tipo de métrica que o
  mercado diz ser a viável. A nossa fraqueza é a outra: **o contrafactual** (voltaria sozinho?),
  tratado na seção 4.3.

### 3.4 Recepcionista de IA para salão (agentes no mercado)
Velora, Wello, Ada e outros, no WhatsApp e Instagram: **virou commodity** em 2026, com muitos
entrantes [S]. Números de "no-show cai e ocupação sobe 20 a 30%" vêm de blogs de fornecedor, **não
usar**. **Regra do WhatsApp (Meta), 2026** [S, reportagens; **o texto oficial foi lido em 07/10/2026 e confirma a regra: seção 4.7, ver 3.6**]: a API
**proíbe chatbots de IA de uso geral** (desde 15/01/2026 para todos), mas **permite IA como parte de um
serviço do negócio** (reserva, suporte, avisos). A IA **não pode ser a funcionalidade principal**.

### 3.5 Cobrança
Seção T6 (Asaas, Pix Automático, Mercado Pago).

### 3.6 Lacunas desta pesquisa [fazer]
**Fechadas nesta rodada:** preços do Trinks e do BarbUp (ao vivo); texto oficial da Meta (item abaixo);
regra de valor variável do Pix Automático (item abaixo).

**Texto oficial da Meta** [S, página oficial lida em 07/10/2026, resumo do trecho]: nos **Termos da
Plataforma WhatsApp Business**, seção **4.7 "Provedores de IA"** (documento atualizado em 23/09/2026),
fornecedores e desenvolvedores de IA ficam **proibidos de acessar ou usar a plataforma quando a IA for a
funcionalidade principal**. **Continua permitido** quando a IA é **incidental ou auxiliar** (o que
casa com agendar e recuperar). **Restrição que importa para nós:** os dados da plataforma **não podem
ser usados para criar, desenvolver, treinar ou melhorar** sistemas de aprendizado de máquina ou modelos de
linguagem, **exceto o refinamento de um modelo próprio de uso exclusivamente interno**. Consequência: o
**uplift, o bandido e o modelo hierárquico do `docs/91`/`92`, se forem treinados em mensagens do
WhatsApp, esbarram nessa cláusula**; **perguntar ao advogado** o que cabe como "uso próprio interno" para
um operador que serve vários salões.

**Pix Automático e valor variável** [S, notícias sobre as regras do Banco Central, e a documentação do
Asaas; **não consegui abrir o guia oficial do BC**]: o pagador define **no momento da autorização** um
**valor máximo por cobrança**, e a cobrança **pode variar abaixo desse teto**; o pagador pode **cancelar
uma cobrança até 23h59 do dia anterior** ao vencimento se não concordar; se faltar saldo há **3
retentativas em 7 dias**; o recebedor pode cancelar uma cobrança até **22h do dia anterior**. No Asaas, o
modo `MANUAL` **não declara restrição de valor** e exige criar a instrução **entre 2 e 10 dias úteis
antes do vencimento**. **Conclusão: cobrança variável por Pix Automático é viável, mas a confirmação
final é no sandbox do Asaas** (criar uma autorização e cobranças de valores diferentes).

**Ainda abertas [fazer]:** (a) **prints de preço e tela dos concorrentes pelo olhar de um salão que os usa**
(os sites não mostram tudo; a Belasis não publicou preço); (c) **parceiros de distribuição**: a busca
**não achou um canal estabelecido** de venda de software para salão por contadores, associações ou
fornecedores (só distribuidoras de cosméticos, que visitam salões e **são um canal possível mas não
pesquisado**); (d) Instagram e Google Meu Negócio; (e) **se algum concorrente brasileiro já vende retorno
por resultado** (segue sem achado). **Pista nova:** a **Lei do Salão-Parceiro** (Lei 13.352/2016) regula a
parceria entre profissionais autônomos (cabeleireiro, barbeiro, manicure e outros) e o salão, o que **muda
quem é o "dono" do cliente que volta e a comissão do profissional**; **não aprofundei**, e vale uma
pergunta ao contador e ao advogado antes de o Motor atribuir retorno a um profissional.

## 4. A escada de oferta e o modelo Entregue (o coração da v2)

### 4.1 Três degraus

| Degrau | O dono compra | O CICLO entrega | Quem trabalha | Preço (proposta [E]) |
|---|---|---|---|---|
| **1 · Ferramenta** | acesso ao sistema | o software, autoatendimento | o dono | R$ 49 (Solo) e R$ 99 (Equipe), ou R$ 497 por ano à vista (`docs/87`, `docs/99` v1) |
| **2 · Assistido** | "montem pra mim" | **importação feita por nós**, calibragem do Motor, **diagnóstico** ("47 clientes, R$ 6.300") e o **retroteste** | o CICLO, uma vez | **sempre grátis (decidido, D1)**, e **1 mês do Essencial** para quem traz a base com a data da última visita |
| **3 · Entregue** | "devolvam meus clientes" | **a operação semanal do retorno**: lista pronta, texto certo, ordem, acompanhamento e **relatório mensal do que voltou e quanto valeu** | o CICLO (pessoa supervisionando agente), e o dono só toca em Chamar | **híbrido: fixo mais variável por retorno confirmado** (seção 4.4) |

**Por que a escada e não só o degrau 3:** o degrau 2 é a **arma de venda e o piloto** (o mercado
brasileiro já vende migração assistida de graça), e é nele que se mede o efeito. O degrau 3 só se
liga com resultado provado (portões, seção 4.5). **O degrau 1 continua existindo**: quem quer fazer
sozinho faz.

### 4.2 A unidade de entrega: o **retorno confirmado**

Métrica **binária e auditável**, calculada **só com eventos que o sistema já registra** [M: link
assinado com validade de 14 dias, `clicked_at`, `booked_appointment_id`, atendimento concluído]:

1. **Exposição:** o cliente estava na fila do CICLO e o dono **tocou em Chamar**, com o link pessoal
   (o toque é registrado em `/api/v1/cycle/recover/manual`).
2. **Evento:** o cliente **agendou pelo link** (`booked_appointment_id`) **e o atendimento foi
   concluído** (não basta agendar).
3. **Janela:** até **30 dias** depois da exposição.
4. **Valor:** o preço do atendimento concluído, em **centavos**, como já gravado.
5. **Exclusões (para ninguém cobrar o que não causou):** cliente que **já tinha agendamento futuro**
   antes do contato; cliente que **visitou nos N dias anteriores** ao contato; cliente do **braço de
   controle** (seção 4.3); **primeira visita** (novo cliente não é retorno); retorno **antes** da
   exposição.
6. **Cada retorno confirmado entra num livro append-only** (`return_attributions`), com id do
   agendamento, data, valor e o hash do cliente. Esse livro **é** o extrato da cobrança (seção 4.4).

### 4.3 A linha-base: cobrar só pelo que passar do que voltaria sozinho

O problema do contrafactual (parte dos clientes voltaria de qualquer jeito, ~3% em 30 dias segundo
fornecedor [S, `docs/94`]) é o que mais gera briga em preço por resultado. A proposta:

- **Fórmula:** retornos pagáveis = `max(0, retornos confirmados − β × clientes expostos)`.
  **β é uma constante contratual** (inicial **3%**, [S]), escrita no contrato e **igual para todos os
  salões**, e não uma medição por salão.
- **Calibração de β:** um **braço de controle de 10%** (sorteado de forma reprodutível, **sem contato**
  por 30 dias, como já desenhado no `docs/91`) é medido **agregado entre todos os salões do degrau 3**.
  β só muda por **adendo** e com aviso, nunca retroativo.
- **Por quê assim:** o dono vê uma conta que consegue refazer à mão; não depende de estatística que
  um salão pequeno não sustenta (`docs/94`); e o controle agregado continua alimentando o Motor
  (`docs/98`).
- **O que o controle custa:** 10% da lista sem ser chamada é dinheiro que o dono deixa de recuperar.
  **Dizer isso no contrato, por escrito**, e deixar o dono **recusar o controle** (nesse caso a parte
  variável usa β fixo e **não** entra na calibração).

### 4.4 O preço híbrido e o extrato

`cobrança do mês = fixo + taxa × (valor dos retornos pagáveis)`, com **teto mensal** (previsibilidade)
e **piso zero** no variável ("sem resultado, sem variável").

**Modelo de conta [E], todos os números são hipótese a trocar** (usa o caso-base do `docs/94`: 100
clientes expostos por mês, 10% voltam, β = 3%, ticket R$ 80):

| Item | Valor |
|---|---|
| Expostos | 100 |
| Retornos confirmados (10%) | 10 |
| Retornos pagáveis (10 − 3) | **7** |
| Valor dos pagáveis (7 × R$ 80) | R$ 560 |
| Variável a 20% | R$ 112 |
| Fixo (hipótese) | R$ 99 |
| **Cobrado no mês** | **R$ 211** |
| Faturamento a mais do dono (pagáveis) | R$ 560 |
| **Ganho líquido do dono** | **R$ 349** |

**E o cenário ruim do `docs/94`** (60 expostos, 7% de retorno): pagáveis = `4,2 − 1,8 = 2,4`; valor
R$ 120 (ticket R$ 50); variável R$ 24; **cobrado R$ 123 contra R$ 120 de faturamento a mais: o dono
não ganha**. **Leitura honesta:** com **fixo de R$ 99, o modelo não se paga para barbearia pequena de
ticket baixo**, exatamente a conclusão do `docs/94` para o plano de R$ 149. O degrau 3 mira
**salão e estética com ticket de R$ 80 ou mais, ou base grande**. Para ticket baixo, **fixo menor e
variável maior**, ou ficar no degrau 1.

**Custo do CICLO por salão (fórmula, não número):**
`margem = fixo + variável − taxa de pagamento − custo de mensagem (se API) − minutos do operador × custo
do minuto − imposto`. **O número que decide se escala é "minutos de operador por salão por semana".**
Meta [E]: **≤ 15 min por salão por semana**; acima disso o serviço não escala e o preço sobe.

**Extrato mensal ao dono** (anti-disputa, **obrigatório**): lista dos retornos pagáveis com data do
contato, data do atendimento, serviço e valor, o **β usado**, o **cálculo** e o **teto**. **Direito de
contestar** em 10 dias, com revisão por uma pessoa (e a lista inteira do livro à vista).

### 4.5 Portões: quando cada parte liga

| Fase | O que liga | Só quando |
|---|---|---|
| **P0 · Diagnóstico grátis** | degrau 2 em 5 pilotos (de preferência ticket ≥ R$ 80) | esteira Onda 1 e retroteste prontos (`docs/97`, `docs/98`) |
| **P1 · Acompanhado, cobrado só com fixo** | degrau 3 **sem envio automático**: lista, texto, acompanhamento e extrato, com **fixo**, sem variável, medindo | diferença tratamento × controle **≥ 4 p.p. somada em ≥ 3 pilotos** (portão do dia 35, `docs/94`) |
| **P2 · Híbrido** | variável sobre β | **(a)** P1 estável por 60 dias; **(b)** contrato assinado (seção 9); **(c)** CNPJ, enquadramento fiscal e **nota de serviço** resolvidos (`docs/89`); **(d)** cobrança variável **tecnicamente possível** (4.7); **(e)** extrato auditável em produção; **(f)** parecer do advogado sobre o modelo |
| **P3 · Automação do canal** | envio pela API oficial, com consentimento | opt-in com prova em **≥ 30% da base ativa de 3 salões** (`docs/91`); BSP contratado; decisão do C1 |
| **P4 · Revisão de β e do controle** | β calibrado pelo agregado | **~30 salões** no degrau 3 |

**Regra de parada:** se no dia 35 a diferença for menor que o limite, **não vender o degrau 3**; ficam
os degraus 1 e 2. Isso é o que o `docs/94` manda e a v2 mantém.

**Critérios de morte (v3), escritos antes para ninguém racionalizar depois:** (1) se **menos de 2 dos 5
pilotos** aceitarem pagar o fixo do degrau 3 depois do diagnóstico grátis, o degrau 3 **não é o que o
mercado quer** e volta-se ao degrau 1 com o diagnóstico como isca; (2) se o operador gastar **mais de 30
minutos por salão por semana** depois de 4 semanas, o serviço **não escala** nesse preço; (3) se **mais
de 30% dos pilotos não chamarem a lista**, o gargalo é o dono, e o produto certo é **canal automático**
(P3), não mais acompanhamento.

### 4.6 Como o serviço é operado (a parte que ninguém planeja)

- **Ciclo semanal:** segunda, o agente de retorno (G2) monta a lista e o texto de cada salão; o
  **operador** (pessoa) revisa em minutos e libera; o dono executa (v1: toca em Chamar; v2, depois de
  P3: o CICLO envia, com consentimento); sexta, fechamento e anotação do que voltou.
- **Operador de entrega:** uma pessoa por **N salões**, com **checklist e tempo orçado por salão**. A
  alavanca de lucro é **quantos salões uma pessoa supervisiona** (métrica na seção 14).
- **Acordo de nível de serviço, nos dois sentidos:** o CICLO entrega a lista na segunda; o **dono
  precisa chamar pelo menos X% da lista**. Se não chamar, **não há retorno e não há variável**, e o
  fixo continua (senão o dono "esconde" o resultado).
- **Garantia de qualidade:** amostra semanal de textos e listas revisada por outra pessoa; erro vai
  para o corpus de teste do agente (seção 7).
- **Ferramenta de operador** (T10): fila de salões atendidos, estado da semana, minutos gastos,
  pendências. **Sem isso o serviço entregue vira planilha e some.**
- **O que NÃO é o serviço entregue:** não atende cliente final no lugar do dono, não negocia preço,
  não manda nada que o dono não tenha visto (L1 é o teto, seção 7).

### 4.7 O que a cobrança variável exige do código (e por que não é a assinatura do MP)

- A guarda atual do Mercado Pago (`valorConfereComDegrau`) **recusa valor diferente do preço do
  plano** (proteção contra checkout adulterado). **Cobrança variável não pode ser uma assinatura de
  valor fixo.** Precisa de **cobrança avulsa por mês**, com o valor calculado pelo sistema a partir do
  livro `return_attributions`.
- **Candidatos [S, a conferir no sandbox]:** (1) **Asaas, cobrança avulsa por API** a cada mês (Pix,
  boleto ou cartão) com o valor calculado; (2) **Pix Automático em modo `MANUAL`**: o dono autoriza uma vez,
  **com um valor máximo por cobrança**, e o nosso sistema cobra cada mês um valor diferente **abaixo do
  teto** (viabilidade na seção 3.6); (3) **Pix manual** com QR gerado por mês (alpha).
- **Consequência de calendário (v3, rodada 2):** a instrução de cobrança precisa ser criada **entre 2 e
  10 dias úteis antes do vencimento**, e o pagador pode **recusar até a véspera**. Logo, **o mês de
  medição fecha antes da cobrança**: fecha-se o livro, gera-se o **extrato**, **avisa-se o dono** e só
  depois se cria a cobrança, com folga de pelo menos 2 dias úteis para ele **contestar antes de pagar**.
  Isso **casa com o direito de contestar em 10 dias** da seção 4.4: **cobrar em atraso (competência
  anterior)**, nunca no mesmo mês da medição.
- **O teto autorizado é o teto contratual** (seção 4.4): o valor máximo que o dono autoriza no Pix
  Automático **tem que ser igual ao teto mensal do contrato**, para a cobrança nunca ser recusada por
  passar do autorizado.
- **O cálculo da cobrança é função pura** em `core/billing` (`cobrancaDoMes(livro, contrato)`), com
  teste de propriedade (nunca cobra acima do teto; variável nunca negativa; o mesmo livro dá o mesmo
  valor), mutação e **reconciliação mensal** (soma do extrato = valor da cobrança).

### 4.8 A crítica honesta ao próprio modelo (v3)

**O serviço só é "entregue" de verdade quando o CICLO envia.** Hoje a fila de chamadas e o perfil do
cliente **já preparam a lista, o texto e a ordem sozinhos**, e quem executa é o dono, tocando em
Chamar. Enquanto o canal for manual (C1, D6), o que uma pessoa do CICLO acrescenta é:
**(a)** a configuração e a calibragem iniciais; **(b)** a **prestação de contas** (extrato);
**(c)** o **empurrão semanal para chamar** (mudança de comportamento, que é o verdadeiro gargalo); e
**(d)** o diagnóstico de por que alguém não volta. **Isso vale dinheiro, mas é mais "acompanhamento e
prova" do que "serviço entregue".** O degrau 3 completo exige **P3** (envio automático com
consentimento), que depende de BSP, verificação da Meta e decisão do C1. **Não vender "entregue" antes
disso; vender "acompanhado", e dizer isso na página.**

**As bases de cálculo vêm de fornecedor.** O β de 3% (volta espontânea) e os 7% a 15% de volta com
mensagem vêm de **material de fornecedor de software** [S, `docs/94`]. **São chute informado, não dado
deste público.** O braço de controle existe justamente para trocar chute por medição.

**O risco real é construir demais antes de saber.** O repositório mostra funil sem instrumentação
(D4), canal de lembrete desligado (D6) e nenhuma paridade urgente (D5). **Onze trilhas é um mapa, não
um sprint.** A seção 12 traz a **sequência de evidência**: pilotar com o que já existe, medir e só
então construir.

## 5. O ecossistema em onze trilhas (mapa do plano mesclado)

```
 CAPTAR → ATIVAR → ENTRAR DADO → PREVER → AGIR → MEDIR → APRENDER → COBRAR → ENTREGAR → SAIR LEVANDO
  (T1)     (T1)       (T2)        (T3)    (T4)   (T5)     (T3,T5)     (T6)     (T7)        (T2)
                 + (T8) agentes   + (T9) confiança   + (T10) plataforma   + (T11) método
```

| Trilha | Faz o quê | Estado | Onde |
|---|---|---|---|
| **T1** Captação e ativação | landing, calculadora, indicação, prospecção, onboarding, alpha, **venda do diagnóstico** | landing, calculadora, onboarding existem | `docs/82`, `83`, `56` |
| **T2** Entrada e saída de dados | esteira de qualquer arquivo; exportação completa | plano pronto, **nada construído** | `docs/97` |
| **T3** Motor | previsão, valor em risco, backtest, v2, **motor de retorno** (decisão por lucro incremental) | v1 no ar; revisão pronta | `docs/98`, `91` §5, `92`, `93` |
| **T4** Ação e canal | fila de chamadas, texto por perfil, link, **consentimento**, **canal oficial (adiado)** | fila no ar; #142 aberto; consentimento e API **não existem** | `docs/95`, `96`, `91` A e B |
| **T5** Medição, controle e prova | **livro de retornos**, braço de controle, calibração, **retroteste**, placar do dono | atribuição por clique existe; livro e controle **não** | `docs/91` C, `98` §5 |
| **T6** Oferta, preço e cobrança | escada de oferta, **cobrança variável**, provedor, dunning, notas | **decisão aberta** | seção 4 e 6 |
| **T7** Operação do serviço entregue | ciclo semanal, operador, SLA, QA, extrato, contestação | **não existe** | seção 4.6 |
| **T8** Agentes | assistentes que preparam, pessoa aprova | assistente base no ar | seção 7, `docs/26` |
| **T9** Confiança e conformidade | LGPD, termos, política, **contrato de serviço e de operador**, incidente | #144 aberto, sem revisão humana | `docs/86`, seção 9 |
| **T10** Plataforma e operação interna | infra, custos, vigias, **backoffice** | vigias existem; **backoffice não** | `docs/88`, seção 10 |
| **T11** Método de engenharia | testes, mutação, modo sombra, experimentos | forte; acrescentar o da seção 11 | `CLAUDE.md` |

**Mapa para os `docs/91` a `96`** (que usam letras): A canal oficial → **T4**; B consentimento → **T4**;
C base de medição → **T5**; D motor de retorno → **T3**; E estatística por nicho → **T3, bloqueada**;
F jurídico e fiscal → **T9**.

## 6. T6: oferta, preço e cobrança (com o que a pesquisa do Asaas trouxe)

**Lido hoje no Asaas** (documentação e página de preços; **conferir no cadastro**, uma leitura de
cartão veio ambígua) [S]: a API cobra **Pix, boleto e cartão**, avulso, parcelado ou **recorrente**
(`POST /v3/subscriptions` gera uma cobrança a cada ciclo, cada uma com id e status), com **webhook** e
sandbox gratuito. **Pix Automático** (Banco Central, desde 16/06/2025): o pagador autoriza uma vez e as
cobranças seguintes saem sem nova confirmação; no Asaas há os modos `MANUAL` e `SUBSCRIPTION`, com
política de retentativas. **Taxas lidas:** sem mensalidade; **Pix R$ 1,99** por cobrança recebida
(promocional R$ 0,99 nos 3 primeiros meses); boleto igual; **cartão à vista 1,99% + R$ 0,49**. O
Mercado Pago, segundo `docs/88`, cobra **0,99% no Pix** [S] e a taxa do cartão recorrente do MP **não
foi confirmada**.

| Ticket | Asaas Pix (R$ 1,99) | MP Pix (0,99%) | Asaas cartão (1,99% + R$ 0,49) |
|---|---|---|---|
| R$ 49 (Essencial, mensal) | **4,1%** | 1,0% | 3,0% |
| R$ 99 (Equipe, mensal) | 2,0% | 1,0% | 2,5% |
| R$ 211 (Entregue, exemplo da 4.4) | **0,9%** | 1,0% | 2,2% |
| R$ 497 (anual à vista) | **0,4%** | 1,0% | 2,1% |

**Leitura [E]:** taxa fixa pesa em ticket pequeno e some em ticket grande; o ponto de virada contra o
MP Pix é perto de **R$ 200**. **O degrau 3 (ticket maior) combina bem com cobrança de taxa fixa**, e o
**anual à vista** é barato em qualquer provedor.

**Recomendação (Do Eduardo decide), em ordem:**
1. **Alpha:** cobrança **por fora** (Pix anual à vista, manual) **mais backoffice** para marcar a conta
   paga (T10). Zero integração.
2. **Interface `ProvedorDeCobranca`** em `core/billing` com adaptadores `Manual`, `MercadoPago` (o código
   atual) e `Asaas`, e testes com provedor falso. Motivo: o código atual fala o vocabulário do MP
   (`preapproval`, `authorized`, `paused`, `cancelled`); trocar de provedor não pode mexer em regra.
   **Dois tipos de cobrança:** **assinatura de valor fixo** (degrau 1) e **cobrança avulsa de valor
   calculado** (degrau 3, seção 4.7).
3. **Recorrente real:** Pix Automático para o mensal fixo; **avulsa para o variável**. Conferir antes:
   CNPJ ou pessoa física, MEI, prazo de repasse, chargeback e liberação do Pix Automático.
4. **Semântica que o adaptador novo precisa respeitar** (já feita no #143): **cancelar não corta o mês
   pago** (`acesso_ate`).
5. **Régua de cobrança (dunning), sem IA:** aviso antes do vencimento, link, retentativa, aviso de
   pausa, **e-mail transacional** pela fila de jobs (C6 de `docs/86`), **não** pelo cron do GitHub.
6. **Nota fiscal de serviço:** o degrau 3 é **serviço**, não licença de software. O enquadramento
   (ISS, Simples, ME) **muda**: resolver com o contador (`docs/89`) **antes do P2**.

**Preço, a decidir (C2):** R$ 49 e R$ 99 (`docs/87`) **ou** R$ 37 e R$ 149 (`docs/94`); R$ 497 por ano
é **R$ 41,40 por mês**, abaixo do Essencial, e precisa ser dito como desconto de fundador.

## 7. T8: onde agentes se encaixam

**A decisão que continua valendo (`docs/26`):** chamar de **assistente**, não de agente autônomo.
Quatro regras inegociáveis, **estendidas a todo agente**:

1. **O modelo nunca produz número.** Toda cifra vem de uma consulta ao serviço existente.
2. **O modelo nunca escreve SQL.** Ferramentas fixas, sempre.
3. **Escrita exige confirmação humana.**
4. **Dado de saúde nunca entra no contexto**, por construção.

**Regras acrescentadas por este plano:**
5. **Escada de autonomia.** L0 informa; **L1 propõe e a pessoa aprova (teto para tudo que toca cliente
   final ou dinheiro)**; L2 executa ação **reversível e de baixo risco**, avisa e deixa desfazer; L3
   autônomo: **proibido**, exceto operação interna somente de leitura.
6. **Lista fechada de ferramentas** por agente, com **teste de contrato**.
7. **IA no aparelho primeiro; de terceiros só com parecer jurídico** (`docs/97` §7).
8. **Teto de custo por conta e chave de desligamento.**
9. **Avaliação com gabarito antes de soltar**; mutação vale.
10. **Registro do que o agente fez**, visível ao dono, com redação de dado pessoal.
11. **Política do WhatsApp:** o agente é sempre **uma função do negócio**, nunca conversa aberta. **E, pela
    seção 4.7 dos termos da Meta (3.6), nenhum dado da plataforma do WhatsApp treina modelo do CICLO** (nem
    o uplift nem o hierárquico) **sem parecer jurídico sobre o que é "uso próprio interno"**.
12. **(v2) O agente do serviço entregue nunca cobra, nunca decide quem entra no livro de retornos e
    nunca altera o livro.** A cobrança sai de função pura sobre o livro; **o livro só recebe evento do
    sistema** (agendamento e atendimento), nunca de texto de agente.

**Catálogo, em ordem de valor e de baixo risco** (G2 passa a ser **o trabalhador do degrau 3**):

| # | Agente | Para quem | O que faz | Autonomia | IA | Trava | Quando |
|---|---|---|---|---|---|---|---|
| G1 | **Importação** | dono, no primeiro uso | guia a esteira, diz o que falta para subir o nível | L1 | regras; modelo no aparelho opcional | só vê o que o dono subiu | com a esteira |
| G2 | **Retorno** | **operador do serviço** e dono | monta a lista semanal, escolhe o texto pelo perfil, **explica o porquê** ("vem a cada 28 dias, faz 41"), propõe a ordem | **L1** | regras | WhatsApp **manual do dono**; sem API; **não escreve no livro** | com o Motor v2 |
| G3 | **Operações** (interno) | Eduardo | vigia crons, fila, cobrança, **importações travadas**, minutos por salão | L0 e L1 | consultas fixas | **somente leitura** em produção | cedo |
| G4 | **Onboarding** | dono novo | do cadastro ao primeiro ouro em 15 minutos | L1 | regras | não grava sem o toque | cedo |
| G5 | **Cobrança** | dono pagante | régua de aviso, link, pausa, **extrato mensal** | L2 (e-mail transacional) | **nenhuma** | texto fixo e revisado; **valor vem da função pura** | com T6 |
| G6 | **Qualidade de dados** | dono | duplicados e telefones ruins depois da importação | L1 | regras (`docs/97` E7) | nunca funde sozinho | depois da esteira |
| G7 | **Suporte** | dono | dúvidas com base na documentação, abre chamado | L1 | **parecer** se modelo de terceiros | sem dado de cliente no contexto | tardio |
| G8 | **Recepcionista** (WhatsApp, Instagram) | cliente final | agendar e confirmar | L1 no começo | **terceiros**, API oficial paga | risco jurídico, de custo e de política da Meta; **mercado saturado** | **por último; avaliar parceria em vez de construir** |
| G9 | **Prospecção** (do Eduardo) | Eduardo | lista de salões, roteiro, objeção | L0 | qualquer, **sem dado de cliente do CICLO** | LGPD e antispam: abordagem **manual e individual** | com o alpha |
| G10 | **Engenharia** (contas do Claude e Codex) | time | executam o backlog | L1 (PR revisado) | n/a | contratos, worktrees, revisão (seção 13) | já |

**Por que G8 fica no fim:** produto commodity [S]; o diferencial do CICLO é **retenção**, não
conversa; exige API oficial (custo por conversa, aprovação de modelos), provedor de IA de terceiros
(**quebra a promessa da política de privacidade** até haver parecer) e conformidade com a Meta. **Pergunta
aberta [Do Eduardo]:** construir ou **integrar**?

**Onde o agente mais agrega valor:** G1 (derruba a maior barreira de entrada), **G2 (é o serviço
entregue)** e G3 (protege contra a **falha silenciosa**, o defeito mais caro deste projeto).

## 8. T1: captação e ativação (v2)

- **O pitch muda de "um sistema" para "devolvo seus clientes".** A oferta de entrada é o **diagnóstico
  grátis do degrau 2**: o dono manda o arquivo, o CICLO mostra **"47 clientes, R$ 6.300"** e, quando
  houver histórico, o **retroteste**. Quem se interessa **compra o degrau 3 ou o 1**.
- **Primeiro ticket do backlog inteiro: GO-0** (instrumentar o funil com `product_events`: cadastro,
  abriu `ja-atendo` ou `importar`, **concluiu**, viu o ouro, chamou, voltou). **Sem isso nenhuma decisão
  de ativação sai de hipótese** (D4).
- **Métrica de ativação:** minutos do cadastro até o **primeiro ouro** (meta < 15), depois **primeira
  chamada feita**, **primeira volta confirmada**. O ouro tem que aparecer **no mesmo minuto** da
  importação (D2): é o diferencial contra o AppBarber (até 5 dias úteis).
- **Estrela-guia:** **retornos confirmados por mês** e **R$ recuperado por salão** (é também a unidade
  de cobrança do degrau 3).
- **Pergunta do onboarding:** **"onde estão seus clientes hoje?"** (caderno, WhatsApp, planilha, outro
  sistema, negócio novo), e não "qual sistema você usa?" (`docs/83`): serve os 70% e os 30% com uma
  pergunta.
- **Benefício por trazer a base:** 1 mês do Essencial para quem importa com a data da última visita
  (decidido, D1).
- **Canal do alpha:** venda um a um, com a pessoa na tela do salão importando a lista (`docs/88`,
  `docs/56`); **o Eduardo importa pelo WhatsApp as primeiras contas** (decidido). **Pesquisar parceiros de distribuição** (lacuna c da seção 3.6).
- **O que não fazer:** disparo em massa frio, compra de lista, **promessa de resultado que o retroteste
  não prove**, vender o degrau 3 antes do portão do dia 35.

## 9. T9: confiança e conformidade (v2)

- **Fundir e revisar o #144**; levar o dossiê ao advogado (prazo anterior: 21/12).
- **Serviço entregue muda o papel jurídico:** o CICLO **opera em nome do salão** (já é operador) e
  agora **prepara contato com clientes do salão** e **mede resultado para cobrar**. Precisa de:
  **contrato de serviço** (escopo, β, controle, teto, extrato, contestação, SLA do dono, saída),
  **cláusula de operador** (minuta do #144 estendida) e **texto sobre o braço de controle** (parte da
  lista deixa de ser chamada por 30 dias, por pedido da metodologia).
- **Perguntas ao advogado, consolidadas** (de `docs/97` §13, `docs/86` e v2): IA e OCR no aparelho
  contam como terceiro?; declaração da prévia; dado de saúde em planilha; modo assistido; IA ou OCR de
  terceiros; lista importada sem consentimento de contato; **dados agregados entre salões (segue
  desligado)**; **(v2)** a cláusula de preço por resultado, a mensuração com braço de controle, o
  enquadramento do degrau 3 como serviço.
- **Consentimento (`docs/91` B):** `consents` append-only com prova; lista importada **só entra no
  automático com declaração específica do salão**. Enquanto o canal for manual (C1), o consentimento é
  prova para o futuro, não bloqueio de hoje.
- **Construir sem esperar o advogado:** e-mails de aviso (C6), eliminação após 90 dias (C9, só depois
  do parecer), RIPD, runbook de incidente (3 dias úteis para a ANPD), `job_queue.payload` e
  `webhook_events.payload` na eliminação.
- **Acesso aberto:** Termos §5 e §6 prometem pausa que não acontece com a chave ligada. Resolver antes
  de abrir ao público.

## 10. T10: plataforma e operação interna

**Backoffice interno (não existe; pré-requisito do alpha pago e do serviço entregue)** [Recomendado]:
- Lista de contas (plano, estado, cortesia, última atividade, nível de dados N0 a N3, **degrau da escada**).
- **Marcar conta como paga**, com trilha em `audit_log`.
- Prorrogar cortesia; ligar e desligar o acesso aberto **por conta**.
- **Acesso de suporte com justificativa e registro**, nunca silencioso.
- **Fila do operador de entrega (v2):** salões atendidos, estado da semana, lista liberada ou não,
  minutos gastos, pendências.
- **Livro de retornos e extrato** (T5, T7): ver, conferir, exportar, contestar.
- Funil: cadastro, importou, viu o ouro, chamou, voltou.
- Atrás de **papel de operador do CICLO** e verificação em duas etapas. **É a superfície de ataque mais
  valiosa do sistema.**

**Custos e capacidade:** `docs/88` (fixo estimado em R$ 433 por mês, equilíbrio perto de 8 pagantes
[E]). **A v2 acrescenta o custo de gente** (minutos de operador) à conta. A esteira no navegador tira
a carga de importação do servidor.

**Vigias contra falha silenciosa:** agendador, fila, banco atrasado em relação às migrations, cron do
GitHub que atrasa horas, cobrança que não chega, **extrato que não fecha com a cobrança**. G3 é o
consumidor natural.

## 11. T11: método

Regras que **já valem** (`CLAUDE.md`): RLS sempre; `service_role` só em `with-tenant.ts`; dinheiro em
centavos; núcleo em `src/core` puro; escrita por `/api/v1` com idempotência; Zod na borda; sem `any`;
dado de saúde fora de log; nunca apagar agendamento nem auditoria; um ticket, um commit; **guarda vista
reprovando**; verde não é prova.

**Acrescentar:** modo sombra, portão de regressão de métricas no CI, corpus crescente, registro de
experimentos (inclusive os negativos), paridade navegador e servidor, **teste de contrato de ferramentas
de agente**, retroteste como prova de produto, **e, para o livro de retornos e a cobrança variável:
append-only por constraint de banco, reconciliação mensal automática, teste de propriedade e mutação em
`cobrancaDoMes`**.

**Armadilhas conhecidas do ambiente:**
- A suíte de integração falha em **arquivo diferente a cada rodada em paralelo** e passa isolada; verde
  limpo: `npx vitest run --config vitest.banco.config.ts --dir tests/integration --no-file-parallelism`.
  O `pnpm verify` completo passa de 10 minutos: **rodar em segundo plano**.
- Windows: `git add` **por nome**; avisos de CRLF são esperados; comando acima de ~8 KB trunca; **scripts
  com regex e `\n` em heredoc de Python corrompem**: usar a ferramenta de escrita de arquivo.
- **Commitar antes de mutar**; confirmar que a mutação foi aplicada.
- Pare o servidor de desenvolvimento antes de `pnpm build`.
- Banco local pode estar com migrations fora de ordem.
- **Duas sessões na mesma árvore** já commitaram trabalho uma da outra.

## 12. Dependências e caminho crítico

```
 T2 Esteira Onda 1 ──► T2 Onda 2 (histórico) ──► T3 Backtest ──► T3 Experimentos ──► Motor v2 (sombra)
        │                       │                      │
        │                       └──────► T5 Retroteste ◄┘
        ▼                                                   T5 Livro de retornos + braço de controle
   G1 Importação                                                        │
   G4 Onboarding                                                        ▼
                                                              T7 Extrato + operador ──► T6 Cobrança variável
 T10 Backoffice ──► T6 Cobrança manual ──► T6 Interface de provedor ──► T6 Adaptador Asaas/MP
 T9 Fundir #143/#144 ──► C6 e-mails ──► (parecer) ──► contrato de serviço ──► P2 (híbrido)
 T4 Consentimento ──► (BSP, C1) ──► P3 (canal oficial)
 G3 Operações (independente, cedo)
```

### 12.1 Sequência de evidência (v3): pilotar antes de construir

```
S0  decidir e medir   │ resolver C1 a C7 · GO-0 (funil) · fundir #143/#144 · decidir `reminders` (D6)
S1  pilotar sem código│ 5 salões, o Eduardo importa pelo WhatsApp (decidido) · diagnóstico grátis ·
                      │ medir: aceita pagar? quanto tempo? o que trava? (critérios de morte, 4.5)
S2  construir o que a │ só o que o piloto e o GO-0 provarem: esteira Onda 1 (+ vCard e texto colado),
    evidência pedir   │ livro de retornos e braço de controle, backoffice
S3  cobrar            │ P1 (fixo) · depois P2 (híbrido) pelos portões da 4.5
```

**Por quê:** o repositório mostra funil sem medição, canal desligado e nenhuma paridade urgente
(seção 2.5). O pedido de ter **a melhor** esteira, o melhor Motor e o serviço entregue continua de
pé, e **a sequência de evidência é o jeito de chegar lá sem construir às cegas**. Onde o Eduardo
mandar construir antes da evidência, **a diretriz dele vale**, e o plano registra o risco.

### 12.2 Caminhos críticos

**Caminho crítico até o alpha pago (degraus 1 e 2):** T10 backoffice + cobrança manual **e** T2 Onda 1
**e** T9 fundir e revisar.
**Caminho crítico até o degrau 3:** T5 (livro e controle) → portão do dia 35 → T7 (extrato e operador) →
contrato e parecer → T6 variável (P2).

## 13. Como executar com várias contas e agentes

- **Um worktree e uma branch por trilha**, nunca duas sessões na mesma árvore.
- **Contrato por tarefa:** escopo exato, o que **não** tocar, critério de pronto, prova. Para Codex ou
  outra conta: `AGENTS.md` apontando para o `CLAUDE.md`.
- **Entregável pequeno:** um PR por estação da esteira, por hipótese do Motor, por adaptador, por tabela.
- **Revisão cruzada:** o PR de uma conta é revisado por outra, **com as mutações refeitas**.
- **Fica com humano:** Onda 2 da esteira, texto jurídico, migration e RLS, **tudo que mexe no livro de
  retornos e na cobrança**, decisões de preço e provedor.
- Empurrar vários commits seguidos reinicia o job de banco da CI (~5 minutos): juntar antes.

## 14. Medidas de sucesso (por trilha)

| Trilha | Medida | Meta inicial [E] |
|---|---|---|
| T1 | cadastro até o primeiro ouro | < 15 min |
| T1 | diagnósticos que viram degrau 3 ou 1 | a medir no piloto |
| T2 | arquivos sem pergunta; falso-aceite | ≥ 70%; **0** no corpus |
| T3 | precisão@k do Motor v2 contra o v1; Brier | v2 só entra se vencer |
| T4 | chamadas por dia útil; cliques que viram agendamento | a medir |
| T5 | **diferença tratamento × controle** (p.p.) | **≥ 4** no portão do dia 35 |
| T5 | retroteste mostrado com amostra dita | 100% das importações N2 |
| T6 | pagamentos em dia; taxa efetiva | ≥ 90%; ≤ 3% |
| T7 | **minutos de operador por salão por semana** | **≤ 15** |
| T7 | **salões supervisionados por pessoa** | a medir; define o preço |
| T7 | contestações de extrato | < 5% dos extratos |
| T8 | tarefas do agente aceitas sem edição; custo por conta | a medir; teto fixado |
| T9 | itens do dossiê respondidos; incidentes | 0 sem registro |
| T10 | falhas silenciosas pegas por vigia antes da reclamação | 100% |

## 15. Riscos (os que mais custam)

| Risco | Resposta |
|---|---|
| **Disputa de atribuição** no preço por resultado | métrica binária, β contratual, extrato auditável, direito de contestar |
| **Risco moral:** chamar quem voltaria sozinho para inflar | exclusões da 4.2, β, braço de controle |
| **Dono que não chama a lista** e esconde o resultado | SLA do dono; fixo continua; sem chamada, sem variável |
| **Receita imprevisível** | híbrido com fixo; teto; piso zero no variável |
| **Serviço que não escala** (minutos por salão) | meta de 15 min; G2 faz o trabalho; preço sobe se estourar |
| Cobrança variável quebrando a guarda do Mercado Pago | cobrança avulsa calculada, nunca a assinatura de valor fixo |
| Escolher provedor errado e ficar preso | interface com adaptadores; começar manual |
| **Promessa dos Termos que o código não cumpre** | C6 antes de abrir; revisar texto com o acesso aberto |
| Agente decidindo sozinho e errando com cliente final | escada de autonomia; L1 como teto; WhatsApp manual; agente nunca escreve no livro |
| IA de terceiros quebrando a política de privacidade | IA no aparelho; terceiros só com parecer |
| Esteira classificando coluna errada sem ninguém ver | falso-aceite zero, prévia, controle de totais |
| Motor v2 pior que o v1 sem perceber | backtest, modo sombra, regra de adoção |
| Backoffice vazando acesso | papel de operador, 2FA, trilha, justificativa |
| Falha silenciosa | G3 e vigias |
| Enquadramento fiscal errado (serviço versus software) | contador antes do P2 |
| Duas contas pisando uma na outra | worktrees, contratos, revisão cruzada |
| Concorrente copiar a ideia | o diferencial é o **conjunto** (entrada, motor, prova, livro auditável, saída aberta, operação) |

## 16. O que depende do Eduardo (lista única)

0. **(v3) Decidir `reminders` em produção** (D6): é o que destrava o canal e o texto "WhatsApp incluído".
1. **Resolver os conflitos C1 a C7** (seção 2.3), principalmente **C3 (quem decide)**, **C4 (regra de
   produção)** e **C2 (preços)**.
2. **Aceitar ou recusar o degrau 3 e o preço por resultado** (e o desenho híbrido com β e controle).
3. **Provedor de cobrança** e **enquadramento fiscal** (serviço, ISS, Simples, ME).
4. **Preço** de cada degrau e o texto de fundador.
5. **Fundir #143 e #144** e aplicar as migrations de produção antes do código (`0092` a `0098`, e as
   seguintes: **conferir o que já está em produção**, pois a outra conta aplica por conta própria).
6. **Variáveis de contato** e planos pagos de Vercel e Supabase.
7. **Texto do aviso de cobrança** ("avisamos antes de qualquer cobrança", já no Meu plano).
8. **Recepcionista de IA:** construir ou integrar.
9. **Advogado:** lista da seção 9, **mais o contrato de serviço**.
10. **Prints de preços e telas** dos concorrentes brasileiros e **2 ou 3 arquivos reais** de exportação.
11. **Quem é o operador de entrega** (uma pessoa, e quantos minutos por semana ela tem).
12. **Datas** do alpha e da abertura pública.

## 17. O que esta versão NÃO fez

Não testou produto nenhum; **não abriu o guia oficial do Banco Central** (o valor variável do Pix
Automático vem de notícias e da documentação do Asaas, e **precisa de confirmação no sandbox**); **o texto da
Meta veio de um resumo automático da página oficial**, não de leitura minha do contrato inteiro; não
confirmou taxa nem exigência de cadastro do Asaas nem do Mercado Pago; **não achou canal de distribuição**
nem concorrente brasileiro que cobre por resultado; não mediu nenhuma hipótese do Motor; **todos os números
da seção 4.4 (fixo, taxa de 20%, β de 3%, minutos por salão) são hipótese minha, não medição**; **os preços
da seção 2.6 marcados [P hoje] são de 07/10/2026** (Trinks e BarbUp) e os [P antigo] vêm de `competitors/*`;
**o plano da Belasis não publica preço**; a citação da Harvard Business Review vem de uma matéria, não foi
conferida; não escreveu código. Tudo marcado [S] é ponto de partida e [E] é conta a confirmar.
