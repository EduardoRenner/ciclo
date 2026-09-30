# Auditoria das armadilhas catalogadas que esta sessão ainda não conferiu — CICLO

> **STATUS: COMPLETO (2026-09-28).** Os 6 itens foram investigados — ver `.claude/ciclo/
> discoveries.md`, entradas de 2026-09-28. Achados negativos: 1, 2, 3, 4, 6. Achado real e
> corrigido: item 5 (`cron/campaigns/route.ts`, commit `ca1cbb09`). Não reabra sem evidência nova.
> Este arquivo fica como registro do método, não como fila pendente.

Rode sozinho, sem pausar e sem perguntar nada, até terminar ou até acabar o orçamento de tokens.
Não peça confirmação: onde faltar decisão, escolha a opção mais simples e segura, registre em
`docs/DECISOES.md` e siga (regra do `CLAUDE.md`, seção "Quando faltar informação").

**AUTORIZO PUBLICAR = NÃO**

- Só commits locais. Continue na branch já em uso (`fix/motor-nao-esquece-2026-09-27`) se ela
  ainda existir e estiver limpa; senão crie `auditoria/armadilhas-catalogadas-<data-de-hoje>` a
  partir de `main` atualizada.
- **Nunca** `git push`, nunca abrir PR, nunca `vercel deploy`, nunca escrever em produção (Supabase
  ou Vercel de produção são só leitura, se precisar consultar algo).
- Nunca imprimir segredo/credencial em nenhum arquivo, log ou commit.
- Sem agente em background: uma sessão, um fio de execução.
- Precisa de Docker/Supabase local rodando (`supabase status` confirma) para qualquer item que
  toque banco. Sem isso, registre a falta e pule para o próximo item da lista — não tente "às
  cegas".

---

## Quem você é nesta tarefa

Um engenheiro entrando no repositório pela primeira vez, sem o histórico de conversa que gerou
este pedido. Leia `CLAUDE.md` e `docs/00-BRIEFING.md` primeiro — a tabela "Armadilhas conhecidas
deste projeto" no `CLAUDE.md` é o roteiro desta missão. Leia também `.claude/ciclo/discoveries.md`
inteiro antes de investigar qualquer item: várias entradas recentes (BL-42, a varredura de
`tenant_id` do corpo) já fecharam algumas das armadilhas da tabela — não reabra o que já tem
achado negativo registrado, a menos que ache evidência nova e concreta.

## O que esta missão é (e o que não é)

Não é "encontre bugs a qualquer custo" — é uma varredura DISCIPLINADA por item catalogado, na
ordem abaixo, cada um com um critério claro de "isso é achado real" versus "isso está certo do
jeito que está". A tabela do `CLAUDE.md` documenta armadilhas que **já aconteceram** neste projeto
ou são conhecidas de projetos irmãos — não é hipótese, é histórico. O valor desta missão é
confirmar, item por item, se o código de HOJE ainda cai em cada uma, com evidência medida (não
leitura de código sozinha — `auditoria-medir-nao-estimar` é lição deste próprio projeto).

## Os itens, em ordem de risco (dinheiro/dado real primeiro)

### 1. Soma de minutos em horário local para gerar slot de agenda

**A armadilha:** somar minutos em horário LOCAL para calcular o próximo horário disponível, em vez
de converter para instante UTC antes de somar. Em dia de mudança de fuso (DST — mesmo o Brasil não
tendo hoje, o código pode rodar para tenants em outros fusos, ou voltar a ter DST no futuro), o dia
tem 23 ou 25 horas, e a soma ingênua erra o slot.

**Onde procurar:** o motor de geração de agenda/slots (`server/services/agendamentos.ts` e
qualquer `slots`/`disponibilidade`/`horarios-disponiveis` correlato). Procure por aritmética direta
em `Date`/string de horário sem passar por conversão explícita de fuso.

