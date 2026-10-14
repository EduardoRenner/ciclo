# 104 · Diário do founder-engenheiro

Uma entrada por rodada: o que, por quê, número antes e depois, o que saiu, próxima aposta.

## 2026-10-13 · Rodada 0 · O modo de trabalho

- **O que:** escrevi `docs/104-PROMPT-FOUNDER-ENGENHEIRO.md` e a primeira lista de apostas além do plano.
- **Por quê:** os planos (98/08, 103) dizem o que fazer; faltava um critério escrito para escolher,
  medir e ir além deles sem virar opinião. As lentes de Jobs e de *Zero to One* viraram perguntas com
  número, não frases.
- **Antes → depois (o que já foi medido hoje, base para as próximas rodadas):**
  - Importar: tela nova provada a 390 px (5 fichas, R$ 35,35 na prévia, print escuro em 1,9 s).
  - Toque: aba 344 → 51 ms, dia 516 → 57 ms (mediana); pior de 5 ainda acima de 100 ms (A-05).
  - Menu: Recepção e Profissional deixaram de ver Caixa e Estoque.
  - Texto: menor texto 12 px em 7 telas; trilho deixou de cortar o chip da ponta.
- **O que saiu:** a importação antiga por CSV (rota, serviço, teste), o botão flutuante no celular.
- **Próxima:** APR-105 (um primário só no detalhe do horário). Na fila das apostas, A-04 (dia do salão
  no servidor) é a mais barata com dano evitado e entra logo depois.

## 2026-10-13 · Rodada 1 · APR-105, o detalhe do horário

- **O que e por quê:** primeiro ticket desbloqueado da Onda 1, e o de maior dano evitado: um toque
  errado no balcão (Cancelar colado em Chegou) apaga um horário com cliente na frente.
- **Antes → depois (390 px, build de produção):** primários no "confirmado" 2 → 1; Cancelar de botão
  vermelho cheio no meio → linha separada no fim, 48 px, com "Ele sai da agenda e o horário fica livre".
- **Além do ticket (Lente 1):** a captura mostrou que o detalhe NÃO dizia de quem era o horário nem o
  serviço, e a hora saía no fuso do aparelho. Agora "Marina Bastos · Platinado com Anderson Rocha" e a
  hora do negócio. Nenhum plano tinha isso: só apareceu porque a tela foi olhada como a recepção olha.
- **O que saiu:** o segundo primário; o vermelho cheio do cancelar.
- **Próxima:** APR-106 (cada bloco da Hoje avisa quando falha em vez de mostrar zero): dano evitado
  alto, porque zero falso na Hoje é número errado na tela mais vista.

## 2026-10-13 · Rodada 2 · APR-106, 107, 108 (a Hoje)

- **APR-106:** bloco que não carrega avisa e oferece "Tentar de novo" em vez de R$ 0,00. Medido no
  build com a view e a RPC renomeadas no banco local (e restauradas): 2 avisos, 0 "R$ 0,00", o resto
  da tela aberto. A guarda de degradação silenciosa reprova helper mudo e catch mudo.
- **APR-107:** "Chegou" no sheet da Hoje volta atrás com a rota caída, 5 de 5.
- **APR-108:** a Hoje reordenada. Próximo horário em y=141 (aceite < 420) com Chegou em 1 toque
  (1 POST); sem horário, "Marcar horário" em y=336 (antes ≈ 1.080); conteúdo útil em 396 ms.
  **Saíram:** saudação, nome do negócio, "Ver meu site" (menu), a faixa decorativa do dia, a seção
  "Precisa confirmar" (a linha já diz Aguardando) e 2 dos 3 cartões de sugestão.
- **Achados ao olhar a captura (Lente 1):** "0 de 17 horários feitos" ao lado de "Falta 1" lia como
  contradição (consertado: só com algum feito). E "O Motor acertou **0%** dos retornos previstos" na
  Hoje dos dois salões de demonstração: número verdadeiro, manchete que mata a confiança no
  diferencial do produto no primeiro mês. Virou a aposta A-08.
- **Próxima:** APR-109/110 (grade de horários livres compartilhada entre o público e o Marcar).

## 2026-10-14 · Rodada 3 · APR-109 a 115 (agendar, comanda, 404, Clientes, ficha)

