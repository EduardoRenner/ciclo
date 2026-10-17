# C-027 · Algoritmo: um intervalo só não prova nada (resultado negativo, vira guarda)

**F1 · Objetivo:** a trilha do algoritmo estava 8 ciclos sem rodada (regra: ≥ 1 a cada 3). O ponto fraco
que sobrou: com 2 visitas, o cliente de 70 dias num serviço de padrão 21 tem 0% de acerto (o único
intervalo, > 3× o padrão, é descartado e o Motor prevê 21). Número: acerto da faixa de 2 visitas.

**F2:** lição do C-013 — toda regra nova precisa de cenário para cada ramo. O ramo que aceitar o intervalo
longo machuca é o SUMIÇO de verdade logo no começo; cenário novo `CENARIOS_DE_UM_INTERVALO`.

**F3/F4 · Varredura (faixa de 2 visitas: erro · acerto, e acerto geral):**

| | v4 (descarta) | mistura 60/40 | teto 3× | teto 2× |
| --- | --- | --- | --- | --- |
| padrão errado | 47 d · 0% · 56% | 19,5 · 3% · 56% | 24 · 0% · 56% | 35 · 0% · 56% |
| sumiço no início | **1 · 100% · 86%** | 59,5 · 0% · 71% | 25 · 0% · 71% | 13 · 0% · 71% |
| os outros 7 cenários | — | iguais | iguais | iguais |

**F5:** com 1 intervalo, ritmo longo e sumiço são indistinguíveis; toda variante troca um erro grande num
cenário por um acerto perdido no outro, sem tirar o padrão errado do zero. **Rejeitado.** O cenário vira
guarda (faixa de 2 visitas 100% e geral ≥ 86% no sumiço), para quem tentar "consertar" o padrão errado
ver o custo. Em produção o padrão errado é atacado por outro caminho, a régua do serviço recalibrada pelos
dados do salão (`calibracao.ts`, régua efetiva); o cenário sintético supõe a régua sem calibrar.

**Nota:** cliente 3 · segredo 6 · engenharia 8. **Próximo (C-028):** AUT-102, o veículo no banco e a placa.
