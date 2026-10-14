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
  tinha `new RegExp(`${coluna}`)` — `` em template literal é BACKSPACE. Nunca casou nada;
  passava vazia desde que nasceu. Consertada e vista reprovando com `profit_cents` injetado na ficha.
  E `pnpm lint` reprovava com 19 erros de arquivos minificados do Tesseract (`public/ocr`, CNV-018)
  que o `.gitignore` escondia e o ESLint varria.
- **O que saiu:** "Entrou"/"Valor atendido" da ficha (preço de tabela com nome de dinheiro); "Ticket
  médio"/"Voltam de novo" do topo de Clientes (foram para o Mês); orçamento e indicar do meio do resumo.
- **Próxima:** APR-116 depende do merge do PR #149 (aberto) → pula para APR-117 (página pública de
  confirmar mostra QUAL horário, desmarcar em 2 passos com desfazer).
