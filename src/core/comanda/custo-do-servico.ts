/**
 * De onde sai o custo de insumo de um serviço — e por que ele não sai de onde saía.
 *
 * ## O buraco, medido (`docs/49`)
 *
 * `services.cost_cents` existe desde a `0001`, entra em `ticket_items.cost_cents` no lançamento e
 * de lá em `tickets.material_cost_cents`. **Nada no produto escreve essa coluna**: ela não aparece
 * em `listarServicos` ("é estimativa interna, não vai para a UI de catálogo"), não tem campo em
 * `config/servicos`, nem rota. Ou seja, para todo serviço de todo tenant ela vale zero — e o
 * "Material" do caixa só conta produto vendido no balcão. É a mesma família do `fee_cents`:
 * coluna lida por três lugares e escrita por ninguém.
 *
 * ## Por que a ficha de consumo é a resposta certa
 *
 * O `docs/48` §Fase 3 aponta a fragilidade da tese inteira: o `docs/47` P02 mede que **73% dos
 * donos não sabem calcular o custo real de cada serviço**, então pedir que ele digite o custo é
 * pedir exatamente a coisa que ele não sabe fazer.
 *
 * Só que o dado já está no banco, por outro motivo: a ficha de consumo (`service_products`) diz
 * quanto de cada produto um serviço gasta, e `products.avg_cost_cents` é a média móvel ponderada
 * mantida pelas compras. `baixarEstoqueDaComanda` já usa a ficha para dar baixa — falta ela também
 * responder quanto aquilo custou. O dono não precisa saber o custo do serviço: ele precisa saber o
 * que gasta e quanto pagou no produto, que é o que ele já cadastra para o estoque não furar.
 *
 * ## O que esta função não faz
 *
 * Não inventa custo para serviço sem ficha, e não esconde produto sem custo. Um insumo que nunca
 * teve compra registrada tem `avg_cost_cents = 0`, e somá-lo como zero produziria um custo que
 * PARECE completo. Por isso o resultado carrega quantos produtos entraram sem custo: é o que
 * permite a tela dizer "falta o custo de 2 produtos" em vez de afirmar um número curto.
 */

export type LinhaDaFicha = {
  /** Quanto do produto o serviço gasta por unidade de serviço (`service_products.qty`). */
  qty: number
  /** `products.avg_cost_cents` — a média móvel das compras. Zero quando nunca houve compra. */
  avgCostCents: number
}

export type CustoDoServico = {
  custoCents: number
  /** Quantos produtos da ficha entraram valendo zero por falta de compra registrada. */
  produtosSemCusto: number
  /** Quantos produtos a ficha tem. Zero = serviço sem ficha, que é outro estado. */
  produtosNaFicha: number
}

/**
 * Uma multiplicação e um arredondamento, no fim. `qty` da ficha é decimal (30 ml de água
 * oxigenada), `qty` do item também (meia sessão não existe, mas dois cortes no mesmo item sim) —
 * arredondar por linha acumularia erro de centavo em ficha com muitos itens.
 */
export function custoDoServico(ficha: readonly LinhaDaFicha[], qtyDoItem: number): CustoDoServico {
  let porUnidade = 0
  let produtosSemCusto = 0

  for (const linha of ficha) {
    porUnidade += linha.qty * linha.avgCostCents
    if (linha.avgCostCents <= 0) produtosSemCusto++
  }

  return {
    custoCents: Math.max(0, Math.round(porUnidade * qtyDoItem)),
    produtosSemCusto,
    produtosNaFicha: ficha.length,
  }
}
