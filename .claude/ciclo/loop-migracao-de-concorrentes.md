# Onboarding geral + migração de quem vem de outro sistema — pesquisa + plano — CICLO

Rode sozinho, sem pausar e sem perguntar nada, até terminar ou até acabar o orçamento de tokens.
Não peça confirmação: onde faltar decisão, escolha a opção mais simples e segura, registre em
`docs/DECISOES.md` e siga (regra do `CLAUDE.md`, seção "Quando faltar informação").

**Esta missão é de PESQUISA + PLANO, não de implementação.** O entregável é um documento — não
código. Segue o mesmo padrão já usado nesta base para outras frentes (`docs/17-MONETIZACAO-
PROMPT.md` → `docs/18-MONETIZACAO-PLANO.md`, `docs/32-AUTOMACAO-AGENTE-PROMPT.md` →
`docs/33-AUTOMACAO-AGENTE-PLANO.md`): este arquivo é o "PROMPT", o resultado é um "PLANO" novo,
`docs/83-ONBOARDING-E-MIGRACAO-PLANO.md` (confira antes se esse número já existe nesta branch ou
foi tomado por outra sessão — se sim, use o próximo livre).

**AUTORIZO PUBLICAR = NÃO** — mesmo sendo só documento, nada de `git push`. Só commit local, na
branch atual (`fix/motor-nao-esquece-2026-09-27`) se ainda estiver limpa, senão crie
`docs/onboarding-migracao-<data-de-hoje>` a partir de `main` atualizada.

**Prioridade é PROFUNDIDADE, não velocidade.** O Eduardo já pediu isto uma vez antes e a resposta
anterior não aprofundou o suficiente — terminar rápido não é o critério de sucesso aqui. Se o
orçamento de tokens permitir, prefira pesquisar mais um concorrente, testar mais uma hipótese de
copy, ou escrever mais uma seção de justificativa a "fechar logo". Um plano raso e rápido é pior
que um plano lento e fundamentado.

**Precisa de acesso à internet (WebSearch/navegador) para a seção de pesquisa de concorrente ser
real.** Confirme isso ANTES de começar a escrever qualquer coisa sobre AppBarber/Trinks/BarbUp/
BelaSis. Se a sessão não tiver essa ferramenta disponível, **pare e registre isso como bloqueio**
no topo do documento (`docs/DECISOES.md` também) — não preencha a seção 2 com suposição do que
"provavelmente" cada concorrente faz. Um "não pesquisado, falta acesso a navegador" é honesto; um
achado inventado sobre a concorrência é o tipo de erro que o `CLAUDE.md` já pune em toda a tabela
de "medição ingênua dá falso positivo".

---

## O objetivo real desta missão (leia antes de tudo)

**Não é "facilitar a importação de dados".** É: **o CICLO precisa ser melhor que AppBarber, Trinks,
BarbUp, BelaSis e substituí-los com êxito** — e isso exige um MOTIVO real, articulado, não só
mecânica de troca de arquivo. Ninguém troca de ferramenta que já usa só porque a importação de CSV
ficou mais fácil. Troca porque alguém convenceu a pessoa de que o novo é **genuinamente melhor** —
e o onboarding é o primeiro (e às vezes único) lugar onde essa conversa acontece.

Duas mudanças importantes em relação a uma versão anterior desta missão, ambas pedidas
explicitamente pelo Eduardo:

1. **A migração NUNCA pode ser uma barreira de pagamento.** Esqueça qualquer ideia de cobrar pela
   migração assistida (havia uma linha de preço de R$ 199 documentada em `docs/07-CONTEXTO-
   PRODUTO.md`, linha ~701 — ela está OBSOLETA, e este plano deve substituí-la). Migração tem que
   **incentivar** a troca, nunca desestimulá-la. Se cobrar por algo relacionado a trazer dados de
   outro sistema, a pessoa simplesmente não troca — e "trocar de sistema dá medo" (objeção 13,
   `docs/07`, linha 162) só piora se o primeiro passo pedir cartão de crédito. O plano precisa
   decidir COMO tornar a migração um incentivo ativo (grátis sempre; talvez até um benefício extra
   por trazer a base toda — ex.: um mês a mais grátis, um selo, prioridade em alguma fila), não
   apenas "sem custo".