**Como confirmar (não é leitura de código, é teste):** já deve existir teste de "dia de 23/25
horas" — confirme rodando-o. Se existir e passar, é achado negativo, registre e siga. Se não
existir NENHUM teste cobrindo mudança de fuso na geração de slot, escreva um antes de concluir
qualquer coisa (positiva ou negativa) — sem teste, "parece certo" não é prova.

### 2. Bloquear atendimento por estoque negativo (deveria alertar, não bloquear)

**A armadilha:** travar a criação de um item de comanda porque o produto ficaria com estoque
negativo. A regra do CLAUDE.md é clara: alerta, nunca bloqueia — bloquear faz o salão abandonar o
sistema (ele vai vender o produto de qualquer jeito, com ou sem o CICLO).

**Onde procurar:** `server/services/estoque.ts`, `server/services/comanda.ts` (o fluxo de
`adicionarItemComanda` e o que baixa estoque). Procure qualquer `throw`/`AppError` disparado só
porque a quantidade ficaria negativa.

**Critério:** se encontrar um bloqueio, é achado real — vira ticket. Se o comportamento já é
"permite e sinaliza" (campo de alerta, badge, o que for), é achado negativo — confirme com um teste
que EXERCITA o caminho de estoque indo negativo e afirma que a operação teve sucesso mesmo assim.

### 3. Marcar no-show automaticamente (deveria ser sugestão, nunca automático)

**A armadilha:** o sistema decidir sozinho que um agendamento é no-show e marcá-lo sem o
profissional confirmar.

**Onde procurar:** qualquer cron/job noturno que mexe em `appointments.status`, e a rota
`appointments/[id]/no-show` (já corrigida pelo BL-42 nesta sessão, mas a auditoria aqui é sobre
QUEM CHAMA essa rota — se algo automatizado chama sozinho, é o defeito).

**Critério:** achado negativo já era esperado aqui (o comentário `FAQ E68` no código já documenta a
regra) — confirme lendo os cron jobs (`server/jobs/` ou equivalente) atrás de qualquer chamada
automática, e registre o achado negativo com a lista de crons conferidos nomeados.

### 4. Deletar o movimento de estoque no estorno (deveria gerar movimento compensatório)

**A armadilha:** ao estornar uma venda/consumo, apagar a linha original de `inventory_movements`
em vez de gerar uma nova linha do tipo `return` que compensa a primeira. Isso é também uma
instância da regra 11 do CLAUDE.md (nunca deletar registro de estoque/agendamento/auditoria).

**Onde procurar:** `server/services/estoque.ts`, qualquer fluxo de estorno/cancelamento que toque
`inventory_entries`/`inventory_movements`.

**Critério:** procure por `.delete()` nesses arquivos. Se encontrar um `.delete()` num fluxo de
estorno, é achado real. Se todo estorno já usa movimento compensatório, achado negativo — confirme
com teste que estorna e afirma que a linha original AINDA existe, mais uma linha nova de
compensação.

### 5. `catch` que descarta algo sem contar nem avisar

**A armadilha (já catalogada como padrão recorrente neste projeto, não hipótese):** um bloco
`catch` que engole um erro e segue com um valor padrão, mas o que foi descartado importa (já
aconteceu: apagar fila offline no logout e deixar lista antiga na tela como se fosse resultado de
busca).

**Método, já que "todo catch" é demais para uma sessão:** não varra `catch` no projeto inteiro —
isso é auditoria "de novo desde o zero" e o CLAUDE.md já avisa contra isso. Em vez disso, escolha
UM subsistema por rodada, o de maior superfície de dado real ainda não auditado nesta sessão:
comece por `src/lib/offline/` (fila offline, o mesmo sistema que já teve o bug histórico) e
`server/jobs/` (crons — um `catch` silencioso aqui já é uma classe catalogada separada, "laço de
cron com await solto", ver `.claude/ciclo/discoveries.md` para o que já foi encontrado e
corrigido). Para cada `catch` desses dois diretórios: ele descarta algo que precisa ser contado ou
avisado? Se sim e não está sendo, é achado real. Se o `catch` já loga/conta/reporta, achado
negativo — não precisa "melhorar" um catch que já está certo.

