# 83 · Onboarding geral + migração de quem vem de outro sistema — pesquisa e plano

> Gerado pela missão `.claude/ciclo/loop-migracao-de-concorrentes.md` (2026-09-28, Opus 5.5).
> **Plano, não execução** — nenhuma linha de produto foi alterada. Um bug real achado no caminho
> virou o **BL-51** em `.claude/ciclo/autonomous-backlog.md`.
>
> **Atualização 2026-09-28 — decisões do Eduardo sobre o §9** (`docs/DECISOES.md`):
> (1) **benefício para quem traz a base: sim** — 1 mês do Essencial para quem importa com a data da
> última visita; (2) **nomear concorrentes no produto: sim**, só com fato verificável; (3) **ele
> mesmo importa pelo WhatsApp para as primeiras contas: sim**. E **Trinks sai do foco** — o
> passo a passo "Vindo do Trinks" (P2) sai da fila; foco em AppBarber, Belasis, BarbUp, caderno e
> planilha. A estratégia de dados e a camada de inteligência que o Eduardo pediu junto moram em
> `docs/84` — este documento continua sendo só onboarding e migração.
>
> Legenda: **[FATO]** medido no código/banco/teste · **[EVIDÊNCIA]** fonte pública citada, com
> data · **[HIPÓTESE]** precisa de validação · **[NÃO VERIFICADO]** tentei e não consegui
> confirmar — nunca preenchido por suposição.

---

## Sumário executivo — leia só isto se tiver 2 minutos

1. **A premissa de "migrar de concorrente" cobre a minoria do público, e o plano tem que dizer
   isso primeiro.** Menos de 30% dos salões usam sistema de gestão **[EVIDÊNCIA, Sebrae via UAI,
   18/09/2026]**; o concorrente principal é o caderno e a memória. A pergunta certa no onboarding
   não é "qual sistema você usa?" — é **"onde estão seus clientes hoje?"**, com caderno, WhatsApp,
   planilha, outro sistema e "negócio novo" como respostas igualmente válidas, cada uma levando a
   um caminho diferente. Isso serve os 70% e os 30% com UMA pergunta.
2. **O importador do CICLO quebra exatamente no arquivo que um migrante traz [FATO, medido].**
   CSV salvo pelo Excel em português chega com acentos corrompidos (`João Conceição` →
   `Jo�o Concei��o`, gravado assim no banco) e **toda data `15/08/2026` é descartada em silêncio**
   — só `2026-08-15` é aceita. Sem a data da última visita, o Motor de Ciclo nasce vazio, que é
   justamente o momento em que o produto deveria provar valor. Consertar isso (BL-51) é a
   prioridade nº 1, antes de qualquer tela nova: é barato e destrava toda migração por planilha.
3. **Há um argumento de "somos melhores" que é verificável, não marketing.** Todos os concorrentes
   pesquisados tratam "cliente sumido" por **janela fixa igual para todo mundo** — AppBarber por
   períodos escolhidos à mão num relatório **[EVIDÊNCIA]**, Belasis por 30/60/90 dias
   **[EVIDÊNCIA]**, o setor por 45 dias **[EVIDÊNCIA, `docs/45`]**. O CICLO calcula o ritmo de
   CADA cliente em CADA serviço e lista pelo nome quem passou da hora hoje, com o valor. Esse é o
   pilar. "A gente traz cliente de volta" sozinho **não diferencia** — a Belasis promete
   literalmente "IA que traz cliente de volta".
4. **Migração grátis não é diferencial, é o mínimo do mercado.** BarbUp anuncia "migração sem
   custo extra" e avisa o leitor que outros cobram **[EVIDÊNCIA]**; Belasis diz que "cuida da
   migração pra você", com gerente dedicado **[EVIDÊNCIA]**. A linha "Migração assistida R$ 199"
   de `docs/07` fica **obsoleta** (decisão do Eduardo, confirmada pela pesquisa). O diferencial
   possível do CICLO é outro: **na hora, sem chamado, e com o resultado do Motor aparecendo no
   mesmo minuto** — o AppBarber pede chamado e **até 5 dias úteis**, sem histórico **[EVIDÊNCIA]**.
5. **O maior redutor do medo de trocar já existe no código e não é dito em lugar nenhum:** o CICLO
   funciona **ao lado** do sistema atual, como camada de recuperação (`ja-atendo/page.tsx` já
   documenta esse uso). "Você não precisa largar o AppBarber hoje" é mais persuasivo que qualquer
   comparativo — e é verdade.
