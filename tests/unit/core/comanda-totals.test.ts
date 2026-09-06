import { describe, expect, it } from 'vitest'

import { calcularComissaoItem, calcularSobraDaComanda, calcularTotalItem, calcularTotaisComanda } from '@/core/comanda/totals'
import { explicarSobra } from '@/core/comanda/sobra-explicada'

describe('calcularTotalItem', () => {
  it('qty inteira × preço, sem desconto', () => {
    expect(calcularTotalItem({ qty: 2, unitPriceCents: 5_000, discountCents: 0 })).toBe(10_000)
  })

  it('qty decimal (produto por ml/g) arredonda para o centavo mais próximo', () => {
    // 33,333... arredonda pra 33
    expect(calcularTotalItem({ qty: 0.333, unitPriceCents: 10_000, discountCents: 0 })).toBe(3_330)
  })

  it('desconto por item é subtraído depois do arredondamento', () => {
    expect(calcularTotalItem({ qty: 1, unitPriceCents: 10_000, discountCents: 1_500 })).toBe(8_500)
  })

  it('desconto maior que o valor bruto nunca deixa o item negativo', () => {
    expect(calcularTotalItem({ qty: 1, unitPriceCents: 1_000, discountCents: 5_000 })).toBe(0)
  })
})

describe('calcularComissaoItem', () => {
  it('base gross: comissão sobre o total do item, sem descontar material', () => {
    const r = calcularComissaoItem({ totalCents: 10_000, costCents: 3_000, commissionBps: 4_000, commissionBase: 'gross' })
    expect(r).toBe(4_000) // 40% de 10.000
  })

  it('base net_of_material: comissão sobre total menos custo', () => {
    const r = calcularComissaoItem({ totalCents: 10_000, costCents: 3_000, commissionBps: 4_000, commissionBase: 'net_of_material' })
    expect(r).toBe(2_800) // 40% de (10.000 - 3.000)
  })

  it('custo maior que o total nunca gera base negativa em net_of_material', () => {
    const r = calcularComissaoItem({ totalCents: 1_000, costCents: 5_000, commissionBps: 5_000, commissionBase: 'net_of_material' })
    expect(r).toBe(0)
  })

  it('0% de comissão dá 0, não erro', () => {
    expect(calcularComissaoItem({ totalCents: 10_000, costCents: 0, commissionBps: 0, commissionBase: 'gross' })).toBe(0)
  })
})

describe('calcularTotaisComanda', () => {
  it('soma das partes bate com o total: subtotal - desconto + gorjeta', () => {
    const r = calcularTotaisComanda({
      items: [{ totalCents: 5_000 }, { totalCents: 3_330 }, { totalCents: 8_500 }],
      discountCents: 1_000,
      tipCents: 2_000,
    })
    expect(r.subtotalCents).toBe(16_830)
    expect(r.totalCents).toBe(17_830) // 16.830 - 1.000 + 2.000
  })

  it('desconto maior que o subtotal não deixa o total (antes da gorjeta) negativo', () => {
    const r = calcularTotaisComanda({ items: [{ totalCents: 1_000 }], discountCents: 5_000, tipCents: 0 })
    expect(r.totalCents).toBe(0)
  })

  it('comanda sem item nenhum: tudo zero', () => {
    const r = calcularTotaisComanda({ items: [], discountCents: 0, tipCents: 0 })
    expect(r).toEqual({ subtotalCents: 0, totalCents: 0 })
  })

  it('muitos itens com centavos quebrados: soma continua exata, sem drift de ponto flutuante', () => {
    const items = Array.from({ length: 37 }, () => ({ totalCents: calcularTotalItem({ qty: 0.1, unitPriceCents: 333, discountCents: 0 }) }))
    const r = calcularTotaisComanda({ items, discountCents: 0, tipCents: 0 })
    expect(r.subtotalCents).toBe(items.reduce((s, i) => s + i.totalCents, 0))
    expect(Number.isInteger(r.subtotalCents)).toBe(true)
  })
})

