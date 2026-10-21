# C-033 · Algoritmo: o teto de cada cenário — onde ainda dá para ganhar

**F1 · Objetivo:** parar de testar variantes às cegas. Número: para cada cenário, o acerto de um oráculo
que conhece o processo que gerou os dados (o teto) contra o Motor v4.

**F2/F3:** o oráculo prevê o ponto que maximiza o acerto da semana (±7 d) do próximo intervalo: a média
da normal; no pulo, 21 d (80% das voltas); no errático e no sumiço, o meio do uniforme (nenhuma janela
de 15 dias cobre mais que 14/31 de um uniforme de 31).

**F4/F5 · Medida (faixa de 3+ visitas):**

| Cenário | Motor | Teto | Espaço | Alcançável só com o passado? |
| --- | --- | --- | --- | --- |
| regular | 100% | 100% | 0 | — |
| errático | 47% | 47% | 0 | já no teto: o "pior cenário" é limite do processo, não do Motor |
| sumiço no início | 100% | 100% | 0 | — |
| ritmo curto | 99% | 100% | 1 | — |
| pulo | 74% | 81% | **7** | **sim**: prever o valor mais comum (21) já dá 81%; o Motor perde porque um pulo recente, com peso 2, puxa a mediana ponderada |
| deriva | 92% | 100% | 8 | em parte: a tendência foi testada e piorava outros cenários (C-011) |
| padrão errado | 79% | 87% | 8 | pouco: a faixa inclui 3 visitas (2 intervalos), onde ritmo longo e sumiço se confundem (C-027) |
| sessões iniciais | 66% | 100% | 34 | não: o oráculo sabe que as sessões acabam em 2; o passado não diz |

**Conclusão:** o errático, que parecia o ponto mais fraco, está no limite teórico. O espaço mais
alcançável é o PULO. Guarda nova (`teto-placar.test.ts`): o Motor nunca passa do teto (sanidade do
oráculo) e o placar fica impresso para cada mudança futura.

**Nota:** cliente 3 · segredo 8 · engenharia 9. **Próximo (C-034):** algoritmo no pulo — mediana
ponderada que não deixa um pulo recente puxar a previsão, sem piorar nenhum cenário (11 cenários com piso).
