# C-034 · Algoritmo: o pulo — a causa não era o peso do recente (resultado negativo + diagnóstico)

**F1 · Objetivo:** o pulo tinha 7 pontos de espaço até o teto (C-033: Motor 74%, teto 81%). Hipótese do
C-033: um pulo recente, com peso 2 na mediana ponderada, puxa a previsão.

**F2/F3/F4 · Hipótese testada:** tirar da mediana ponderada os intervalos acima de L × a mediana dos
últimos 5 (L 1,3 / 1,5 / 1,7 / 2,0).

| | regular | deriva | pulo | errático | padrão errado | ritmo curto | sessões | sumiço |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| v4 | 100% | 92% | 74% | 47% | 79% | 99% | 66% | 100% |
| L 1,3 | 100% | 90% ✗ | 75% | 45% ✗ | 79% | 99% | 46% ✗ | 100% |
| L 1,5 | 100% | 92% | 74% | 45% ✗ | 79% | 99% | 48% ✗ | 100% |
| L 1,7 | 100% | 92% | 74% | 46% ✗ | 79% | 99% | 59% ✗ | 100% |
| L 2,0 | 100% | 92% | 74% | 47% | 79% | 99% | 65% ✗ | 100% |

Rejeitada: ganha no máximo 1 ponto no pulo e piora 3 cenários.

**F5 · Diagnóstico (a parte que vale):** das 807 voltas normais do pulo, o Motor erra 83. Todas têm
histórico com pulos DEMAIS por acaso: intervalos 42, 42 → previsão 34; 42, 20, 42 → 42. Olhando só aquele
cliente, a leitura é razoável (ele pode ser um cliente de 42 dias). O oráculo acerta porque sabe que 80% da
POPULAÇÃO volta em 21. O espaço do pulo não se alcança com regra por cliente: exige ENCOLHER a previsão de
quem tem pouco histórico em direção ao ritmo do serviço (encolhimento bayesiano, a ideia do plano 98 §3).

**Próximo experimento, e por que o arnês tem de mudar antes:** em produção o ritmo do serviço é a régua
CALIBRADA pelo próprio salão (`calibracao.ts`); o arnês usa o padrão fixo, sem calibrar (no "padrão
errado", 21 para uma clientela de 70). Testar encolhimento contra um padrão errado de propósito
condenaria a ideia por um defeito que a produção não tem. O arnês precisa de um modo "régua calibrada"
(padrão = mediana da população do cenário) antes de medir.

**Nota:** cliente 3 · segredo 7 · engenharia 9. **Próximo (C-035):** arnês com régua calibrada + medir o
encolhimento em direção a ela; ou expansão (o check-in pela placa, AUT-401) se o algoritmo empatar.