2. **O escopo cresce de "importação de concorrente" para "onboarding geral com perguntas que
   qualificam e segmentam o público".** O onboarding de hoje (`src/app/onboarding/formulario.tsx`,
   203 linhas) é curto e praticamente não pergunta nada além do básico (nome do negócio, profissão
   como texto livre). Isso é uma oportunidade perdida em dois sentidos: (a) não descobre se a pessoa
   já usa outro sistema (então não pode oferecer migração no momento certo), e (b) não segmenta —
   não aprende se é solo ou equipe, se já sofre com [cada uma das 14 dores catalogadas em
   `docs/07-CONTEXTO-PRODUTO.md`, seção 3], se veio de indicação ou anúncio, etc. Um onboarding bem
   feito faz as duas coisas ao mesmo tempo: pergunta o que precisa saber para dar o próximo passo
   certo (migrar ou começar do zero) E já filtra/qualifica quem está entrando, dado que essa
   informação vale para produto, para vendas e para o próprio Motor de Ciclo entender o perfil da
   base.

## O que já se sabe (não repita a pesquisa que já foi feita)

- `docs/07-CONTEXTO-PRODUTO.md`, seção 3 (seções de dor/objeção) e seção 4 (concorrência) — leia as
  duas inteiras. A objeção 13 ("trocar de sistema dá medo") e a tabela de concorrentes (AppBarber,
  Trinks, BarbUp, Barbeiro.app, Belle/Avec) já estão lá. **A linha de preço "migração assistida R$
  199" está obsoleta — não repita, o Eduardo já descartou.**
- `docs/43-POSICIONAMENTO-10X.md` — análise extensa sobre o AppBarber especificamente: preço, força
  real (1M+ instalações, app do cliente compartilhado entre salões), e por que competir de frente
  por AQUISIÇÃO é a estratégia errada. Isto é sobre RETENÇÃO/CONVERSÃO de quem já decidiu olhar o
  CICLO — leia com esse filtro: o que nesse documento já explica POR QUE o CICLO é melhor, que pode
  virar argumento no onboarding?
- `src/server/services/importacao-clientes.ts` (`src/app/admin/clientes/importar/importador.tsx`)
  já resolve a MECÂNICA de importar CSV genérico bem (mapeamento de coluna, validação, duplicata,
  lotes performáticos, integração com o Motor de Ciclo). **Não reinvente essa parte.** O que falta
  é tudo em volta: reconhecer de onde o dado vem, perguntar no momento certo, e explicar por que
  vale a pena.
- `src/app/onboarding/{page,formulario}.tsx` e `src/server/services/onboarding.ts` — leia os TRÊS
  inteiros antes de propor qualquer pergunta nova. Confirme exatamente quais campos já são
  coletados hoje (nome do negócio, vertical/profissão, fuso — confira) para não propor pergunta
  duplicada.
- "Belasis" citado pelo Eduardo pode ser "BelaSis" (grafia própria) — confirme pesquisando, não
  adivinhe.

## O método

### 1. Confirme o que já existe versus o que falta

- Leia `importacao-clientes.ts`/`importador.tsx`/`onboarding.ts`/`onboarding/formulario.tsx`/
  `onboarding/page.tsx` inteiros. Rode `pnpm test:unit` filtrando por "onboarding" e por "importa"
  para ver a cobertura de teste atual — ela já documenta, em forma de teste, o que o produto
  garante hoje.
- Grep por "migração"/"migracao"/"assistida" e por qualquer pergunta tipo "já usa" / "outro
  sistema" no código (`src/`) para confirmar se existe QUALQUER fragmento começado.
