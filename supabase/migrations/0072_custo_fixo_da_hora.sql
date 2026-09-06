-- CICLO · o "Sobrou" passa a descontar a hora de cadeira
--
-- ## O que estava faltando, medido em 2026-09-06
--
-- `calcularSobraDaComanda` é `receita − material − taxa − comissão`. Não desconta aluguel, luz,
-- água, internet nem software — e não existia uma linha em `src/` nem uma coluna no banco para
-- isso. A única ocorrência de "aluguel" no projeto era `professionals.rent_cents`, que é o modelo
-- de cadeira alugada e entra como RECEITA do salão.
--
-- O número que o produto chama de "Sobrou" era, portanto, **margem de contribuição**, não lucro.
-- Num corte de R$ 45 com 40% de comissão ele dizia "Sobrou R$ 24,00", e o dono que paga R$ 3.500
-- de aluguel lia isso como o dinheiro que ficou. O `docs/47` P05 acusa o setor de mostrar
-- faturamento com cara de lucro; isto é a mesma família, um degrau acima — e dentro do produto que
-- faz a acusação.
--
-- ## As três perguntas, e por que não são uma planilha
--
-- Quanto sai por mês, quantas horas o salão fica aberto, quantas cadeiras. O `docs/47` P02 mede
-- que 73% dos donos não sabem calcular o custo de um serviço — mas todos sabem de cabeça o que
-- pagam de aluguel. Delas sai o custo de uma hora de UMA cadeira, e o custo de um atendimento é o
-- tempo que ele ocupa essa cadeira.
--
-- As respostas moram em `tenants.settings.custo_fixo`, no mesmo padrão jsonb de
-- `payment_fees_bps`, `loyalty` e `mensageria` — não em tabela nova, porque são três números por
-- tenant e uma tabela para isso seria cerimônia sem ganho.
--
-- ## Por que a coluna é congelada, e por que o passado não muda
--
-- Mesmo motivo de `fee_bps` (`0066`) e de `material_incerto` (`0070`): se o dono renegociar o
-- aluguel em novembro, a comanda de agosto não pode mudar junto. `default 0` para as linhas que já
-- existem, e elas ficam como estão — comanda fechada é registro contábil, e a `0069` já decidiu
-- não reescrevê-lo.
--
-- O efeito colateral é conhecido e aceito: um mês que mistura comandas de antes e de depois soma
-- lucros calculados por réguas diferentes. É o mesmo degrau que a `0066` criou quando a taxa
-- passou a ser descontada, e a alternativa — recalcular o passado — é a que quebra a regra que
-- este produto inteiro defende.

alter table tickets
  add column fixed_cost_cents bigint not null default 0 check (fixed_cost_cents >= 0);

comment on column tickets.fixed_cost_cents is
  'O custo fixo da hora de cadeira que este atendimento ocupou, CONGELADO no fechamento a partir de tenants.settings.custo_fixo e da duracao dos servicos da comanda. Zero em comanda fechada antes da 0072, e zero enquanto o dono nao responder as tres perguntas -- nesse caso quem avisa e a lacuna da tela, nunca o numero.';
