# C-005 · Algoritmo: agrupar a manutenção em visitas (106, AUT-303)

**F1 · Objetivo:** o motorista volta 2–3 vezes por ano, não uma vez por item. Número: visitas em 2
anos, "um item por visita" × agrupadas, com item crítico vencido = 0. **F2:** regra das montadoras e
faixas por item (`docs/106-automotivo/01-pesquisa.md`); motorista médio ~36 km/dia, aplicativo ~137.
**F3:** AUT-303 (gulosa e explicável: visita no primeiro vencimento, leva o que vence até 30 dias
depois). **F4:** commit da AUT-303; mutação "visita 20 dias depois do primeiro vencimento" reprova
(item crítico passa a vencer).

**F5 · Medida (sintético, plano genérico de carro flex manual, 2 anos):**

| Perfil | 1 item por visita | Agrupadas | Antecipação média | Crítico vencido |
| --- | --- | --- | --- | --- |
| pouco uso (16 km/dia) | 14 | **3** | 0 d | 0 |
| médio (36 km/dia) | 17 | **4** | 0 d | 0 |
| muito uso (70 km/dia) | 36 | **6** | 2 d | 0 |
| aplicativo (137 km/dia) | 72 | **10** | 0 d | 0 |

Limite: no genérico muitos itens têm o mesmo intervalo; com planos de modelo (AUT-204) o placar é
refeito. **Nota:** cliente 7 · segredo 8 · engenharia 8. **Próximo (C-006):** banco do automotivo
(AUT-101..105) se o Docker voltar; senão, A-10 (deriva no Motor da beleza) — o algoritmo segue.
