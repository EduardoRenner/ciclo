# C-018 · Algoritmo: folga extra para quem está espaçando (rejeitada)

**F1 · Objetivo:** na deriva, 34% dos lembretes saem antes de uma volta que ia acontecer sozinha (C-009,
alfa 0,5). A tendência NA PREVISÃO foi rejeitada no C-011 (piorava pulo e errático). Hipótese nova: não
mexer na data prevista (pisos do backtest intactos por construção); só dar folga extra antes do
"atrasado" quando os 2 últimos intervalos estão ACIMA da mediana. Número: lembrete desnecessário ×
dias até notar quem sumiu, contra a alternativa trivial de aumentar o alfa.

**F2/F3:** termo `crescimento = max(0, mediana(últimos 2) − mediana)`, limite do alerta =
prevista + alfa × folga + beta × crescimento. Placar de lembretes do C-009 (25% de sumiço).

**F4 · Varredura (alfa 0,5; desnecessário · dias até notar):**

| beta | regular | deriva | pulo | errático | padrão errado |
| --- | --- | --- | --- | --- | --- |
| 0 (C-009) | 6% · 24 | 34% · 31,5 | 19% · 25,5 | 20% · 37,5 | 16% · 75 |
| 1 | 6% · 24 | 20% · 34 | 17% · 26,5 | 16% · 39 | 14% · 76 |
| 1,5 | 5% · 24 | 16% · 35 | 14% · 27 | 15% · 39,5 | 13% · 76 |

**Comparação com só aumentar o alfa (beta 0, do C-009):**

| Regra | deriva | pulo | errático | padrão errado |
| --- | --- | --- | --- | --- |
| alfa 0,75 | 21% · 33 | 17% · 27 | 13% · 41 | 9% · 76 |
| alfa 0,5 + beta 1 | 20% · 34 | 17% · 26,5 | 16% · 39 | 14% · 76 |
| alfa 1 | 16% · 35,5 | 16% · 28,5 | 9% · 45 | 6% · 78 |
| alfa 0,5 + beta 1,5 | 16% · 35 | 14% · 27 | 15% · 39,5 | 13% · 76 |

**F5:** no mesmo atraso para notar, o crescimento empata com o alfa na deriva e perde no errático e no
padrão errado. Ele não compra nada que o alfa já não compre: **rejeitado, código revertido** (nada
commitado além deste registro). O "34% na deriva" não é um defeito que um termo a mais conserta: é o
preço da escolha alfa 0,5 entre lembrar cedo e notar rápido, já registrada para o Eduardo no C-009.

**Nota:** cliente 4 · segredo 6 · engenharia 8 (resultado negativo medido, que evita adicionar
complexidade sem ganho). **Próximo (C-019):** banco do automotivo se o Docker voltar; senão expansão
automotiva (core puro): o orçamento por visita (AUT-304, itens da visita com preço de peça + mão de
obra e o "o que pode esperar"), no molde do 106 §2.2 passo 5.