- **APR-109/110 (grade de horários compartilhada):** uma grade (`GradeDeHorarios` + `TrilhoDeDias`
  + `core/agenda/dias`) para o público e o Marcar. Corrida público × painel 0/20; `agendar.tsx` de
  1.4xx para 1.198 linhas; Marcar em 3 toques, caindo no dia certo da Agenda.
- **APR-111 (remarcar no sheet):** 4 toques (aceite ≤ 4), grade 12 horários e trilho 14 dias dentro
  do sheet, botão "Remarcar para HH:MM", 409 com 2 alternativas tocáveis, 2 PATCH. O primeiro
  roteiro não achava a grade: a linha da Agenda não trazia `service_id` → `availability?serviceId=
  undefined` → 422. Defeito real, pego só porque a medição foi feita.
- **APR-112 (comanda "Receber R$ X"):** desconto e gorjeta no MESMO envio do fechamento (migration
  0130 equivalente, RPC com `coalesce`); nada de `onBlur` que grava sozinho (guarda vista reprovando).
  "Receber R$ 55" 3/3, caso simples 2 toques, pior 993 ms.
- **APR-113 (404 com casca):** comanda inexistente e id torto → "Essa comanda não existe" com barra e
  "Voltar para Hoje". `/admin/xyz` ainda caía no 404 da raiz (medido: barra 0): o `not-found.tsx` do
  segmento não pega rota que não casa com nada. Pega-tudo `[...naoExiste]` → 404, barra 1, saída 1.
- **APR-114 (Clientes):** busca y 401 (plano) → 286 (só tirando os quadros) → **148** (atalhos de
  "sumindo"/"aniversário" abaixo da lista). Ordem alfabética com cursor composto (A, B, C fora de
  ordem saem em ordem; homônimos não se perdem). 500 na busca → "Isso não quer dizer que a pessoa
  não existe" (aviso 1, "Confira a grafia" 0). Duas buscas em voo, a velha chega depois: mostra a
  nova. Últimos 4 dígitos acham.
- **APR-115 (ficha):** quadros por regra no core (`tilesDoResumo`, 6 casos; mutação sem a trava do
  lucro nulo reprova 3). Na demo: Visitas, Gasto médio por visita, Sobrou, Lucro por ano; 0
  "Faltas 0", 0 "R$ 0,00". "Marcar de novo" abre o Marcar com cliente e último serviço preenchidos
  (URL com `cliente` e `servico`), 3 toques até "Marcar horário". "Mensagem" 98–99% dos pontos da
  caixa a 360/390: os 4 que faltam são os cantos fora do raio de 12 px, a forma inteira responde.
- **Achado fora do plano (Lente 3, "verde não é prova"):** a guarda `lucro-nao-vaza-para-quem-atende`
  tinha `new RegExp(`\b${coluna}\b`)` — `\b` em template literal é BACKSPACE. Nunca casou nada;
  passava vazia desde que nasceu. Consertada e vista reprovando com `profit_cents` injetado na ficha.
  E `pnpm lint` reprovava com 19 erros de arquivos minificados do Tesseract (`public/ocr`, CNV-018)
  que o `.gitignore` escondia e o ESLint varria.
- **O que saiu:** "Entrou"/"Valor atendido" da ficha (preço de tabela com nome de dinheiro); "Ticket
  médio"/"Voltam de novo" do topo de Clientes (foram para o Mês); orçamento e indicar do meio do resumo.
- **Próxima:** APR-116 depende do merge do PR #149 (aberto) → pula para APR-117 (página pública de
  confirmar mostra QUAL horário, desmarcar em 2 passos com desfazer).

## 2026-10-14 · Rodada 4 · APR-117 e 118 (as páginas públicas do cliente do salão)

- **APR-117 (confirmar pelo link):** a tela não dizia QUAL horário. Agora o cartão "{serviço} com
  {profissional} · {dia}, às {hora} · {negócio}" vem do servidor e aparece em **y=138** antes de
  qualquer toque (centrado ficava em 374). Desmarcar pede 2º passo e dá 10 s para desfazer: 0 POST
  em 3 s, 0 depois de "Desfazer", 1 POST e "Desmarcado" em 10,6 s, cancelado por `client` no banco.
  "Você já confirmou" quando já estava; token forjado abre no erro com 1 saída (antes 0).
  **Fechar a aba dentro da janela:** `fetch keepalive` em `pagehide` NÃO chegou ao servidor (medido);
  `sendBeacon` chega com `page.close()` e com o evento disparado; o `goto('about:blank')` do
  Playwright não dispara `pagehide` — limitação do roteiro, não do produto. [NÃO VERIFICADO em
  navegador real de celular].
