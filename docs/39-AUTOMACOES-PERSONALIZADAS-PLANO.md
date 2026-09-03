# 39 · AUTOMAÇÕES PERSONALIZADAS — PESQUISA E PLANO

Pedido do Eduardo em 2026-09-03: *"aprimorar funções também de automação, copy errada, e do agente
e de automação, e para o cliente poder criar e personalizar a sua própria automação"*.

Este documento é **pesquisa e desenho**. A recomendação principal contraria a leitura literal do
pedido, e o §4 explica por quê.

---

## 1 · O que existe hoje, lido no código

`src/core/automacoes/catalogo.ts` é melhor do que o pedido supõe. Seis automações fixas, e sobre
cada uma um **dial de autonomia de três níveis** (`docs/33` §3.1):

| Nível | Nome | O que faz |
|---|---|---|
| 1 | Só me avisa | encontra e mostra; a pessoa decide tudo (**padrão de fábrica**) |
| 2 | Deixa pronto | encontra e prepara a mensagem; a pessoa confere e envia |
| 3 | Faz e me conta | executa e registra |

E três decisões que já estão certas e não vou reabrir:

- **Teto por automação, com motivo escrito na tela.** Campanha de recuperação para no nível 2
  porque alcança mais de uma pessoa de uma vez — *"um erro que atinge 1 cliente é constrangimento;
  que atinge 46 é a reputação do salão"*.
- **`rodaDeVerdade()` separa "o dono escolheu" de "o produto consegue"**, lendo `ROTAS_AGENDADAS`.
  É o que impede a tela de dizer que algo sai sozinho enquanto `reminders` está fora do `cron.yml`.
- **Padrão de fábrica é sempre 1.** Subir é opt-in explícito.

**O que o dono NÃO consegue mudar hoje:** o texto que sai, o gatilho (quantos dias, qual limite) e
quais clientes entram. O dial é o único parafuso.

---

## 2 · A pesquisa

Consultada em 2026-09-03.

### 2.1 · O padrão universal é gatilho → ação

Todo construtor para não-técnico (Zapier, Activepieces, Monday) monta a mesma frase: *quando
acontece X, faça Y*. É o vocabulário que o público entende, e é o que este documento reaproveita —
não o construtor visual.

### 2.2 · A virada de 2026, e ela importa aqui

> O maior movimento de 2026 é sair de "gatilho → ação" para **"descreva o que você quer"**: o
> construtor de IA da Zapier, os passos de IA do Relay e os módulos da Make deixam montar automação
> em linguagem natural, e isso colapsa a curva de aprendizado de trinta minutos de configuração
> para duas frases.

O CICLO **já tem** o assistente. Isso muda a pergunta: se um dia houver automação personalizada
aqui, a porta de entrada natural não é uma tela de configuração — é descrever em português.

### 2.3 · O que a pesquisa NÃO resolve, e é o que decide

Nenhuma dessas ferramentas tem o problema que o CICLO tem: **elas executam.** A Zapier manda o
e-mail. O CICLO **não manda mensagem nenhuma sozinho** — `reminders` e `campaigns` estão fora do
`on.schedule` do `cron.yml`, de propósito, e dependem de credencial da Meta que não existe
(TICKET-043). Copiar o desenho delas seria construir um formulário que promete disparo.

---

## 3 · A tensão central, dita sem rodeio

Um construtor de automação onde a automação não roda é a **maior promessa vazia que este produto
pode fazer**, e ele já tem histórico dessa classe: `fee_cents`, `media.consent_id`, `tenants.plan`,
`clients.referred_by`, `trial_ends_at`, "fale com a gente" sem canal. Todas nasceram do mesmo jeito
— a peça foi construída, o outro lado não, e nada avisou.

Um construtor seria a versão mais cara disso, porque **a pessoa gasta tempo montando** antes de
descobrir. Nas outras, ela só não recebia o valor; nesta, ela trabalha para não receber.

---

## 4 · Recomendação: parametrizar o que existe, não construir um construtor

**Não recomendo construtor de automação livre.** Recomendo abrir os parafusos das seis que já
existem — que é o que "personalizar a sua própria automação" significa na prática para este
público, e o que dá para entregar sem prometer infraestrutura ausente.