- Levante as 14 dores da tabela de `docs/07-CONTEXTO-PRODUTO.md` (seção 3) e para cada uma
  pergunte: "o onboarding de hoje descobre se a pessoa tem essa dor?" A resposta hoje é
  provavelmente "não" para quase todas — isso é o tamanho real da lacuna, documente com números
  (quantas de 14, quais).

### 2. Procure evidência de PRIMEIRA MÃO antes de pesquisar concorrente por fora

Antes de qualquer pesquisa externa: o CICLO já tem sinal próprio sobre gente que troca de sistema,
e essa evidência vale mais que qualquer review de app store, porque é de gente que realmente
considerou ou usou o produto.

- Grep em `docs/DECISOES.md`, `.claude/ciclo/*.md` e qualquer transcrição de conversa/suporte
  disponível no repositório por menções a "Trinks"/"AppBarber"/"BarbUp"/"BelaSis"/"planilha"/
  "Excel"/"trocar de sistema"/"migrar" fora do contexto desta própria missão — alguém já
  mencionou isso antes, mesmo que de passagem?
- Confira se `product_events` (`server/services/product-events.ts`) já registra algum evento
  relacionado a importação hoje (ex.: `base_importada`, citado em `.claude/ciclo/discoveries.md`
  na entrada sobre `clients/ja-atendo`) — se sim, e se houver acesso a produção/banco com dados
  reais, veja se dá para medir quantos tenants JÁ passaram pelo importador de CSV desde que ele
  existe. Isso é o tamanho real da demanda, não uma estimativa.
