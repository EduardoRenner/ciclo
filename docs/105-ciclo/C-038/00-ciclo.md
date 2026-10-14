# C-038 · Algoritmo: o carro que muda de uso

**Trilha:** algoritmo do Motor (o último foi o C-035; a regra é ≥ 1 a cada 3 ciclos), no relógio de km da expansão automotiva.

## F1 · Prompt
O ritmo de uso do carro (`ritmoDeUso`) é a mediana de TODAS as taxas entre leituras de km. Isso nunca tinha sido
medido num carro que MUDA de uso — a pessoa que vira motorista de aplicativo, ou que passa a trabalhar de casa.
Hipótese: a mediana do histórico inteiro leva metade das visitas para perceber a troca e o lembrete da troca de
óleo chega meses atrasado (ou adiantado).

## F2 · Pesquisa (experimento, semente 3803, 400 carros × 5 previsões por perfil, erro mediano em dias / % > 7 d tarde)

| perfil | histórico inteiro | ponderada | só a última | mediana das 3 últimas | mediana das 4 últimas |
| --- | --- | --- | --- | --- | --- |
| estável ±20% | 15 / 33% | 15 / 36% | 18 / 36% | 15 / 34% | 15 / 34% |
| virou aplicativo no 3º (13k → 45k) | **118 / 80%** | 107 / 80% | 14 / 42% | **23 / 56%** | 44 / 68% |
| parou de rodar no 3º (25k → 7k) | **175 / 11%** | 84 / 11% | 0 / 12% | **12 / 11%** | 73 / 11% |
| ruidoso ±50% | 39 / 41% | 40 / 48% | 47 / 42% | 40 / 42% | 39 / 42% |
| um ano atípico (viagem 3×) | 10 / 30% | 27 / 21% | 16 / 34% | 11 / 32% | 10 / 29% |

"Só a última" ganha na troca, mas paga no ruído (47) e no ano atípico (16). A janela de 3 é o ponto que fica
perto do melhor em todo perfil. A média ponderada pelo tempo não resolve: continua presa ao passado.

## F3 · Plano
Uma linha: `mediana(taxas.slice(-JANELA_DO_RITMO_DE_USO))` com a janela em 3, constante exportada com o porquê.
Placar permanente no `relogios-placar` com os 5 perfis e o jeito antigo refeito fora do módulo como comparador.

## F4 · Execução
- `src/core/cycle/relogios.ts`: `JANELA_DO_RITMO_DE_USO = 3`.
- `tests/unit/core/cycle/relogios-placar.test.ts`: describe C-038 — na troca, ≤ 30 dias e menos da metade do
  jeito antigo; sem troca, no máximo 2 dias pior.
- Commit `989fe9f4`. Unidade 466 arquivos / 4.314 testes verdes antes do commit.

## F5 · Medida
- Troca de uso: 118 → 23 dias (virou aplicativo), 175 → 12 (parou de rodar). Estável 15 → 15, ruidoso 39 → 40,
  ano atípico 10 → 11. Placar C-002 (uso constante) intacto.
- Mutação depois do commit: histórico inteiro → 2 reprovam; janela 4 → 2 reprovam; janela 1 → 4 reprovam
  (inclusive o C-002 médio). Guarda vista reprovando nos dois lados.
- Integração: a falha de `atribuicao` do run de C-036/C-037 passa isolada (13/13) — gateway local.

Nota 1–10 (impacto / esforço / confiança): 6 / 2 / 8.
