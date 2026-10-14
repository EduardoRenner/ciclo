# C-011 · Algoritmo: dois intervalos que concordam provam o ritmo (Motor v4)

**F1 · Objetivo:** o C-009 apontou a deriva (34% de lembretes desnecessários) como o pior caso.
Número: acerto na semana e erro mediano por cenário, sem piorar nenhum (regra MOT-003).

**F2/F3 · Hipótese 1, tendência robusta (rejeitada):** somar k × inclinação de Theil-Sen dos últimos
intervalos, com e sem trava de Kendall τ. Toda variante melhora a deriva e piora outro cenário:

| Variante | regular | deriva | pulo | errático | padrão errado |
| --- | --- | --- | --- | --- | --- |
| v3 | 1 d · 100% | 4 · 92% | 3 · 74% | 8 · 47% | 5 · 66% |
| k 1,5, τ ≥ 0,8 | 1 · 100% | 3 · 94% | 3 · 72% ✗ | 8 · 47% | 5 · 65% ✗ |
| k 1, sem trava | 2 ✗ · 100% | 3 · 96% | 3 · 72% ✗ | 8 · 45% ✗ | 5 · 63% ✗ |

**Hipótese 2, achada na mesma varredura:** no "padrão errado" o viés era de −8,8 dias. Com 3 visitas
(2 intervalos) a v3 descartava os DOIS intervalos de 70 dias como anomalia (> 3 × 21) e previa 21.
Regra: 2 intervalos que concordam (o maior até 1,5× o menor) e caem os dois fora da régua do padrão
provam o ritmo, sem mistura com o padrão.

| Variante (faixa 3+ · geral) | regular | deriva | pulo | errático | padrão errado |
| --- | --- | --- | --- | --- | --- |
| v3 | 1·100% · 2·100% | 4·92% · 3·94% | 3·74% · 3·73% | 8·47% · 8·47% | 5·66% · 9·47% |
| **v4 (os dois fora do padrão)** | igual | igual | igual | igual | **4·79% · 6·56%** |
| concordância sem exigir "fora" | igual | 4·93% | igual | 8·46% ✗ | 4·82% |

**F4:** `VERSAO_DO_MOTOR` 4, pisos do backtest baixados (padrão errado: erro 4, acerto 79), 5 casos
unitários (concordam fora acima, fora abaixo, discordam, dentro da régua, um dentro e um fora).

**F5 · Medida:** padrão errado, faixa 3+: acerto na semana 66% → 79%, erro mediano 5 → 4 d; geral
47% → 56%. Cobertura da faixa sem ritmo nesse cenário 48% → 59% (de carona). Nenhum outro cenário mudou.
A deriva continua sem conserto que não custe outro cenário: fica registrado, não forçado.

**Nota:** cliente 6 · segredo 8 · engenharia 8. **Próximo (C-012):** banco do automotivo se o Docker
voltar; senão serviço como software: a mensagem do pet (vacina/vermífugo pelo motivo, "aproveita o
banho de sexta"), no molde da mensagem do automotivo (C-007).