- Se não achar nenhum sinal de primeira mão: registre isso explicitamente ("nenhuma evidência
  própria encontrada, hipóteses do restante do plano se apoiam só em pesquisa externa") — é uma
  informação importante para quem for ler o plano depois, não um vazio a esconder.

### 3. Pesquise os concorrentes concretos (com profundidade, não de raspão)

Para cada um — **AppBarber, Trinks, BarbUp, BelaSis (confirme grafia), Beleza na Web** e qualquer
outro comum no nicho de beleza/barbearia solo/pequeno — responda com evidência (link, texto
citado, data da pesquisa), nunca suposição:

- **Proposta de valor deles, nas próprias palavras**: o que eles prometem na home/no app store? Uma
  pessoa satisfeita com [concorrente X] — por que ela trocaria? O que teria que ser
  **inequivocamente melhor** no CICLO para justificar o incômodo de trocar?
- **Reclamações reais**: reviews de 1-3 estrelas na loja de apps, reclamações em fóruns/grupos de
  Facebook/Instagram do nicho, se acessível. É a fonte mais honesta de "o que dói de verdade" — mais
  confiável que a própria copy de marketing do concorrente.
- **Exportação de dados**: dá pra exportar (CSV, Excel, PDF, nenhum)? Self-service ou via suporte?
  Que campos vêm — nome, telefone, histórico de atendimentos (com granularidade real ou só "última
  visita"?), pacotes/créditos, catálogo, equipe, agenda futura?
- **Cabeçalhos característicos** do arquivo exportado, se existir, para desenhar detecção automática
  de origem depois.
- Se não conseguir confirmar algo por falta de acesso a conta de teste: registre exatamente isso —
  "não verificado, precisa de conta de teste ou de alguém que já usou" — nunca invente.

### 4. Meça o funil de onboarding ATUAL antes de propor pergunta nova

Toda pergunta nova — mesmo pulável — é uma chance a mais de alguém abandonar o cadastro no meio.
Antes de desenhar o fluxo novo, confira o tamanho desse risco:

- Existe algum dado de abandono do onboarding hoje? Procure em `product_events`, em qualquer
  painel/rota de analytics já existente (`admin/mes`, `resumo-hoje.ts`, ou o que houver), ou em
  logs — quantas pessoas COMEÇAM o formulário de onboarding versus quantas TERMINAM
  (`executarOnboarding` sendo chamado com sucesso)?
- Se não houver esse dado hoje (bem provável, dado que é pouco provável existir instrumentação de
  funil funcionando com poucos tenants em produção): registre isso como uma lacuna concreta, e
  proponha — como parte do plano, não como execução agora — o evento mínimo que precisaria existir
  em `product_events` para medir isso no futuro (ex.: "onboarding_iniciado" no primeiro toque da
  tela, "onboarding_concluido" já existe implicitamente quando `executarOnboarding` sucede).
- Esse achado (ou a falta dele) tem que aparecer no plano antes da proposta de novas perguntas, e
  a proposta de perguntas tem que ser desenhada assumindo o pior caso plausível de abandono, não o
  melhor — cada pergunta a mais é custo real, mesmo pulável, e o plano precisa justificar por que o
  ganho compensa.

### 5. Desenhe o onboarding geral — perguntas que decidem o caminho E qualificam

Este é o coração do plano. Proponha um fluxo de perguntas (poucas, mobile-first, uma por tela —
regra de estilo já estabelecida no produto: "1 polegar, 3 toques") que:

- **As perguntas de qualificação (não as que decidem o caminho técnico, ver abaixo) são sempre
  PULÁVEIS — nunca uma barreira.** Pedido explícito do Eduardo: em vez de obrigar a pessoa a
  responder, ofereça um "pular por agora" visível, e do lado da pergunta explique o BENEFÍCIO real
  de responder — não "ajude a gente com dados", e sim o que a PESSOA ganha (ex.: "isso ajuda a
  gente a personalizar sua experiência" / "assim já deixamos [tela X] pronta do jeito que faz
  sentido pra você"). O incentivo tem que ser verdade: se a resposta realmente muda algo que a
  pessoa vê depois (ex.: prioriza um card na tela Hoje, pré-marca um módulo), diga ISSO
  especificamente — genérico demais ("personalizamos sua experiência") sem nenhuma mudança real
  visível é a mesma promessa vazia que a regra de "nunca promover canal que não existe" do
  `CLAUDE.md` já proíbe para canal de mensagem; o mesmo princípio de honestidade vale aqui pra
  copy de incentivo. Proponha, pergunta por pergunta, qual é o ganho CONCRETO de responder (não
  invente um ganho — se não houver nenhum efeito real hoje, ou proponha um efeito real pequeno de
  construir, ou não inclua a pergunta).
- **Descobre se a pessoa já usa outro sistema** — e qual — no momento certo do fluxo (bem no início,
  antes de pedir qualquer dado que dependa disso). Esta pergunta específica pode ter tratamento
  diferente das demais: decide um CAMINHO técnico (migrar vs. cadastro do zero), não é só
  qualificação — avalie se ela também deveria ser pulável (com o caminho padrão sendo "cadastro do
  zero" pra quem pular) ou se, por decidir o fluxo inteiro, faz sentido ser a única não-pulável.
  Justifique a escolha no plano, não decida em silêncio.
- **Segmenta por dor** — pelo menos uma pergunta (ou observação indireta pela resposta de outra
  pergunta) que aproxime a pessoa de qual das 14 dores catalogadas é a mais forte pra ela agora.
  Serve para o produto priorizar o que mostrar primeiro no painel dela, e para o negócio entender a
  composição da base ao longo do tempo.
- **Decide o caminho**: quem já usa outro sistema vai para o fluxo de migração (o importador
  existente, com o perfil certo se a pesquisa do passo 3 permitir detecção automática); quem nunca
  teve sistema vai para o cadastro padrão do zero. Os dois caminhos precisam ser desenhados —
  inclusive a COPY exata de cada tela, em pt-BR, sem jargão, explicando o benefício de cada
  próximo passo.
- **Constrói o argumento, não só coleta dado**: cada pergunta é também uma oportunidade de mostrar,
  de relance, por que o CICLO é diferente — sem virar um funil de vendas chato. Pense em como o
  onboarding de produtos que fazem isso bem costuma equilibrar pergunta com prova de valor (ex.: "e
  aí, com esses X clientes, o Motor de Ciclo já teria achado Y que sumiram" — só é possível SE
  houver dado suficiente da migração para calcular isso na hora).
- **Migração como incentivo, nunca como fricção**: sem paywall. Avalie e proponha formas concretas
  de tornar migrar a base inteira algo que a pessoa QUER fazer (não é obrigada) — pode ser
  visibilidade imediata do valor (mostrar na hora "olha quantas pessoas já estão atrasadas" — o
  Motor de Ciclo já faz uma versão disso no importador atual), pode ser um benefício de produto
  (tempo extra de teste, desbloqueio de algo), mas NUNCA um custo em dinheiro.

### 6. Auto-crítica cética antes de fechar — "isso me convenceria de verdade?"

Antes de escrever a priorização final, escreva uma seção curta e honesta assumindo o papel de um
dono de barbearia/salão satisfeito com o sistema que já usa hoje. Para CADA argumento central do
plano (a proposta de valor do onboarding, a copy de incentivo à migração, a justificativa de "somos
melhores"): esse argumento convenceria essa pessoa, ou é spin de marketing que soa bem mas não
resistiria a uma pergunta de volta tipo "e daí, por que eu ia me dar ao trabalho"? Onde a resposta
honesta for "não convenceria", reescreva o argumento ou remova-o do plano — não deixe um argumento
fraco só porque já foi escrito. Esta seção é o que separa um plano de vendas de um plano de
produto: é aceitável (e esperado) que ela derrube alguma ideia das seções anteriores.

### 7. Priorize, com justificativa de impacto — não lista de desejos

Termine o documento com uma ordem clara de "o que fazer primeiro", cada item com o PORQUÊ (que dor
resolve, que argumento de "somos melhores" ele sustenta, e se sobreviveu à auto-crítica do passo
6), não só "seria legal ter". Se a pesquisa do passo 3 mudar alguma premissa (ex.: nenhum
concorrente tem export estruturado), essa conclusão tem que aparecer logo no topo do documento, não
enterrada no meio.

## Requisitos não-negociáveis

- O documento final vai em `docs/83-ONBOARDING-E-MIGRACAO-PLANO.md` (ou o próximo número livre),
  seguindo o formato dos planos já existentes (título, sumário executivo no topo, seções numeradas,
  tabela de priorização no fim).
- Toda afirmação sobre um concorrente específico precisa de evidência (fonte, data) ou vir marcada
  como "não verificado". Nenhuma suposição vestida de fato.
- **Migração é sempre grátis — não proponha nenhum modelo de cobrança para ela.** Se surgir a
  tentação de "cobrar só a parte assistida por humano", registre a pergunta exata para o Eduardo em
  `docs/DECISOES.md` em vez de decidir sozinho, mas a hipótese padrão do plano é sempre grátis.
- Não implemente nada de código nesta missão — é plano, não execução. Se achar um bug real e
  pequeno no meio do caminho (ex.: algo que a leitura do passo 1 revelar), registre em
  `.claude/ciclo/discoveries.md` e `.claude/ciclo/autonomous-backlog.md` como item separado, para
  uma sessão de EXECUÇÃO futura — não pare o plano para consertar.
- Profundidade antes de velocidade, sempre — ver a nota no topo deste arquivo.

## Quando parar

Pare quando `docs/83-ONBOARDING-E-MIGRACAO-PLANO.md` (ou o número que couber) estiver completo, com
pesquisa de concorrentes verificada (ou marcada como não-verificada), desenho do onboarding geral
com as perguntas e a copy propostas, o caminho de migração desenhado como incentivo sem paywall, e
prioridade justificada — e commitado. Ou quando esbarrar numa decisão que só o Eduardo pode
tomar (registre a pergunta exata) ou o orçamento de tokens acabar. Antes de parar: árvore de
trabalho limpa, tudo commitado, resumo curto (5-8 linhas) do que o plano concluiu e o que ficou como
pergunta em aberto.
