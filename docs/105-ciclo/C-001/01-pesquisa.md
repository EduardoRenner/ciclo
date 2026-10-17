# C-001 · Pesquisa

## Interna (LEITURA de código, 14/10/2026)

- `computeCycle` (`src/core/cycle/compute.ts`, `VERSAO_DO_MOTOR = 1`): intervalos entre visitas do
  cliente NAQUELE serviço → descarta intervalo > 3× o padrão do serviço → 0 intervalos: padrão;
  1–2: 0,6·mediana + 0,4·padrão; 3+: mediana dos últimos 5 → limita entre 0,5× e 2,5× o padrão →
  data prevista = última visita + ciclo. Estado por faixas FIXAS de atraso (−3, 0, 10, 30 dias),
  iguais para todo cliente.
- `prestacaoDeContas` mede em produção, depois do fato: acerto na semana (±7 dias, `TOLERANCIA_DIAS`),
  mínimo de 8 conferidas para afirmar. `calibrarCiclo` corrige o PADRÃO do serviço pela mediana das
  voltas reais. **Não existe comparação de duas versões do algoritmo antes de ir para o ar.**
- Quem chama `computeCycle`: `server/services/ciclo.ts` (2×), `ciclo-de-quem-ja-atende.ts` e
  `ingestao/previa-do-dinheiro.ts` (estes dois só com a ÚLTIMA visita: o ciclo vira o padrão).
- LEITURA → H2 parece real: com padrão 21 e ritmo real 70, todo intervalo (70 > 63) é descartado e o
  Motor volta ao padrão; o limite de 2,5× (52 dias) ainda impediria chegar a 70.

## Externa

- **Avaliar previsão com origem móvel** (para cada ponto da série, prever o próximo só com o passado)
  é o método padrão e correto; validação embaralhada vaza o futuro para o treino. [Hyndman/Tashman via
  vinheta `greybox` "Rolling Origin", CRAN, consultado 14/10/2026](https://cran.ms.unimelb.edu.au/web/packages/greybox/vignettes/ro.html);
  [arXiv 2609.27867, "Evaluation Choices Decide the Forecasting Leaderboard"](https://arxiv.org/pdf/2609.27867).
- **Os modelos clássicos de recompra (Pareto/NBD, BG/NBD) supõem compra "sem memória" (Poisson)** e por
  isso não representam quem volta em ritmo fixo — exatamente o cliente de salão. A extensão que trata
  a **regularidade** (Pareto/GGG) prevê melhor, e o ganho é maior no cliente valioso, antes regular,
  que ficou quieto: **um cliente regular atrasado tem mais chance de ter ido embora do que um cliente
  irregular com o mesmo atraso.** [Platzer & Reutterer, "Ticking Away the Moments", Marketing Science
  2016](https://pubsonline.informs.org/doi/fpi/10.1287/mksc.2015.0963).
- O modelo melhor em CONTAR compras não é o melhor em prever QUANDO; para o "quando", modelos que
  olham o intervalo individual ganham. [Korkmaz, Kuik & Fok, EUR 2013](https://repub.eur.nl/pub/38235).
- Em previsão do próximo pedido online, os sinais mais informativos são o número de compras anteriores
  e o intervalo mediano. [arXiv 1512.04912](https://arxiv.org/pdf/1512.04912).

## O que isso muda no ciclo

- O caminho do Motor (intervalo individual, mediana) está certo para este mercado — é o que a
  literatura recomenda para compra regular. Não trocar por BG/NBD.
- **Aposta nova (A-09):** a faixa de estado deveria escalar pela REGULARIDADE de cada cliente
  (dispersão dos intervalos), não ser fixa em 10/30 dias. Regular e atrasado 8 dias = sinal forte;
  irregular e atrasado 8 dias = ruído. Fica para um ciclo seguinte, com o backtest deste.

## Pergunta de Thiel
Verdade pouco aceita que isso sustenta: **o setor usa uma régua fixa ("sumiu há 45 dias") porque
ninguém mede a previsão; quem mede por cliente e por regularidade vê quem está indo embora semanas
antes.** O backtest é o que transforma isso de frase em vantagem verificável.
