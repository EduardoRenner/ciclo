import { describe, expect, it } from 'vitest'

import { custoDoServico } from '@/core/comanda/custo-do-servico'

describe('custoDoServico — o insumo sai da ficha de consumo, não de um palpite', () => {
  it('soma quanto × custo médio de cada produto da ficha', () => {
    // 30 ml de água oxigenada a R$ 0,08/ml + 1 luva a R$ 0,45
    const r = custoDoServico(
      [
        { qty: 30, avgCostCents: 8 },
        { qty: 1, avgCostCents: 45 },
      ],
      1,
    )
    expect(r.custoCents).toBe(285)
    expect(r.produtosSemCusto).toBe(0)
    expect(r.produtosNaFicha).toBe(2)
  })

  it('multiplica pela quantidade do item — dois cortes gastam duas fichas', () => {
    expect(custoDoServico([{ qty: 30, avgCostCents: 8 }], 2).custoCents).toBe(480)
  })

  /**
   * Arredondar por linha acumula erro: três linhas de 0,5 centavo viram 3 se cada uma arredondar
   * para cima, e 0 se cada uma arredondar para baixo. O certo é uma vez, no fim.
   */
  it('arredonda uma vez, no fim', () => {
    const r = custoDoServico(
      [
        { qty: 0.5, avgCostCents: 1 },
        { qty: 0.5, avgCostCents: 1 },
        { qty: 0.5, avgCostCents: 1 },
      ],
      1,
    )
    expect(r.custoCents).toBe(2) // 1,5 → 2, e não 3 (0,5 arredondado três vezes)
  })

  it('serviço sem ficha não tem custo inventado, e diz que a ficha está vazia', () => {
    const r = custoDoServico([], 1)
    expect(r.custoCents).toBe(0)
    expect(r.produtosNaFicha).toBe(0)
    expect(r.produtosSemCusto).toBe(0)
  })

  /**
   * O caso que separa este módulo de uma soma qualquer: insumo sem compra registrada tem
   * `avg_cost_cents = 0` e some na soma. Sem contá-lo, o número sairia curto com cara de completo
   * — a mesma classe de defeito do quadro "Taxa" zerado (`caixa-nao-promete-taxa`).
   */
  it('produto sem custo registrado é contado, não escondido', () => {
    const r = custoDoServico(
      [
        { qty: 30, avgCostCents: 8 },
        { qty: 1, avgCostCents: 0 },
        { qty: 2, avgCostCents: 0 },
      ],
      1,
    )
    expect(r.custoCents).toBe(240)
    expect(r.produtosSemCusto).toBe(2)
    expect(r.produtosNaFicha).toBe(3)
  })

  it('custo negativo no banco não vira crédito de material', () => {
    expect(custoDoServico([{ qty: 1, avgCostCents: -500 }], 1).custoCents).toBe(0)
  })
})
