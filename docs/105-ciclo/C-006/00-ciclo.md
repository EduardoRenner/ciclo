# C-006 · Algoritmo: o cliente que está desacelerando (A-10, Motor v3)

**F1 · Objetivo:** quem está espaçando as visitas (o cliente que vai embora devagar, e o que mais vale
recuperar) era previsto pelo meio da série. Número: acerto na semana no cenário "deriva" (85% na v2),
sem piorar nenhum outro cenário. **F2:** C-001 (último intervalo ganha na deriva: 2 d × 5 d);
literatura (Platzer & Reutterer 2016): regularidade e recência importam para o "quando".
**F3:** mediana ponderada dos últimos 5 intervalos; varrer 4 conjuntos de pesos; escolher o que não
piora nenhum cenário. **F4:** commit da v3; mutação (pesos iguais = v2) reprova o piso novo.

**F5 · Medida (faixa 3+ visitas, sintético):**

| Pesos | regular | deriva | pulo | errático | padrão errado |
| --- | --- | --- | --- | --- | --- |
| v2 (iguais) | 1 d · 100% | 5 d · 85% | 3 d · 73% | 8 d · 47% | 5 d · 66% |
| **[1,1,1,2,2] (v3)** | 1 · 100% | **4 · 92%** | 3 · 74% | 8 · 47% | 5 · 66% |
| [1,1,2,2,2] | 1 · 100% | 4 · 92% | 3 · 73% | 8 · 48% | 5 · 65% ✗ |
| [1,2,2,3,3] | 1 · 100% | 4 · 92% | 3 · 74% | 8 · 47% | 5 · 66% |
| [1,1,1,1,2] | 2 · 100% ✗ | 4 · 93% | 3 · 70% ✗ | 8 · 47% | 5 · 64% ✗ |

Escolhido o mais conservador sem perda. Nota: o erro mediano GERAL do "regular" (todas as faixas)
foi de 1 para 2 dias (arredondamento da mediana ponderada); a faixa 3+ não mudou. Registrado, não
escondido. **Nota:** cliente 6 · segredo 8 · engenharia 8. **Próximo (C-007):** banco do automotivo
se o Docker voltar; senão, serviço como software (trilha 5): a mensagem que diz o relógio (A-12), pura.