Quatro parafusos, em ordem de valor por risco:

| # | Parafuso | Por que vale | Depende de infra ausente? |
|---|---|---|---|
| **P1** | **O texto de cada automação** | é o que a cliente lê, e hoje é fixo. Os modelos já existem em `mensagens-prontas.ts` e o dial nível 2 já prepara mensagem — falta o dono escolher QUAL modelo cada automação usa | **não** |
| **P2** | **O gatilho de tempo** ("chamar quem passou de N dias") | hoje sai do `cycle_days` do serviço; o dono não tem como dizer "para mim, 45" | **não** |
| **P3** | **Quem entra** (filtro por etiqueta, por serviço) | "não quero chamar quem só fez uma vez" é a objeção real de quem tem base grande | **não** |
| **P4** | Automação nova, definida pelo dono | é o pedido literal | **sim** — precisa de executor |

**Comece por P1.** É o que a pessoa mais sente (é a voz dela falando com a cliente dela), é o mais
barato, e não inventa mecânica nenhuma: a tela passa a escolher, por automação, um modelo de
`mensagens-prontas` que já existe e já é editável.

**P4 fica bloqueado**, e o critério de desbloqueio é objetivo, não uma data: só faz sentido depois
que `reminders`/`campaigns` estiverem no `on.schedule` do `cron.yml` **e** a credencial do TICKET-043
existir. Antes disso, um construtor entrega formulário e não entrega automação.

### 4.1 · Se P4 for feito um dia, a porta é o assistente

Pelo §2.2, e porque o CICLO tem uma vantagem que a Zapier não tem: o assistente já conhece o
vocabulário do negócio (cliente, atendimento, serviço, ciclo). "Chama quem não vem há dois meses e
já gastou mais de 300 reais" é uma frase que ele consegue traduzir em filtro — e o padrão de
PROPOSTA que ele já usa (`preparar_agendamento`: mostra o que vai acontecer, quem confirma é o
dono) é exatamente a forma segura de criar automação: **a IA monta, a pessoa aprova, o produto
executa.** Nunca a IA criando regra que passa a rodar sozinha.

---

## 5 · A copy, que é o outro pedido

O Eduardo apontou "copy errada" na automação e no agente. Três achados, do menor para o maior:

**a) "quanta rédea você dá" é metáfora, e metáfora é a primeira coisa que trava leitura.** O
`docs/20` §C.2 lista as palavras que o produto não usa, e o critério é o mesmo: a frase precisa
funcionar para quem lê rápido, no celular, entre dois atendimentos. "Rédea" exige traduzir antes de
entender.

**b) O título da tela promete mais do que a tela entrega.** "O que o CICLO faz sozinho por você" —
mas das seis automações, **quatro têm teto no nível 1 ou 2**, ou seja, não fazem nada sozinhas por
desenho. A tela é, na maior parte, sobre o que o CICLO NÃO faz sozinho, e por quê. A copy deveria
dizer isso, que é inclusive o argumento de confiança mais forte do produto.

**c) `motivoDoTeto` começa com letra minúscula em duas entradas e maiúscula em quatro.** Some na
leitura, mas aparece na tela colado numa frase, e o resultado é uma emenda torta.

---

## 6 · O que é decisão do Eduardo

1. **P1 (escolher o texto de cada automação) entra agora?** Recomendo sim.
2. **P4 (construtor livre) fica bloqueado até o cron + TICKET-043?** Recomendo sim, e o §3 diz por
   quê.
3. Se P4 for feito, **a porta é o assistente e o desenho é proposta-e-aprovação**, nunca regra que
   a IA cria e passa a rodar. **[Recomendado]**

---

## 7 · Fontes

- [Workflow Automation for Small Businesses: A 2026 Guide — Activepieces](https://www.activepieces.com/blog/workflow-automation-for-small-business)
- [No-Code Automation in 2026: Tools, Workflows and AI — WeWeb](https://www.weweb.io/blog/no-code-automation-guide-tools-workflows-ai)
- [Best AI Automation Platforms for Non-Technical Users (2026) — Bluehost](https://www.bluehost.com/blog/best-ai-automation-platform/)
- [The 9 Best Workflow Automation Software (2026) — Atlassian](https://www.atlassian.com/agile/project-management/workflow-automation-software)
