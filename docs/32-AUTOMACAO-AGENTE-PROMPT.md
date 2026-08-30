# 32 · PROMPT — DO ASSISTENTE AO FUNCIONÁRIO DIGITAL

> Pedido do Eduardo em 2026-08-30. Este arquivo **não é o plano** — é o contrato de como o plano
> tem que ser feito. O plano é `docs/33-AUTOMACAO-AGENTE-PLANO.md`, e só nasce depois deste ser
> aprovado. Mesmo padrão de `docs/17-MONETIZACAO-PROMPT.md` → `docs/18`.

---

## 0 · Papel

Atuar simultaneamente como:

- **Pesquisador de mercado de agentes de IA aplicados a pequeno negócio** — não só o padrão
  bancário que o `docs/26` já cobriu, mas a categoria mais nova de "funcionário digital"/"AI
  employee" que está nascendo em SaaS de automação (Lindy, Bland AI, agentes do HubSpot/GoHighLevel,
  o que existir de IA nos concorrentes diretos do CICLO)
- **Arquiteto de permissão e superfície de risco** — cada ferramenta que pode ganhar modo
  automático precisa de uma resposta escrita para "o que o pior caso custa"
- **Product manager de monetização por camada** — mesma disciplina do `docs/17`, aplicada a UMA
  feature em vez do produto inteiro: o que é "gostinho" grátis, o que é o produto pago de verdade
- **Redator de UX de confiança e controle** — a pessoa que vai decidir "automático ou eu confirmo"
  não é engenheira; a escolha tem que caber numa frase
- **Red teamer do próprio plano** — §8 é obrigatório, não decorativo, e desta vez o alvo principal
  é a hipótese mais perigosa do pedido: automação que roda sem confirmação

### 0.1 · O modo de falha número um deste trabalho

Pedir para um modelo de linguagem escrever sobre "agente de IA autônomo" produz, por padrão,
**hype com vocabulário técnico**: "seu funcionário digital trabalhando 24 horas", sem nunca
descer ao nível de "o que acontece quando ele erra". Isso é mais perigoso aqui do que no
`docs/17`, porque o produto errado não é uma tabela de preço ruim — é uma ação executada sozinha
contra a base de clientes de alguém.

O antídoto: **toda automação proposta neste plano vem com a pergunta "o que o pior caso custa, e
quem sofre" respondida ao lado dela**, não num parágrafo de ressalva no fim. Se a resposta honesta
para uma ferramenta específica for "não dá para automatizar isso sem supervisão", a resposta é
essa — mesmo que o pedido original quisesse o contrário. **Isso vale mais que qualquer plano.**

---

## 1 · Estado de partida — medido em 2026-08-30, não lembrado

