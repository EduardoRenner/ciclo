# C-019 · Expansão automotiva: o plano do carro, o orçamento com motivo e o próximo passo

**F1 · Objetivo:** a parte pura de AUT-402 (o plano do carro em grupos), AUT-403 (orçamento montado
pelo plano, cada linha com o motivo) e AUT-405 (o próximo passo no comprovante). "Confiança é o
produto" (106 §2.2): o motivo verificável separa manutenção de "empurrar peça". Número: % de linhas
com regra + relógio, e valor que deixa de ser cobrado antes da hora.

**F2:** 106 §2.2 passos 2, 3 e 5; C-004 (vencimento), C-005 (visitas), C-007 (motivo do relógio);
`core/orcamento/calcular.ts` (total em centavos). Docker ainda fora do ar.

**F3 · Plano:** `src/core/manutencao/orcamento-do-plano.ts`:
- `planoDoCarro`: vencido / nesta visita / próxima visita com data (agrupamento do C-005) / em dia
  depois / conferir;
- `orcamentoDoPlano`: só vencido e nesta visita viram linha; o motivo junta a ORIGEM da regra
  ("pelo manual do modelo (a cada 10.000 km ou 12 meses)") e o RELÓGIO ("faltam ~300 km"); medição
  com foto quando houver; sem preço cadastrado aparece sem valor inventado; em dia vai para "pode
  esperar" com o mês; sem registro vai para "conferir", nunca cobrado;
- `proximoPasso`: km pela regra e a data do que vencer primeiro (sem ritmo medido, só pelo tempo).

**F4:** 8 casos + placar. **F5 · Medida (200 carros sintéticos, perfil flex, preços sintéticos):**

| | "Revisão completa" (tudo que vence em 90 dias) | Pelo plano |
| --- | --- | --- |
| R$ por carro | 1.590 | 1.422 |
| linhas com regra + relógio | não tem | 100% |

A diferença (≈ 11%) é pequena porque a amostra sorteia a última troca em até 900 dias: a maioria dos
itens já está vencida e entra nos dois. O ganho principal não é o valor, é o porquê em cada linha.
Registrado sem enfeitar.

**Nota:** cliente 8 · segredo 7 · engenharia 8. **Próximo (C-020):** banco do automotivo se o Docker
voltar; senão a tentativa de subir o Docker de novo (diagnóstico do WSL `docker-desktop`), porque
cinco tickets da fundação (AUT-101..105) e a prova no navegador dependem dele.