describe('calcularSobraDaComanda', () => {
  /*
   * O caso que estava errado em produção. A tela do caixa promete
   * "Sobrou = o que entrou menos material, taxa e comissão" — e `profit_cents` era
   * `subtotal − material − comissão`, sem o desconto. Com R$ 20 de desconto numa comanda
   * de R$ 100 e nenhum custo, "Entrou" mostrava R$ 80 e "Sobrou" mostrava R$ 100.
   */
  it('o desconto da comanda sai da sobra — sobrar mais do que entrou é impossível', () => {
    const sobra = calcularSobraDaComanda({
      subtotalCents: 10_000,
      discountCents: 2_000,
      tipCents: 0,
      materialCents: 0,
      feeCents: 0,
      commissionCents: 0,
      fixedCostCents: 0,
    })
    expect(sobra).toBe(8_000)
  })

  it('a gorjeta não vira lucro do salão — ela é 100% do profissional (F84)', () => {
    const { totalCents } = calcularTotaisComanda({ items: [{ totalCents: 10_000 }], discountCents: 0, tipCents: 3_000 })
    const sobra = calcularSobraDaComanda({
      subtotalCents: 10_000,
      discountCents: 0,
      tipCents: 3_000,
      materialCents: 0,
      feeCents: 0,
      commissionCents: 0,
      fixedCostCents: 0,
    })
    expect(totalCents).toBe(13_000)
    expect(sobra).toBe(10_000)
  })

  it('material, taxa e comissão saem todos — os três nomes que a tela promete', () => {
    const sobra = calcularSobraDaComanda({
      subtotalCents: 10_000,
      discountCents: 0,
      tipCents: 0,
      materialCents: 1_500,
      feeCents: 300,
      commissionCents: 4_000,
      fixedCostCents: 0,
    })
    expect(sobra).toBe(4_200)
  })

  it('desconto maior que o subtotal não vira receita negativa antes dos custos', () => {
    const sobra = calcularSobraDaComanda({
      subtotalCents: 1_000,
      discountCents: 5_000,
      tipCents: 0,
      materialCents: 0,
      feeCents: 0,
      commissionCents: 0,
      fixedCostCents: 0,
    })
    expect(sobra).toBe(0)
  })

  it('a sobra pode ser negativa quando o custo passa a receita — prejuízo não é escondido', () => {
    const sobra = calcularSobraDaComanda({
      subtotalCents: 10_000,
      discountCents: 0,
      tipCents: 0,
      materialCents: 12_000,
      feeCents: 0,
      commissionCents: 0,
      fixedCostCents: 0,
    })
    expect(sobra).toBe(-2_000)
  })

  /*
   * A invariante que a tela do caixa depende: "Sobrou" nunca passa de "Entrou". Cobre o par
   * desconto/gorjeta em conjunto, que é onde as duas fórmulas divergiam.
   */
  it('em toda combinação de desconto e gorjeta, a sobra nunca passa do que entrou', () => {
    for (const discountCents of [0, 500, 2_000, 9_999, 20_000]) {
      for (const tipCents of [0, 1_000, 5_000]) {
        const { totalCents } = calcularTotaisComanda({ items: [{ totalCents: 10_000 }], discountCents, tipCents })
        const sobra = calcularSobraDaComanda({
          subtotalCents: 10_000,
          discountCents,
          tipCents,
          materialCents: 0,
          feeCents: 0,
          commissionCents: 0,
      fixedCostCents: 0,
        })
        expect(sobra, `desconto ${discountCents}, gorjeta ${tipCents}`).toBeLessThanOrEqual(totalCents)
      }
    }
  })

  /**
   * A quarta parcela (`0072`). Sem ela a conta era margem de contribuição com nome de lucro: um
   * corte de R$ 100 com 40% de comissão "sobrava" R$ 60,00 para um dono que paga aluguel.
   *
   * Este caso nasceu de uma mutação que passou VERDE: remover `- fixedCostCents` daqui não quebrou
   * teste nenhum, porque todas as chamadas existentes passavam zero. Guarda que só exercita o
   * valor neutro de uma parcela não guarda a parcela.
   */
  it('o aluguel sai da sobra, e não só ocupa lugar na assinatura', () => {
    const base = {
      subtotalCents: 10_000,
      discountCents: 0,
      tipCents: 0,
      materialCents: 0,
      feeCents: 0,
      commissionCents: 4_000,
    }
    expect(calcularSobraDaComanda({ ...base, fixedCostCents: 0 })).toBe(6_000)
    expect(calcularSobraDaComanda({ ...base, fixedCostCents: 1_000 })).toBe(5_000)
  })

  /**
   * As duas pontas do mesmo número: `explicarSobra` desenha o "Sobrou" da tela do atendimento e
   * `calcularSobraDaComanda` grava `tickets.profit_cents`. Se divergirem, a tela do atendimento
   * discorda do caixa e nada reprova — foi por isso que a primeira delegou a conta à segunda.
   */
  it('a tela do atendimento e o valor gravado são o MESMO número', () => {
    const parcelas = {
      subtotalCents: 18_000,
      discountCents: 1_500,
      tipCents: 2_000,
      materialCents: 2_460,
      feeCents: 640,
      commissionCents: 7_200,
      fixedCostCents: 1_346,
    }
    const gravado = calcularSobraDaComanda(parcelas)
    const naTela = explicarSobra({ ...parcelas, taxaRespondida: true, custoFixoRespondido: true, itensComMaterialIncerto: 0 }).sobraCents
    expect(naTela, 'a tela do atendimento passou a mostrar um número diferente do que foi gravado').toBe(gravado)
  })
})
