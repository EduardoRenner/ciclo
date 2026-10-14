# C-035 · Algoritmo: encolher para a régua — só quando o salão já a mediu (Motor v5)

**F1 · Objetivo:** o C-034 mostrou que parte do espaço até o teto exige ENCOLHER a previsão em direção ao
ritmo do serviço (o plano 98 §3 já sugeria). Número: acerto da faixa de 3+ visitas, por cenário.

**F2/F3:** o arnês usava o padrão fixo do catálogo, e em produção o padrão é a régua CALIBRADA pelo
salão (`services.cycle_days_observado`, `calibracao.ts`). Modo novo do arnês: `calibrar()` (régua =
mediana dos intervalos da população). Varredura do peso κ: ciclo = (n·ponderada + κ·régua) / (n + κ).

**F4 · Medida (faixa 3+):**

| κ | régua | deriva | pulo | errático | padrão errado | ritmo curto | sessões | regular/sumiço |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 0 (v4) | calibrada | 93% | 74% | 47% | 83% | 100% | 65% | 100% |
| **3 (v5)** | **calibrada** | **96%** | 74% | **50%** | **85%** | 100% | 66% | 100% |
| 3 | SEM calibrar | 77% ✗ | 74% | 48% | **14%** ✗ | 89% ✗ | 68% | 100% |

**F5:** encolher ajuda com régua calibrada e é DESASTROSO contra um padrão errado (o padrão errado cai de
79% para 14%). Por isso a v5 é opt-in: `reguaCalibrada` só é verdade quando o serviço tem o ritmo
observado; o job e o recálculo de um atendimento passam o sinal. Sem régua calibrada o Motor é
exatamente a v4 (os pisos da v4 seguem valendo). O pulo NÃO melhorou: seus erros estão em históricos de 2
e 3 intervalos, onde peso 3 não basta (fica registrado).

Guardas: pisos da régua calibrada por cenário e v5 ≥ v4 em todos; unidade (42, 40, 44 com régua 21 → 31,5);
integração (serviço com ritmo observado → ciclo 32 em vez de 42). `VERSAO_DO_MOTOR` 5.

**Nota:** cliente 6 · segredo 9 · engenharia 9. **Próximo (C-036):** expansão — o check-in pela placa
(AUT-401) começa pela parte pura: placa → veículo existente ou ficha nova em 3 toques.