- **APR-118 (agendar público):** "Pedir este horário" (era "Confirmar agendamento": quem confirma é
  quem atende); sucesso "Pedido enviado para {negócio}"; conta sem telefone não ouve mais "é só chamar
  por telefone" (medido com o telefone do demo zerado: 0 "por telefone", 0 contato; com telefone,
  1 contato); 14 dias no trilho, 4 fechados, os 4 riscados com "fechado"; metadado sem "sem esperar
  resposta". Guardas vistas reprovando com a frase e o botão antigos de volta.
- **Achado fora do plano:** o roteiro de agendar clicava num chip de SERVIÇO achando que era horário
  (os dois são `aria-pressed`). Não é defeito de produto, mas é o tipo de ambiguidade que um leitor
  de tela também sente: fica anotado para a APR-124 (anúncios e papéis).
- **Próxima:** APR-119 (avaliar, orçamento e lista de espera lidos no servidor; saída no erro).

## 2026-10-14 · Rodada 5 · APR-119 a 123 (páginas por token, Configurações, Campanhas, Mês, Caixa)

- **APR-119:** avaliar e orçamento lidos no servidor pelo token: conteúdo útil em **881 ms com a CPU
  4× mais lenta** (o plano media 2,3–3,4 s), y=48. Token forjado nas 4 páginas públicas por token
  (avaliar, orçamento, lista de espera, confirmar): **1 interativo em cada** (eram 0). Lista de
  espera reaberta pela mesma pessoa: "Você já garantiu: sábado, 17 de outubro, às 04:30" (era
  "já foi usado", como se tivesse perdido a vaga); "já foi usado" só quando o horário caiu, e aí o
  erro leva "Ver a página de {negócio}".
- **APR-120:** Configurações reagrupadas (Seu negócio · Dinheiro · Clientes e mensagens · Avançado
  · Sua conta). "Negócio" em **y=166** (era 674); 0 descrições cortadas a 390; a 360 só o e-mail da
  conta corta (é identidade, não descrição). "Sair da conta" virou linha comum, em y=2366 — de
  propósito, documentado no código: a conta se abre uma vez por mês.
- **APR-121:** Campanhas com um primário e sem "R$ 0,00 · 0 de 0" quando nada foi enviado. Voltar
  pela origem: Campanhas aberta pela Recuperar volta "Recuperar" (`?de=recuperar`), orçamento novo
  pela ficha volta "Ficha" (`de=cliente:<id>`), direto volta "Configurações". Lista fechada de
  origens; forma estranha é ignorada (teste).
- **APR-122:** o Mês abre por "Entrou no mês" (y=184) com "mês passado R$ X" no apoio dos dois
  números; mapa de onde escapa e "Testar antes de decidir" vêm depois; "Testar" só com mês fechado
  (guarda vista reprovando com a condição removida); "Gasto médio por visita" e "Voltam de novo"
  com a definição.
- **APR-123:** "Caixa de hoje" + data; vazio diz "Você atendeu R$ X hoje e ainda não fechou as
  comandas" com o valor de `atendidoSemComandaDoDia` (integração: R$ 50 + 70 sem comanda e 90 com
  comanda fechada → R$ 120 em 2). A guarda `consulta-sem-teto` pegou a consulta nova sem `limit`
  — commit de conserto em seguida.
- **Processo:** um `cd` perdido no meio de um comando encadeado deixou uma MUTAÇÃO viva no
  arquivo (o `git checkout` falhou fora do worktree) — revertida à mão antes do commit. Regra que
  fica: `git -C <worktree>` em tudo que muda estado, nunca `cd &&`.
- **Próxima:** APR-124 (aria-live nas subtelas e contraste do selo), APR-125 (alvos de 48 px).

## 2026-10-14 · Rodada 6 · APR-124, 125 e o começo da Onda 2 (205, 203, 206)

- **APR-124:** axe nas 5 subtelas, claro e escuro (cookie `ciclo-tema`), 390 px: a única violação
  era o selo "Ativa" das Automações no claro — `--ok` a **3,98:1 sobre a própria tinta** (`bg-ok/15`),
  não sobre a superfície pura, que é o que a guarda media. Guarda estendida à tinta nas duas paletas
  (vista reprovando: ok claro 3,98, bad escuro 4,27); tokens rebalanceados sem quebrar a separação de
  luminância para daltônicos (--risk escuro e --bad claro ajustados junto). Depois: **0 violações
  nas 10 combinações**. Automações ganhou `role="status"` sempre no DOM.