| Peça | Estado real |
|---|---|
| `docs/26-AGENTE-IA-PLANO.md` | **Existe inteiro.** Decidiu chamar de "assistente", não "agente", **de propósito** — "agente promete autonomia que este desenho recusa". Rejeitou explicitamente "agente que executa sozinho, sem humano" (§1, item 13). |
| **Fase A do docs/26** | **Construída e mesclada** (PR #29, commit `9f6f968`). 8 ferramentas de leitura, painel lateral, sugestões por tela. **Não está no ar** — falta `GEMINI_API_KEY`, que só o Eduardo cria. |
| **Fase B do docs/26** (propostas com confirmação — mensagem de recuperação, orçamento, campanha) | Desenhada, **travada em ≥10 pagantes**, de propósito. |
| **Fase C do docs/26** (resumo proativo, sem LLM) | Desenhada, **travada em ≥30 pagantes**. |
| **Fase D do docs/26** (assistente falando com cliente final) | "Condicional, provavelmente nunca" — território da Meta. |
| Pagantes | **Zero**, medido em produção nesta mesma sessão (2026-08-30). |
| `tenants.plan` | **Agora tem escritor** (`scripts/promover-tenant.mjs`, 2026-08-30) — não tinha quando o `docs/26` foi escrito. A trava de plano por módulo (`tenant_modules`, `exigirModulo`) já funciona de ponta a ponta. |
| Contas de teste | Existem 3 tenants (`teste-essencial`, `teste-equipe`, `teste-avancado`), cada um no degrau certo, com histórico fictício — dá para **testar qualquer desenho de tiering nesta rodada sem mexer em cliente real**. |
| Motor de Ciclo (`recompute-cycles`) | Consertado nesta sessão: roda em todo disparo do agendador, **não depende mais de hora do dia** — é um gancho técnico já confiável para qualquer automação futura que precise de um "quando" recorrente. |
| `rate-limit.ts` | Existe, em Postgres, já usado por outras rotas — é a peça que qualquer teto de ações automáticas por tenant vai reusar. |
| `writeAudit()` + lista `REDIGIR` | Existe, já usada pelo assistente da Fase A para gravar pergunta (não resposta). |

**O que mudou desde o `docs/26` e importa para este prompt:** a infraestrutura de plano amadureceu
(escritor + módulos funcionando), e existe ambiente de teste pronto. **O que não mudou:** zero
pagantes, e as quatro regras inegociáveis do `docs/26 §1.4` continuam de pé — ver §5.

---

## 2 · O que este prompt pede que o `docs/26` não pediu

O `docs/26` respondeu "como construir um assistente seguro dentro do painel". Este prompt pede
três coisas novas, na ordem em que o Eduardo as trouxe:

1. **Automação de verdade, não só leitura e proposta.** Ele quer algo que se pareça com "mandar
   uma tarefa para um funcionário" — enviar uma instrução e o CICLO resolver sozinho, não só
   responder pergunta.
2. **O grau de automação é escolha de quem usa, por ferramenta, a qualquer momento** — de "avisa e
   eu decido" até "faz sozinho e me conta depois". Não é um interruptor único de produto.
3. **Isso vira parte do empacotamento de plano** — um gostinho limitado nos planos de baixo, a
   coisa inteira no plano de cima, como alavanca de upgrade (mesmo motor de "prova primeiro, cobre
   depois" que o `docs/30 §5` já desenhou para a indicação).

**A tensão central que este documento existe para resolver:** o item 13 do `docs/26 §1`
("agente que executa sozinho — Rejeitar") e a regra inegociável "escrita exige confirmação
humana" (`docs/26 §0` item 4) foram escritas como **arquitetura fixa do produto**. O pedido de
hoje pede para tratá-las como **escolha do usuário, por ação**, não uma porta fechada para
sempre. Isso não é descartar a razão original (injeção por texto de terceiro, erro de modelo
virando ação em massa — `docs/26 §4.3`) — é perguntar sob que condições ela pode ser **suspensa
deliberadamente**, ação por ação, sem reabrir o risco que a fechou.

---

## 3 · Padrão de evidência

Mesma disciplina do `docs/17 §2` e do `docs/22 §2`, sem exceção:

### 3.1 · Pesquisa é com ferramenta, não de memória

Todo recurso de concorrente ou de produto de automação/agente citado sai de `WebSearch`/`WebFetch`
na página real, com **URL e data de consulta**. Se um concorrente promete "IA que faz tudo
sozinha" mas a letra miúda mostra confirmação obrigatória em tudo — **isso é um achado**, não uma
nota de rodapé, e entra na tabela como tal.

### 3.2 · Fato do próprio produto é lido, não lembrado

Antes de propor qualquer automação nova: ler `docs/26` inteiro, o código de
`src/core/assistente/` e `src/server/services/assistente.ts`, o `rate-limit.ts`, o
`job-queue.ts` (que já processa trabalho assíncrono — pode ser a peça que falta para "fazer
sozinho e avisar depois"), e o estado real do banco (zero pagantes, os módulos por plano).

### 3.3 · Três rótulos, nunca misturados

| Rótulo | Significa |
|---|---|
| **Medido** | Vem de fonte externa citada, ou do banco/código deste projeto |
| **Estimado** | Cálculo próprio a partir de coisas medidas — a fórmula aparece |
| **Suposto** | Não há base; é premissa de trabalho, e está marcada como tal |

---

## 4 · As tensões que o plano tem que resolver

### 4.1 · Autonomia opcional convive com "confirmação sempre"?

A pergunta central do §2. Resposta não pode ser "sim, sempre" nem "não, nunca" — tem que ser
**por ferramenta**, com um critério explícito de quais ações podem ganhar modo automático e quais
nunca podem, custe o que custar em ambição do pedido. Ver §6 Fase B.

### 4.2 · Tiering por plano sem repetir o erro do `docs/17 §4.8`

Aquele prompt já registrou: "todo limite proposto será Suposto até existir uso real". Zero
pagantes continua valendo aqui. O plano não pode inventar "3 automações grátis por mês" sem dizer
que é Suposto e sem desenhar como sair dessa condição (medir, depois ajustar).

### 4.3 · Granularidade da escolha do usuário

Um dial por ferramenta é mais correto e mais complexo que um interruptor global. Um interruptor
global é mais simples e esconde que "mandar mensagem de recuperação sozinho" e "remarcar
agendamento sozinho" têm riscos completamente diferentes. O plano precisa decidir o nível de
granularidade e defender por quê — inclusive se a resposta for "menos granular do que o pedido
original, e eis o motivo".

### 4.4 · É a hora certa?

Mesma pergunta do `docs/18 §D.8` aplicada aqui: zero pagantes, e o `docs/26 §0.1` já registrou que
construir isto compete com as conversas de venda. A Fase A do assistente **nem está no ar ainda**
(falta a chave). Faz sentido desenhar automação em cima de uma fundação que ninguém usou de
verdade? O plano precisa responder isso de frente, não empurrar para uma nota de rodapé.

### 4.5 · O enquadramento "funcionário" cria expectativa que o produto não cumpre?

"Funcionário digital" é uma promessa forte. Se o produto de verdade é "prepara e você confirma com
um toque" para a maioria das ferramentas, chamar isso de "funcionário" pode ser a mesma classe de
erro que o `docs/26 §1` item 3 já evitou ao rejeitar "persona elaborada" — prometer inteligência
que decepciona no primeiro uso.

---

## 5 · O que NÃO é reaberto — regras que continuam de pé

As quatro regras inegociáveis do `docs/26 §0` item 4 **não são renegociadas por este prompt**,
mesmo que a pergunta de autonomia esteja aberta:

1. **O modelo nunca produz número.** Toda cifra vem de consulta ao serviço existente.
2. **O modelo nunca escreve SQL.** Ferramentas fixas, sempre.
3. **Dado de saúde nunca entra no contexto.** Por construção, não por instrução no prompt.
4. **Trilha de auditoria de tudo.** Automação sem confirmação **aumenta**, não diminui, a exigência
   de log — se ninguém apertou o botão, o log é a única prova de que aconteceu e por quê.

O que está em aberto é **só** a regra "escrita exige confirmação humana" — e mesmo essa,
condicionada a tudo que o §4.1 e a Fase B (§6) exigirem antes de qualquer ferramenta ganhar o
direito de rodar sem clique.

**Duas coisas que continuam fora de cogitação, sem exceção, com ou sem modo automático:**

- **Assistente falando com o cliente final** continua rejeitado (`docs/26 §1` item 14) — este
  prompt é sobre o que o assistente faz **para o dono**, nunca sobre falar em nome dele sem ele
  ter visto.
- **Nenhuma ferramenta ganha `service_role`.** O argumento mais forte do `docs/26 §9` — "o modelo
  nunca vê consulta, só resultado já filtrado pela RLS" — vale igual para modo automático. Rodar
  sozinho não pode significar rodar com privilégio maior.

---

## 6 · Fases da pesquisa

### FASE A · O mercado de "agente"/"funcionário digital" — além do banco

O `docs/26 §1` já pesquisou o padrão bancário (contenção, não chat). Falta a categoria mais nova e
mais parecida com o pedido de hoje: produtos que vendem automação real para negócio pequeno.

Pesquisar, com `WebSearch`/`WebFetch`, URL e data:

1. **Agentes de automação B2B genéricos** — o que Lindy, Bland AI, GoHighLevel (automação +
   agenda), HubSpot (AI agents), Zapier (Agents) vendem hoje como "faz sozinho" de verdade vs. o
   que é proposta com clique disfarçada de automático.
2. **IA nos concorrentes diretos do CICLO** — Trinks, Fresha, Booksy, Avec: algum já lançou
   assistente ou automação com IA? O que faz sem supervisão, se algo?
3. **"AI receptionist"/"AI employee" como categoria** — como esses produtos comunicam confiança e
   controle na própria interface (não no marketing). Onde fica o botão de desligar. Como mostram
   "o que a IA fez enquanto você não estava olhando".
4. **Casos públicos de dano por automação sem supervisão** — pelo menos dois exemplos reais
   (chatbot que prometeu coisa errada, agente que executou ação indevida). Isso alimenta o red
   team do §8 com fato, não hipótese.

Fechar com: **o que o mercado chama de "automático" na prática tem quanta supervisão embutida, e
onde o CICLO pode ser mais honesto que a média** (mesmo espírito do `docs/17` sobre preço
transparente).

### FASE B · Risco por ferramenta — a peça que decide tudo

Para **cada** ferramenta candidata (as 8 de leitura do `docs/26`, as 3 de proposta da Fase B
daquele plano, e qualquer nova que a Fase A aqui sugerir), preencher:

| Ferramenta | Reversível? | Alcance (1 cliente / vários / base inteira) | Custo de erro | Pode ganhar modo automático? |
|---|---|---|---|---|

**A regra de decisão tem que ser escrita antes de preencher a tabela**, não deduzida depois dela —
por exemplo: "alcance = base inteira" desqualifica automático sozinho, não importa quão reversível.
Candidatos óbvios para NUNCA (escrever o porquê, não só marcar):

- Enviar campanha para mais de N clientes de uma vez sem confirmação
- Qualquer coisa que toque `vault`/`health_records`
- Cancelar ou remarcar agendamento sem o cliente ter pedido
- Mudar preço, plano ou qualquer coisa de cobrança

Candidatos plausíveis para automático, com condição:

- Mandar lembrete de agendamento já confirmado (baixo alcance, reversível — a mensagem já ia sair
  de qualquer forma via `reminders`, é só quem decide o texto)
- Marcar produto para reposição quando bate o `reorder_point` (já é dado, não ação sobre pessoa)
- Preparar (não enviar) o rascunho de campanha de recuperação toda semana, esperando o dono abrir

### FASE C · O desenho do "dial" de autonomia

Com a tabela da Fase B pronta:

- **Quantos níveis, e o nome de cada um** em português simples — de "só avisa" a "faz e conta
  depois". Testar o texto contra a régua do `03-DESIGN-SYSTEM.md` (pt-BR sem jargão).
- **Padrão de fábrica é sempre o nível mais conservador**, opt-in explícito para subir — mesma
  filosofia de "nunca degradar em silêncio" do `docs/26 §4.4`, aplicada ao contrário: nunca
  automatizar em silêncio.
- **Onde a escolha mora na tela** — por ferramenta, dentro do painel do assistente, ou uma tela
  própria de "automações"? Craft de interface, não só arquitetura.
- **O que acontece quando o dono muda de ideia** — desligar automação em andamento precisa ser
  instantâneo (mesmo padrão de kill switch do `docs/26 §4.4`).

### FASE D · Tiering por plano — o "gostinho"

Ancorado no que o `docs/18` (monetização) já decidiu sobre módulos e no que este prompt descobrir
na Fase A/B:

- **O que é o gostinho no Grátis/Essencial** — uma ferramenta só? Um teto de ações por mês? Repetir
  o padrão do `docs/30 §5.3` (a barra `38/50` como gatilho de upgrade) — automação também pode ter
  um contador visível que empurra para o plano de cima.
- **O que só existe no topo** — provavelmente o modo "faz sozinho" para o maior número de
  ferramentas, e o maior teto de ações/dia.
- **A pergunta que valida cada degrau** (mesma do `docs/17 Fase D`): qual dor específica faz
  alguém pagar mais por isto especificamente? Se a resposta for "só porque é mais completo", o
  degrau não se sustenta.
- Testar o desenho nas 3 contas já existentes (`teste-essencial`, `teste-equipe`,
  `teste-avancado`) antes de considerar pronto.

### FASE E · Posicionamento — "funcionário digital" sem prometer demais

- Pesquisar como a Fase A comunica esse enquadramento sem virar a promessa vazia que o
  `docs/26 §1` item 3 já evitou uma vez.
- Escrever a frase que o produto usa (equivalente ao rodapé do `docs/26 §5`: *"o assistente lê os
  mesmos dados que você já vê..."*) para o modo automático — algo como *"o que está ligado no
  automático, e o que ele fez enquanto você não estava olhando"*, sempre visível.
- Testar contra o `docs/17 §5.10` (psicologia sim, padrão escuro não): a escolha de automação não
  pode ser desenhada para empurrar o dono a ligar mais do que ele entende que ligou.

### FASE F · Segurança específica de rodar sem supervisão

- **Teto de ações automáticas por tenant por dia**, reusando `rate-limit.ts` — separado do teto de
  perguntas que o `docs/26 §4.4` já definiu (60/dia), porque ação tem custo de erro maior que
  pergunta.
- **Uma tela própria de "o que o assistente fez sozinho"** — não escondida dentro da auditoria
  técnica, visível para o dono, com desfazer quando existir.
- **Reavaliar a mitigação de injeção do `docs/26 §4.3`** especificamente para o caminho automático:
  se um nome de cliente hostil já é risco quando o dono LÊ a resposta, o risco é maior quando a
  ação SAI sozinha. A Fase 1 do `docs/26` se defendia dizendo "não tem ferramenta de escrita" —
  esse argumento cai aqui, então precisa de substituto.
- **Circuit breaker**: se X ações automáticas falharem ou gerarem reclamação em sequência, o modo
  automático daquele tenant cai para manual sozinho, com aviso — não é o dono que precisa notar.

### FASE G · Sequenciamento — onde isto entra nas fases que já existem

- Isto é uma extensão da Fase B do `docs/26` (que já travava em ≥10 pagantes), ou uma Fase nova,
  atrás dela? **Recomendação com argumento**, não só opinião.
- O que precisa ser verdade antes de escrever a primeira linha: a Fase A no ar (chave criada) +
  uso real medido, na leitura do `docs/26 §9` métrica de corte (1 pergunta/semana/tenant).
- Dizer explicitamente **o que dá para prototipar e testar nas 3 contas de teste sem nenhum
  pagante** (é permitido e barato) versus **o que só faz sentido decidir com uso real** (é a
  maioria do desenho de tiering).

---

## 7 · Classificação obrigatória

| Nível | Critério |
|---|---|
| **Decidido** | Há dado (Medido) ou regra já registrada em doc — inclusive as do §5 que não são reabertas. |
| **Recomendado** | Há argumento e recomendação clara, mas é aposta. Vai com a recomendação **e** com o que muda se for o contrário. |
| **Do Eduardo** | Depende de apetite de risco ou de marca — nunca escolher sozinho e seguir. |
| **Bloqueado** | Depende de credencial (a `GEMINI_API_KEY`, primeiro de todos) ou de uso real que ainda não existe. |

**"Do Eduardo" disfarçado de "Decidido" é o pior defeito possível deste documento** — mesma regra
do `docs/17 §7`, e vale em dobro aqui: a decisão de permitir automação sem confirmação em QUALQUER
ferramenta é, por natureza, Do Eduardo. O plano recomenda; ele autoriza ferramenta por ferramenta.

---

## 8 · Red team obrigatório

Seção própria no plano, escrita **contra** o resto dele.

1. **Pré-mortem do pior caso concreto.** Seis meses depois, o modo automático de uma ferramenta
   causou dano real — mensagem errada para a base inteira, ou ação tomada em cima de dado
   injetado por um cliente mal-intencionado no campo `name`. Escrever a história de como aconteceu,
   apontando exatamente qual linha deste plano deveria ter impedido e por que não impediu.
2. **O caso contra construir isto agora.** Zero pagantes, Fase A do `docs/26` nem está no ar, e
   `docs/26 §0.1` já registrou que isto compete com as 20 conversas de venda. Escrever o argumento
   mais forte para **esperar** — com honestidade, sem palha — e só depois a resposta a ele.
3. **Ataque ao enquadramento "funcionário digital".** Em que cenário essa promessa gera reclamação
   pública ou decepção que uma marca pequena, que vive de boca a boca (`docs/18 §13.1`), não se
   recupera?
4. **Ataque à tabela de risco da Fase B.** Qual ferramenta classificada como "pode ser automática"
   na tabela na verdade não deveria — e por que a régua deixou passar?
5. **O concorrente que faz isto melhor.** Se um concorrente lançar "modo automático" antes e sem
   os freios que este plano propõe, ele parece mais avançado por fora. O plano precisa argumentar
   por que ir mais devagar é a escolha certa mesmo perdendo essa corrida de percepção.
6. **Onde este plano usa "Suposto" como se fosse "Medido"** — auditoria do próprio documento,
   igual ao `docs/17 §8` item 6.

---

## 9 · Formato de entrega

**Nesta rodada: só o plano.** `docs/33-AUTOMACAO-AGENTE-PLANO.md`, **nenhuma linha de código,
nenhuma migration, nenhuma tela.** As 3 contas de teste existentes podem ser usadas para
**protótipo de conversa/wireframe**, nunca para implementar automação de verdade nesta rodada.

Por fase: o que foi pesquisado/decidido · recomendação · o que muda se for diferente ·
classificação (§7) · o que fica para o Eduardo.

Contratos de tabela obrigatórios:

**Mercado (Fase A)**
`Produto | O que chama de "automático" | Supervisão real embutida | Como comunica controle | Fonte (URL) | Consultado em`

**Risco por ferramenta (Fase B)**
`Ferramenta | Reversível? | Alcance | Custo de erro | Pode ser automática? | Condição`

**Tiering (Fase D)**
`Plano | O que libera de automação | Teto de ações | A dor que faz subir daqui | Classificação`

Fechar com **duas listas que não se misturam**: o que é **decidido com base** e o que é **aposta**.

---

## 10 · Fora de escopo, de propósito

- Reabrir a Fase A do `docs/26` (as 8 ferramentas de leitura) — ela já está pronta, só falta a
  chave
- Assistente falando com cliente final, em qualquer grau de automação (§5)
- Qualquer ferramenta com `service_role` (§5)
- Escolher ou integrar um segundo provider de LLM
- Construir a tela de automação — desenho vai no plano, código não nesta rodada
- Resolver a `GEMINI_API_KEY` — continua bloqueado no Eduardo, e sem ela nada disto roda de
  verdade, mesmo com o plano pronto

---

## 11 · Definição de pronto

- [ ] Fases A–G têm seção própria; nenhuma pulada
- [ ] Toda automação de mercado citada com **URL e data**; todo número com rótulo
      Medido/Estimado/Suposto
- [ ] A tabela de risco da Fase B cobre **toda** ferramenta do `docs/26` mais as que a Fase A daqui
      sugerir, com a regra de decisão escrita antes da tabela, não depois
- [ ] As cinco tensões do §4 respondidas de frente, nenhuma empurrada para nota de rodapé
- [ ] §5 confirmado intacto — nenhuma das quatro regras inegociáveis do `docs/26` foi silenciosamente
      afrouxada para caber o pedido
- [ ] Cada item classificado pelo §7, com "Do Eduardo" aplicado à decisão de automação por
      ferramenta, não deduzida por mim
- [ ] §8 escrito de verdade contra o plano, incluindo o caso de esperar e o pré-mortem concreto
- [ ] §G diz exatamente o que precisa ser verdade (chave criada, uso medido) antes de a Fase B do
      `docs/26` — ou a nova fase que este plano propuser — começar a valer
- [ ] Nada foi construído — o plano é o entregável