### 6. Prometer canal (WhatsApp) sem rota agendada + credencial existente

**A armadilha:** copy que promete "você vai receber por WhatsApp" numa tela onde não existe rota
AGENDADA de verdade ou a credencial não está configurada. A promessa mais cara é a da página do
CLIENTE do tenant — quem fica mal nessa promessa quebrada é o salão, não o CICLO.

**Onde procurar:** grep por `WhatsApp`/`whatsapp` em componentes de UI (`.tsx`) fora de
`/admin/**` — telas públicas ou do cliente final. Para cada ocorrência, confirme se existe de fato
uma rota server-side que dispara a mensagem naquele fluxo específico, e se ela está condicionada à
presença da credencial (não promete quando a credencial falta).

**Critério:** achado negativo é esperado aqui também — `.claude/ciclo/ciclo-paginas-sem-canal-de-
contato.md`/memória já indicam que esse tipo de auditoria de canal já rodou antes nesta família de
produtos. Confirme e registre; se achar uma promessa nova sem verificação, é achado real.

## Requisitos não-negociáveis

- `pnpm verify` verde antes de cada commit. Se `test:integration` oscilar por contenção de conexão
  em paralelo local (padrão já documentado em `discoveries.md` nesta sessão — arquivos diferentes
  falham a cada rodada, `AppError INTERNAL` genérico), rode
  `npx vitest run --config vitest.banco.config.ts --dir tests/integration --poolOptions.forks.maxForks=2`
  antes de investigar como bug de verdade.
- Todo achado — real OU negativo — vai para `.claude/ciclo/discoveries.md`, com a evidência (teste
  rodado, comando usado, resultado). Achado negativo não é "nada a fazer": é conhecimento que
  poupa a próxima sessão de reabrir a mesma pergunta.
- Todo achado real que vira conserto: teste-guarda visto REPROVANDO antes de aceito como prova
  (commite antes de mutar, reintroduza o defeito, confirme a mutação aplicada, veja reprovar,
  restaure — procedimento do `CLAUDE.md`).
- Um item da lista, um commit (código) + um commit (doc), mensagem em português. Mensagem com
  aspas duplas ou acentos: escreva num arquivo e use `git commit -F <arquivo>`, nunca `-m` inline.
- Nunca invente número, nunca decida preço/jurídico/conta de terceiro — se um item exigir isso,
  registre a pergunta exata para o Eduardo e pule para o próximo item da lista.

## Método

1. Leia `CLAUDE.md`, `docs/00-BRIEFING.md`, `.claude/ciclo/discoveries.md` inteiro.
2. Confirme `supabase status` — banco local respondendo (para os itens que precisam).
3. Percorra os 6 itens acima, nesta ordem. Para cada um: investigue, meça (teste, não leitura),
   conclua achado real ou negativo, registre, e se for real, conserte com o mesmo rigor do BL-42
   (teste-guarda mutation-testado; considere se vale uma regra de ESLint permanente quando o padrão
   se repete por mais de 2-3 ocorrências, seguindo o precedente de `eslint-rules/index.mjs`).
4. Depois dos 6, se sobrar orçamento: volte à tabela "Armadilhas conhecidas" do `CLAUDE.md` e
   escolha uma entrada ainda não coberta por esta lista nem por achado anterior em
   `discoveries.md` (ex.: cache de `/vault`/mídia assinada no service worker; percentual de
   desconto guardado em vez do valor em centavos; receita de pacote reconhecida na venda em vez do
   consumo).

## Quando parar

Pare quando os 6 itens estiverem investigados e registrados (real ou negativo) e qualquer conserto
resultante estiver commitado com `pnpm verify` verde — ou quando esbarrar numa decisão que só o
Eduardo pode tomar (registre a pergunta exata) ou o orçamento de tokens acabar. Antes de parar:
árvore de trabalho limpa, tudo commitado, e um resumo curto (5-8 linhas): quantos itens foram
achado real vs. negativo, o que foi consertado, e o que ficou pendente.