6. **A tela de 3 respostas NÃO deve crescer.** Ela tem um freio deliberado ("Três respostas e sua
   página está no ar", comentário em `onboarding/page.tsx`). As perguntas de qualificação entram
   **depois** que a conta existe, numa tela pulável que já roteia para a importação certa.

---

## 1 · O que já existe (confirmado lendo o código, não suposto)

### 1.1 O fluxo de hoje **[FATO]**

```
/cadastro  (nome, e-mail, telefone, senha)
   ↓
/onboarding  "Três respostas e sua página está no ar"
   · nome do negócio · profissão (17 do catálogo + "Outra") · endereço da página
   ↓  executarOnboarding → product_events: conta_criada (+ origem do cookie de primeiro toque)
/admin/hoje  "Primeiros passos" (conta sem cliente e sem agendamento)
   1. Traga quem você já atende → /admin/clientes/ja-atendo  (digitar de memória)
         └ rodapé discreto: "Já tem tudo numa planilha? Importe de um arquivo CSV"
   2. Confira seus serviços e preços
   3. Marque o primeiro horário
   ↓  base_importada (via ja_atendo | csv) → motor_viu_valor → recuperacao_enviada → cliente_voltou
```

- A profissão já **segmenta** alguma coisa: grava os 4 eixos `onde`/`cobranca`/`inicio`/`ritmo`
  no tenant e escolhe o catálogo de serviços (`onboarding.ts`). Qualquer pergunta nova tem que
  somar a isso, não repetir.
- A **origem** da conta (visita, Instagram, parceiro…) já é capturada pelo link (`docs/82` §6),
  sem perguntar nada. **Não perguntar "como nos conheceu"** — seria pedir o que já se sabe.
- O importador de CSV (`importacao-clientes.ts`, 363 linhas) resolve bem a mecânica genérica:
  mapeamento de colunas, validação, duplicata, lotes de 100, 500 linhas em <10s, e a prévia do
  Motor na hora da importação. `ja-atendo` resolve quem não tem planilha — e também o salão que
  **continua em outro sistema** e usa o CICLO como camada de recuperação.

### 1.2 O que o onboarding descobre das 14 dores de `docs/07` §3.2 **[FATO]**

**Nenhuma diretamente.** A profissão infere indiretamente o ritmo (dor 3, "sumiu cliente e eu nem
vi") e o tipo de atendimento. As outras 13 — falta, WhatsApp como agenda, não saber quanto ganha,
comissão, estoque, anamnese, fotos, pacotes, renda instável, preço, equipe que não usa, **medo de
trocar de sistema** (dor 13), review — o produto não sabe se a pessoa tem. Todo tenant novo vê os
mesmos 3 passos, na mesma ordem.

### 1.3 A decisão anterior que este plano precisa reconciliar — GO-1

`.claude/ciclo/growth-opportunities.md` GO-1 (2026-09-21) decidiu, com confiança alta, **"não
construir mais" migração**: o CICLO já tem `importar` + `ja-atendo`, a evidência de demanda era
fraca-a-média, e a maioria do público não tem CSV. **Este plano concorda com o núcleo do GO-1** —
não propõe importador por concorrente nem parser de PDF. Ele reabre o tema por duas razões que o
GO-1 não tinha:

1. **Evidência nova, medida:** o GO-1 assumiu que o importador "já foi validado". Ele funciona
   para CSV em UTF-8 com data ISO — um formato que praticamente nenhum dono brasileiro produz
   (BL-51). O próprio GO-1 previu esse cenário: *"SE tiverem taxa de conclusão baixa, o problema não
   é falta a feature, é fricção dentro da feature que já existe"*. É exatamente isso.
2. **Decisão do dono do produto:** o Eduardo pediu foco em quem vem de outro sistema e em
   onboarding que qualifique o público. O que muda é o **roteamento, o argumento e a confiança**
   em volta do que existe — não a construção de uma feature pesada.

---

## 2 · Evidência de primeira mão (antes de olhar para fora)

- **Produção em 2026-09-23 [FATO, `docs/82` §0]:** 8 contas — 6 demonstração, 1 revisão da Apple,
  1 cadastro real (`ciclos-ana`) com zero cliente. Zero pagante. **Não existe amostra de migrantes
  para estudar.** Tudo que este plano diz sobre "quem troca de sistema" vem de pesquisa externa e
  de raciocínio, e está marcado assim.
- **Busca no repositório** por Trinks/AppBarber/BarbUp/Belasis/planilha/"trocar de sistema" fora
  desta missão: só aparecem em documentos de pesquisa e estratégia (`docs/07`, `docs/43`,
  `docs/45`, `.claude/ciclo/competitors/`). **Nenhuma conversa de suporte, nenhum dono real citando
  que veio de outro sistema.** Achado negativo, registrado como tal.
- **O caso real que existe aponta para outro gargalo:** a única conta real parou na **conta criada
  e vazia** (`docs/82` §7). Para esse caso, a pergunta "onde estão seus clientes?" encurta o
  caminho até o momento "aha" — ela não depende de a pessoa vir de concorrente.

---

## 3 · Concorrentes — o que cada um faz com a troca de sistema

Pesquisa ao vivo em 2026-09-28 (navegador + busca), somada ao que `.claude/ciclo/competitors/`
já tinha (20/09). **"Beleza na Web", citada no pedido, não é concorrente**: é o e-commerce de
cosméticos do Grupo Boticário **[EVIDÊNCIA]** — ficou fora.

### 3.1 Migração PARA DENTRO de cada um (como eles recebem quem chega)

| | O que importa | Formato | Quem faz | Prazo | Histórico de atendimento | Custo |
|---|---|---|---|---|---|---|
| **AppBarber** | clientes, serviços, produtos | XLS, XLSX, CSV | equipe deles, por chamado (no teste: upload na conta; depois: e-mail) | **até 5 dias úteis** | **não** — "não será realizada a importação de agendamentos, relatórios, caixas, comissões" | não cobra (implícito) |
| **Trinks** | cadastro de clientes | Excel | importador self-service; "migração assistida" nomeada na matriz de planos e no tier de redes | [NÃO VERIFICADO] | [NÃO VERIFICADO] | [NÃO VERIFICADO] |
| **Belasis** | "clientes, agenda e histórico" | [NÃO VERIFICADO] | eles fazem, com gerente de conta dedicado | [NÃO VERIFICADO] | **sim, declarado** | [NÃO VERIFICADO] |
| **BarbUp** | agenda atual | [NÃO VERIFICADO] | eles | [NÃO VERIFICADO] | [NÃO VERIFICADO] | **"sem custo extra"** |
| **CICLO hoje** | clientes + última visita | **só CSV UTF-8, data ISO** (BL-51) · ou digitado de memória | a própria pessoa | **na hora** | só a última visita | grátis |

**Leitura honesta:** em "fazer por você", Belasis e BarbUp estão **à frente** do CICLO — têm gente
para isso, o CICLO tem um fundador. Em "na hora, sem esperar ninguém, e vendo o resultado", o
CICLO tem uma vantagem real sobre o AppBarber. O plano joga no segundo campo e não finge o
primeiro.

### 3.2 Exportação PARA FORA (se o dono consegue levar os dados até o CICLO)

| | Exporta clientes? | Evidência |
|---|---|---|
| **Trinks** | **Sim, em Excel**, a partir do Relatório de Clientes, com filtro por "data da última visita" ("sempre o último fechamento de contas do cliente") | `ajuda.trinks.com/importacao-exportacao-de-lista-de-clientes`, `.../relatório-de-clientes-e-crm` **[EVIDÊNCIA, 28/09]**. **Nomes exatos das colunas: [NÃO VERIFICADO]** — a ajuda não lista, e confirmar exigiria conta de teste |
| **AppBarber** | **[NÃO VERIFICADO]** | Nenhum artigo da central de ajuda (Zendesk, 115 resultados para "planilha clientes") explica exportar a lista de clientes. Existe "Relatórios > Agendamentos > Geral/Cliente" com filtro "Realizados" (é o histórico completo), e telas financeiras têm "opções de exportação" — mas o artigo do relatório de agendamentos não confirma botão de exportar |
| **Belasis** | **[NÃO VERIFICADO]** | nada público encontrado |
| **BarbUp** | **[NÃO VERIFICADO]** | nada público encontrado |

**Consequência para o plano:** detecção automática de "isso é um export do Trinks" pelos
cabeçalhos **não pode ser construída agora** — não há cabeçalho verificado de nenhum concorrente.
O que dá para fazer é: aceitar o formato que o Excel brasileiro gera (BL-51), aceitar XLSX
(Trinks e AppBarber trabalham com Excel), e dar à pessoa **o texto pronto para pedir a exportação
ao suporte do sistema antigo** quando ela não souber onde fica o botão.

### 3.3 Como cada um trata "cliente que sumiu" — o coração do argumento

| | Como decide que a cliente sumiu | Quem age | Evidência |
|---|---|---|---|
| **AppBarber** | "Taxa de Retorno por período": o dono **escolhe à mão** um período de primeiro atendimento e um de retorno (ex.: março → abril) e vê um gráfico verde/vermelho; a coluna "Último Retorno" mostra "-" para quem não voltou naquela janela | o dono, se lembrar de abrir o relatório | Zendesk AppBarber, "Retorno por período (Taxa de Retorno)" **[EVIDÊNCIA, 28/09]** |
| **Belasis** | separa quem não aparece há **30, 60 ou 90 dias** — as mesmas três faixas para toda cliente | "a equipe manda mensagens para cada grupo" | UAI, 25/09/2026 **[EVIDÊNCIA]**; site: "IA que traz cliente de volta" **[EVIDÊNCIA]** |
| **Trinks** | "lembretes e convite de retorno"; o setor recomenda janela fixa (~45 dias) | WhatsApp/SMS/e-mail é **add-on pago** | `competitors/trinks.md` **[EVIDÊNCIA, 20/09]** |
| **CICLO** | **ritmo pessoal de cada cliente em cada serviço** (mediana dos intervalos, `computeCycle`), prevê o dia da volta, lista pelo nome quem passou da hora hoje com o valor em risco | o dono, num toque, pelo **próprio WhatsApp** (`wa.me`, grátis) | [FATO, código] |

Por que janela fixa erra **[FATO, aritmética, não opinião]**: quem corta a cada 15 dias e sumiu há
28 já perdeu dois cortes e **ainda não aparece** na faixa de 30 dias da Belasis; quem faz
coloração a cada 60 dias aparece como "sumida" aos 30, quando ainda não estava atrasada — e recebe
uma mensagem de "sentimos sua falta" fora de hora. O AppBarber mostra que alguém não voltou
**depois** que a janela fechou, e só para quem abriu o relatório.

---

## 4 · O funil de hoje — o que dá e o que não dá para medir

- **Não há analytics de produto, por decisão** (privacidade/LGPD, `funnel.md`, `docs/09` §0.5)
  **[FATO]**. Não existe como medir quantas pessoas **abrem** a tela de onboarding e desistem.
- Com **1 conta real** em produção **[FATO]**, nenhuma taxa de abandono seria estatística mesmo
  que existisse instrumentação. **Conclusão: não há dado de abandono, e não vai haver tão cedo.**
- O que é mensurável sem construir nada: `auth.users` sem `membership` = quem criou login e parou
  **antes** de terminar as 3 respostas (`funnel.md` §1); os eventos `conta_criada` →
  `base_importada` → `motor_viu_valor` → `cliente_voltou` já existem em produção (migrations
  `0088`–`0091` aplicadas, `docs/DECISOES.md` 16/09).
- **Por isso o desenho abaixo assume o pior caso de abandono:** cada pergunta nova é custo real.
  Nenhuma pergunta entra na tela de 3 respostas; a tela nova é pulável inteira num toque; e cada
  pergunta só existe se mudar algo que a pessoa vê.
- **Instrumentação mínima proposta** (dentro da tabela que já existe, sem SDK, sem dado pessoal):
  `perfil_respondido` com `meta = { base_em, equipe, dor }` e `perfil_pulado`. Mede a taxa de
  pulo, e responde pela primeira vez **quantas contas vêm de outro sistema** — a pergunta que hoje
  ninguém sabe responder.

---

## 5 · O desenho — onboarding geral com perguntas que roteiam e qualificam

### 5.1 Onde as perguntas entram (e onde NÃO entram)

**Não na tela de 3 respostas.** O freio de `onboarding/page.tsx` é deliberado e está certo: ali a
pessoa ainda não tem nada, e a promessa é "sua página no ar". Depois do "Colocar minha página no
ar", a página **já está** no ar — a promessa foi cumprida. É aí que entra uma tela única:

> **Pra deixar o CICLO do seu jeito** · *30 segundos, e dá pra pular.*

Uma tela, três perguntas em cartões grandes de toque (mobile, 1 polegar), cada uma com "Pular"
próprio, e um "Pular tudo e ir pro painel" visível no topo. **Alternativa considerada e
descartada:** transformar isso em cartões na Central de Ações do "Hoje". Descartada porque a
primeira pergunta decide PARA ONDE a pessoa vai em seguida — respondida na tela certa, ela cai
direto na importação; enfiada num cartão entre outros, disputa atenção com "Confira seus serviços",
e a conta vazia continua vazia (o caso `ciclos-ana`).

### 5.2 As perguntas — cada uma com o ganho CONCRETO de responder

Regra de honestidade (mesma régua do "nunca prometer canal que não existe", `CLAUDE.md`): a copy
de incentivo diz o que muda **na tela da pessoa**. Se uma resposta não mudasse nada, a pergunta
não existiria.

**Pergunta 1 — a que decide o caminho**

> **Onde estão seus clientes hoje?**
> · Na minha cabeça ou num caderno
> · No WhatsApp / contatos do celular
> · Numa planilha
> · Em outro sistema *(qual? AppBarber · Trinks · Belasis · BarbUp · Booksy · outro)*
> · Estou começando agora, ainda não tenho
>
> *Incentivo:* "A gente já te leva pro jeito mais rápido de trazer todo mundo — e te mostra na hora
> quem já passou do tempo de voltar."

Ganho concreto: o próximo passo muda (tabela 5.3). **Pulável**, com o caminho padrão sendo o de
hoje (`ja-atendo`). Considerei torná-la obrigatória por decidir o fluxo — **decisão: pulável
também**, porque o padrão atual já é razoável para a maioria (caderno/memória) e uma pergunta
obrigatória logo depois de "sua página está no ar" contradiz a promessa de "pode ajustar depois".

**Pergunta 2 — tamanho**

> **Você atende sozinho(a) ou tem equipe?** · Só eu · Eu + 1 a 3 · 4 ou mais
>
> *Incentivo:* "Quem atende sozinho não vê telas de comissão e escala que não usa. Quem tem equipe já
> encontra a agenda de cada um pronta."

Ganho concreto: pré-ajusta o que aparece (módulo `team`, comissão, agenda por profissional).
**[A confirmar na execução]:** se o módulo `team` é preferência de exibição (`tenant/modules`) ou
trava de plano — se for trava de plano, a resposta só pode **esconder** para quem é solo, nunca
**liberar** para quem tem equipe sem pagar.

**Pergunta 3 — a dor principal**

> **O que mais te incomoda hoje?** *(uma)*
> · Cliente que some e eu nem percebo *(dor 3)*
> · Gente que marca e não vem *(dor 1)*
> · Não sei quanto sobra no fim do mês *(dor 4)*
> · Responder WhatsApp o dia inteiro pra marcar horário *(dor 2)*
>
> *Incentivo:* "Seu painel abre com isso em primeiro lugar."

Ganho concreto: a ordem da Central de Ações em `/admin/hoje` passa a começar pela dor escolhida.
**Precisa ser construído** (hoje a ordem é fixa) — é pequeno (`centralDeAcoes` já monta a lista
em código; é reordenar por uma chave em `tenants.settings`). Só quatro opções porque são as quatro
dores que o produto **resolve hoje de verdade** no plano grátis/entrada; as outras 10 viram
pergunta quando o produto tiver o que mostrar para elas.

**O que NÃO perguntar, e por quê:** como conheceu o CICLO (já capturado pelo link); profissão
(já perguntada); faturamento (invasivo nesse momento e não muda nada na tela); CNPJ/MEI (idem).

### 5.3 Para onde cada resposta da Pergunta 1 leva

| Resposta | Caminho | O que já existe | O que falta |
|---|---|---|---|
| Cabeça / caderno | `ja-atendo` (digitar nome + "mais ou menos quando veio") | tudo | dica na tela: "abre o caderno do lado" |
| WhatsApp / contatos | `ja-atendo` | tudo | **[HIPÓTESE]** Contact Picker API (`navigator.contacts.select`) para escolher contatos direto do celular — existe no Chrome Android, **não no Safari/iOS**; verificar suporte real antes de prometer |
| Planilha | importador CSV | parcial | **BL-51** (data brasileira, acento) + aceitar `.xlsx` |
| Outro sistema → Trinks | tela "Vindo do Trinks" | importador | passo a passo verificado: Relatório de Clientes → filtrar → Exportar (Excel) → subir aqui |
| Outro sistema → AppBarber / Belasis / BarbUp / outro | tela "Vindo de outro sistema" | importador + `ja-atendo` | **mensagem pronta** para pedir a exportação ao suporte do sistema antigo (abaixo) + as três saídas de 5.4 |
| Começando agora | pula a importação → "Mande seu link de agendamento" | página pública | nada — é o público mais fácil (20% dos CNPJs de beleza são novos por ano, `docs/82` §2) |

**Mensagem pronta para o suporte do sistema antigo** (copiável, sem nenhuma afirmação jurídica — o
CICLO não dá conselho legal):

> "Olá! Quero receber a lista dos meus clientes numa planilha (Excel ou CSV), com nome, telefone e
> a data do último atendimento de cada um. Pode me enviar por e-mail?"

### 5.4 Migração como incentivo — sempre grátis, nunca barreira

Três saídas na tela "Vindo de outro sistema", nessa ordem:

1. **"Traga agora"** — sobe a planilha (quando tiver) ou digita de memória os que lembrar. Na hora,
   sem chamado. E o **incentivo que já existe e é o mais forte de todos**: ao terminar, o Motor
   mostra quantos já passaram do tempo de voltar e o valor parado. Nenhum concorrente pesquisado
   mostra isso no momento da importação.
2. **"Use junto com o [sistema] por enquanto"** — o CICLO como camada de recuperação ao lado do
   sistema atual. Continua marcando horário lá; aqui só vê quem está sumindo e chama. Tira o "medo
   de trocar" (dor 13) do caminho: **não precisa trocar hoje.** Já suportado pelo `ja-atendo`
   (busca "já é sua cliente" para marcar quem voltou).
3. **"Me manda que eu faço"** — **[DECISÃO DO EDUARDO]** oferecer, para as primeiras contas, a
   importação feita por ele mesmo pelo WhatsApp, de graça. É o "fazer o que não escala" do
   `docs/82` §7 (a visita presencial converte porque faz o passo 2 junto). Custa tempo do fundador,
   por isso não é decidido aqui.

**Incentivo além do valor imediato** (benefício de plano para quem traz a base, tipo um mês de
Essencial) **não é decidido aqui** — é preço. Registrado como pergunta em `docs/DECISOES.md`.

### 5.5 Adaptação — quem já sabe usar sistema

Uma tela curta, opcional, só para quem respondeu "outro sistema": **"O que muda por aqui"**, em
três linhas, sem nomear concorrente dentro do produto (ver pergunta 2 do §9):

- "Seu cliente marca pelo link — não precisa baixar app."
- "Você não escolhe prazo de retorno: o CICLO aprende o ritmo de cada cliente sozinho."
- "Comanda, pacote e fidelidade funcionam do jeito que você já conhece."

O terceiro item só pode ficar se for verdade no plano da pessoa: lançar item na comanda exige o
módulo `register` e fidelidade exige `loyalty` (`exigirModulo`, conferido nas rotas); pacote não
tem trava de módulo. Ajustar a frase ao plano de cada conta na execução.

---

## 6 · A justificativa — por que alguém trocaria de verdade

Cinco pilares, do mais forte ao mais fraco, cada um com a evidência e o limite.

1. **Ritmo pessoal, não janela fixa.** Todos os concorrentes pesquisados usam janela fixa ou
   manual (§3.3). O CICLO acerta o momento de cada cliente. *Evidência:* §3.3. *Limite:* só
   convence quando aparece com os clientes DELA — por isso a importação com a data é o argumento em
   si, não um passo técnico.
2. **Troca na hora, e o resultado aparece no mesmo minuto.** Contra "chamado e até 5 dias úteis,
   sem histórico" do AppBarber. *Limite:* Belasis e BarbUp fazem a migração POR você — para quem
   quer ser carregado no colo, eles ganham.
3. **Não precisa largar o sistema atual.** Camada de recuperação ao lado. *Limite:* manter dois
   lugares dá trabalho (marcar quem voltou no CICLO toda semana).
4. **Seu cliente não baixa app nem vê a barbearia do lado.** A queixa nº 1 e nº 2 de donos do
   AppBarber no Reclame Aqui (`competitors/appbarber.md`) **[EVIDÊNCIA]**. *Limite:* ver 7.2.
5. **Grátis para sempre com o Motor, preço publicado.** *Limite:* ver 7.4.

**O que NÃO usar como argumento**: "WhatsApp automático incluído". O envio automático depende do
cron `reminders`, fora do agendamento em produção, e a revisão GO-2 já concluiu que isso é produto
incompleto, não copy pronta. O verdadeiro é "chama pelo **seu** WhatsApp num toque".

---

## 7 · Auto-crítica — "se eu fosse o Diego, satisfeito com o AppBarber, isso me convenceria?"

Diego: 4 cadeiras, usa AppBarber há anos, "já tentou 2 sistemas e a equipe não usou" (`docs/07`
§3.1).

**7.1 "Ritmo pessoal"** — Diego: *"Meu AppBarber já tem relatório de retorno."* Se o argumento for
dito, ele não vê diferença; o relatório dele "também mostra quem não voltou". **Só convence mostrado,
com os clientes dele.** Consequência para o plano: nada de tabela comparativa na tela; o comparativo
é a prévia do Motor depois da importação. **Sobrevive — como demonstração, não como frase.**

**7.2 "Seu cliente não baixa app"** — Diego: *"Mas metade dos meus clientes novos vem do app do
AppBarber."* Esse é o ponto que o argumento esconde: para quem ganha cliente pela vitrine do
AppBarber, sair é **perder aquisição**. **Não sobrevive como argumento de TROCA.** Sobrevive como
argumento para quem reclama do app (a queixa existe) e reforça a saída 2 (usar junto). **Removido
da copy de migração; mantido só na landing, onde já está.**

**7.3 "Na hora, sem chamado"** — Diego: *"E daí? Eu não estou trocando."* Velocidade da migração só
importa no momento da troca, não antes. **Fraco como manchete, útil como tranquilizador** dentro da
tela "Vindo de outro sistema". Mantido só ali.

**7.4 "Grátis para sempre"** — Diego: *"Grátis? Vai sumir em seis meses e eu perco tudo."* Esse medo
é **real e agravado** por ser um fundador sozinho. E hoje o CICLO **não tem como responder** — não
existe "exportar minha base inteira" (só `data-export` por cliente, pedido LGPD). **Não sobrevive
sem uma feature nova:** a simetria "trouxe na hora, leva na hora" (botão "Baixar todos os meus
clientes em planilha"). Entra na priorização como item de confiança, e a promessa só entra na copy
depois de existir.

**7.5 "Usar junto"** — Diego: *"Dois sistemas? Já não dou conta de um."* Real. A equipe dele não
usou os dois sistemas anteriores. **Sobrevive só se o trabalho de manter for quase zero** — o dono,
não a equipe, marca quem voltou, uma vez por semana, em `ja-atendo`. Honesto dizer isso na tela,
não esconder.

**7.6 Quem NÃO é o alvo desta frente** — cliente satisfeita da **Belasis**: ela já tem "IA que traz
cliente de volta" e gerente de conta. O argumento do CICLO contra ela é mais fino (30/60/90 contra
ritmo pessoal) e ela não sente a dor. **Não mirar Belasis primeiro.** O alvo realista de troca é
quem usa AppBarber/sistema de agenda sem recuperação, e — principalmente — os 70% do caderno.

**Resultado da auto-crítica:** dos 5 pilares, 2 sobrevivem inteiros (1 como demonstração, 3 com a
ressalva dita), 1 cai para a landing (4), 1 vira tranquilizador (2), 1 depende de construir algo
antes (5). O argumento mais forte não é uma frase — é **a lista de quem sumiu, com os clientes dela,
no minuto em que ela terminou de importar.**

---

## 8 · Riscos e o que NÃO fazer

- **Não crescer a tela de 3 respostas.** (§5.1)
- **Não cobrar migração, em nenhuma forma.** (Eduardo + §3.1: o mercado dá de graça)
- **Não construir detector de "export do Trinks/AppBarber" por cabeçalho** antes de ter um arquivo
  real de cada um em mãos — hoje nenhum cabeçalho é verificado (§3.2).
- **Não importar histórico completo** (várias datas por cliente) antes de confirmar que algum
  concorrente exporta isso — AppBarber declaradamente não leva histórico nem para dentro dele.
- **Não nomear concorrentes dentro do produto** sem decisão do Eduardo (pergunta 2, §9).
- **Não prometer "leve seus dados quando quiser"** antes de o botão existir (§7.4).
- **Não prometer mensagem automática** — só "pelo seu WhatsApp" (§6).

---

## 9 · Priorização

| # | O quê | Impacto | Custo | Por quê — e se sobreviveu à §7 |
|---|---|---|---|---|
| **P0** | **BL-51:** aceitar `dd/mm/aaaa` e `dd/mm/aa`; detectar Windows-1252; **avisar na tela** quantas datas não foram reconhecidas antes de importar | alto | baixo | Sem isso toda migração por planilha/Trinks chega com o Motor vazio e nomes corrompidos, calada. Destrava o pilar 1 (demonstração) — o único que convence o Diego |
| **P1** | Tela "Pra deixar o CICLO do seu jeito", **só a Pergunta 1** + roteamento (§5.3) + eventos `perfil_respondido`/`perfil_pulado` | alto | médio | Serve os 70% e os 30%. Primeira vez que o CICLO vai saber quantas contas vêm de outro sistema |
| **P2** | Tela "Vindo de outro sistema" (AppBarber, Belasis, BarbUp, outro — **nomeados**, decisão de 28/09): mensagem pronta para pedir a exportação ao suporte antigo, as 3 saídas de §5.4 (incluindo "me manda que eu faço", aprovado), e o benefício de 1 mês do Essencial para quem importa com data. *(Passo a passo do Trinks fora da fila — decisão de 28/09.)* | médio | baixo | É copy + uma rota; a saída 2 ("usar junto") é o maior redutor do medo de trocar e já é suportada |
| **P3** | "Baixar todos os meus clientes em planilha" (exportação da base inteira pelo dono) | médio | médio | Condição para o pilar 5 sobreviver (§7.4). Também é boa prática de LGPD (o salão é o controlador) |
| **P4** | Aceitar `.xlsx` direto no importador | médio | médio | Trinks e AppBarber trabalham com Excel. Depende de biblioteca nova (tamanho, segurança) — depois do P0, que resolve o CSV salvo pelo Excel |
| **P5** | Perguntas 2 e 3 com efeito real (pré-ajuste de módulo; ordem da Central de Ações) | médio | médio | Só entram quando o efeito existir — senão a copy de incentivo mente |
| **P6** | Tela "O que muda por aqui" para quem vem de sistema | baixo | baixo | Adaptação; depende da frase 3 bater com o plano da pessoa |
| **—** | Contact Picker (contatos do celular) | ? | ? | [HIPÓTESE] — verificar suporte real (não existe no iOS) antes de entrar na fila |
| **não agora** | Detector por concorrente; importação de histórico completo; parser de PDF | — | alto | Sem cabeçalho/formato verificado (§8). Reabrir só com um arquivo real exportado por um dono |

**Métrica de sucesso desta frente:** das contas com `perfil_respondido.base_em = 'outro_sistema'`
ou `'planilha'`, quantas chegam a `base_importada` **com data** (Motor não vazio) em 24 h. A
métrica norte do produto continua a de `docs/82`: `cliente_voltou`.

### Perguntas para o Eduardo (registradas em `docs/DECISOES.md`)

1. **Benefício de plano para quem traz a base** (ex.: um mês de Essencial)? É preço — não decidido
   aqui. Sem isso, o incentivo é o valor imediato do Motor, que já é forte.
2. **Nomear concorrentes** (AppBarber, Trinks) **dentro do produto** — na lista da Pergunta 1 e nos
   títulos "Vindo do Trinks"? Ajuda muito a pessoa se reconhecer, mas é decisão de marca (e há
   cuidado com publicidade comparativa). Hipótese padrão até decidir: nomear só na lista de opções,
   sem nenhuma comparação na tela.
3. **"Me manda que eu faço"** pelo WhatsApp, de graça, para as primeiras contas — o tempo é dele.

---

## 10 · Fontes (todas consultadas em 2026-09-28, salvo indicação)

- AppBarber — "Como solicito a importação de dados?": `appbarber-appbeleza.zendesk.com/hc/pt-br/articles/9396829609997`
- AppBarber — "Retorno por período (Taxa de Retorno)": `.../articles/15012525972365`
- AppBarber — "Relatório de Agendamentos: Geral – Clientes – Profissionais": `.../articles/360001576731`
- AppBarber — busca "exportar" e "planilha clientes" na central de ajuda (sem artigo de exportação da lista de clientes)
- Trinks — `ajuda.trinks.com/importacao-exportacao-de-lista-de-clientes`; `ajuda.trinks.com/relatório-de-clientes-e-crm-central-de-ajuda-do-trinks`
- Belasis — `belasis.com.br/sistema-para-salao-de-beleza`
- UAI, 25/09/2026 — "Cliente sumiu do salão? Sistema avisa quem não aparece há 30, 60 ou 90 dias" (Belasis)
- BarbUp — `barbup.com.br/blog/quanto-custa-sistema-agendamento-barbearia`
- Beleza na Web — Grupo Boticário / Exame (não é concorrente)
- Internas: `docs/07` §3–4, `docs/43`, `docs/82`, `.claude/ciclo/competitors/*.md` (20/09), `funnel.md`, `growth-opportunities.md` GO-1/GO-2
- Medição do importador: teste temporário (não commitado) contra `preVisualizarCsv` e `Temporal.PlainDate.from`, detalhado no BL-51