- **APR-125:** sondagem ponto a ponto num quadrado de 48×48 centrado no alvo, a 360 e 390: "Pular
  tudo" 156×48 (100%), os 7 dias da Agenda 48×64 (100% — a 360 a faixa desliza em vez de espremer),
  os 2 links dentro dos parágrafos dos termos 48 de altura (100%, sem `toque-48`). "Registrar
  compra" (aviso da ficha de consumo) recebeu a classe mas [NÃO MEDIDO]: só aparece com produto sem
  custo na ficha, e o demo não tem.
- **APR-205 (Onda 2):** remarcar passava por cima de "Chegou" entre a leitura e o UPDATE. Filtro por
  status no UPDATE; 0 linhas → 409. Integração com corrida determinística (o UPDATE só roda depois
  de `marcarChegada`): a chegada vence, o horário não move. Mutação sem o filtro reprova.
- **APR-203/206:** `await apiFetch` offline sem `try` derrubava o Marcar quando o IndexedDB falha;
  o vínculo orçamento → agendamento engolia 4xx/5xx em silêncio. Guarda de rede ampliada ao
  `apiFetch` (vista reprovando com o `try` removido).
- **Onda 1 fechada** fora o que depende do Eduardo: 116 (PR #149 + decisão b) e 126–131 (nome do
  botão, duas colunas). Próxima: seguir a Onda 2 pela ordem de dano (201 fuso do expediente, 204
  desfazer fechamento, 207 "já é cliente", 208 link do orçamento…).

## 2026-10-14 · Rodada 7 · Onda 2: 201, 204, 207, 208, 213, 215, 216, 218

- **APR-201 (fuso do negócio):** aparelho em Manaus, salão em São Paulo: folga das 14:00 gravou
  **17:00Z (14:00 de SP)**; o padrão dos campos mostrou a hora de SP (4) com o aparelho às 3; digitar
  "10:00" no expediente gerou **1 PUT** (era um por tecla). Helper `paraInstante`/`paraLocal` só com
  Intl, 4 casos (inclui horário de verão).
- **APR-204 (desfazer fechamento):** botão em comanda fechada → confirmação que diz o que muda →
  200; segunda aba tentando de novo → **409** com toast; banco: `canceled`; caixa do dia volta ao
  anterior (integração). **Limite honesto, para o Eduardo decidir:** há UM ticket por atendimento
  (`tickets_um_por_agendamento`), então depois de desfazer não dá para abrir outra comanda para o
  mesmo atendimento — a confirmação diz isso. "Reabrir" (closed → open com estorno) seria o desenho
  melhor, mas esbarra na política 0127 (comanda fechada congelada). Decisão de produto.
- **APR-207:** telefone conhecido com outro nome → "Esse telefone já é de Ana Souza. O horário vai
  para o cadastro dela." e "Usar o nome do cadastro" preenche (medido).
- **APR-208/213/215/216/218:** só unitário e guarda (sem tela): E.164 sem "55 55" e sem 55 em número
  estrangeiro; faltas do assistente contadas do histórico (coluna `no_show_count` nunca é escrita);
  fim da graça no dia de Brasília (01:30Z → dia 17); slugs sequestrados pelo redirect 308 reservados
  (lista única importada pelo `next.config.ts`); push para a equipe dentro de `after()` via
  `agendarDepois` (fora de request, roda na hora). Mutações 216 e 218 vistas reprovando.
- **Processo (3 lições, todas de ferramenta):** (1) três guardas reprovaram DEPOIS do commit porque
  o `grep` da suíte engoliu o código de saída — conferir "Tests … passed" com os olhos antes do
  `git commit`; (2) o `cd` perdido no meio do comando de novo — `git -C` e caminhos absolutos em
  tudo; (3) `` digitado num heredoc virou byte 0x08 num arquivo de teste (de novo) — montar
  escapes com `chr(92)` ou usar o Edit.
- **Próxima:** 202 (datas no fuso em toda tela, guarda estendida), 210/211 (clube e mês congelado),
  212, 214, 217, 219, 221, 222. 209 e 220 esperam decisão (a; sinal).
