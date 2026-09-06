import { describe, expect, it } from 'vitest'

import { MINIMO_DE_ATENDIMENTOS, PISO_DE_MARGEM_BPS, margemPorServico } from '@/core/caixa/margem-do-servico'

/**
 * `docs/50` L-06. "Sobrou R$ 21,40" responde quanto; esta função responde por quê — qual das três
 * parcelas está comendo o lucro daquele serviço, sem nunca dizer o que fazer a respeito (o veto de
 * precificação automática do `CLAUDE.md` vale aqui).
 */

const item = (serviceId: string | null, totalCents: number, costCents = 0, commissionCents = 0) => ({
  serviceId,
  totalCents,
  costCents,
  commissionCents,
})

/** Três comandas iguais — o mínimo para o serviço aparecer. */
const tresVezes = (itens: ReturnType<typeof item>[], discountCents = 0, feeCents = 0) =>
  [1, 2, 3].map(() => ({ itens, discountCents, feeCents }))

describe('margemPorServico — a razão ao lado do número', () => {
  it('soma receita, material e comissão do item, e rateia desconto e taxa da comanda', () => {
    // Corte de R$ 100 com R$ 10 de produto e R$ 40 de comissão; taxa de R$ 3 na comanda.
    const [m] = margemPorServico(tresVezes([item('corte', 10_000, 1_000, 4_000)], 0, 300))

    expect(m!.atendimentos).toBe(3)
    expect(m!.receitaCents).toBe(30_000)
    expect(m!.materialCents).toBe(3_000)
    expect(m!.comissaoCents).toBe(12_000)
    expect(m!.taxaCents, 'a comanda tem um serviço só: ele leva a taxa inteira').toBe(900)
    expect(m!.lucroCents).toBe(30_000 - 3_000 - 900 - 12_000)
    expect(m!.margemBps).toBe(Math.round((14_100 / 30_000) * 10_000))
  })

  /**
   * A soma das partes tem que reconstruir o `profit_cents` congelado do fechamento. Se não
   * reconstruir, esta tela vira o segundo total que não bate com o caixa do lado — a armadilha de
   * "duas fontes da mesma verdade" que esta base já pagou no livro-caixa.
   */
  it('as partes somam exatamente o lucro da comanda, com desconto e taxa rateados', () => {
    const itens = [item('corte', 7_000, 500, 2_800), item('barba', 3_000, 200, 1_200)]
    const margens = margemPorServico(tresVezes(itens, 1_000, 333))

    const lucroDaComanda = 10_000 - 1_000 - 700 - 333 - 4_000
    const somaDasPartes = margens.reduce((s, m) => s + m.lucroCents, 0)
    expect(somaDasPartes, 'o rateio perdeu ou inventou centavo').toBe(lucroDaComanda * 3)
  })

  it('item de produto avulso não vira margem de serviço', () => {
    const margens = margemPorServico(tresVezes([item('corte', 5_000, 0, 0), item(null, 4_000, 3_000, 0)]))
    expect(margens.map((m) => m.serviceId)).toEqual(['corte'])
  })

  describe('a parcela dominante só aparece quando a margem está baixa', () => {
    it('serviço saudável não ganha vilão — a tela cala', () => {
      const [m] = margemPorServico(tresVezes([item('corte', 10_000, 500, 1_000)]))
      expect(m!.margemBps).toBeGreaterThanOrEqual(PISO_DE_MARGEM_BPS)
      expect(m!.parcelaDominante, 'apontar culpado num serviço saudável fabrica um problema').toBeNull()
    })

    it('comissão alta é nomeada como comissão', () => {
      const [m] = margemPorServico(tresVezes([item('corte', 10_000, 500, 7_500)]))
      expect(m!.margemBps).toBeLessThan(PISO_DE_MARGEM_BPS)
      expect(m!.parcelaDominante).toBe('comissao')
    })

    it('produto caro é nomeado como material, e não como comissão', () => {
      const [m] = margemPorServico(tresVezes([item('coloracao', 18_000, 13_000, 1_000)]))
      expect(m!.parcelaDominante).toBe('material')
    })

    it('taxa dominante é nomeada como taxa', () => {
      const [m] = margemPorServico(tresVezes([item('corte', 10_000, 100, 100)], 0, 8_000))
      expect(m!.parcelaDominante).toBe('taxa')
    })
  })

  /**
   * O piso de honestidade. Uma coloração com desconto de amiga, sozinha, viraria "este serviço dá
   * 4% de margem" para sempre — e o dono tomaria decisão de preço em cima de uma visita.
   */
  it('serviço com menos atendimentos que o piso não aparece', () => {
    const poucas = [1, 2].map(() => ({ itens: [item('corte', 10_000, 9_000, 0)], discountCents: 0, feeCents: 0 }))
    expect(poucas).toHaveLength(MINIMO_DE_ATENDIMENTOS - 1)
    expect(margemPorServico(poucas), 'margem de duas visitas não é margem').toEqual([])
  })

  it('nenhuma comanda fechada devolve lista vazia, e não zeros', () => {
    expect(margemPorServico([])).toEqual([])
  })

  it('serviço 100% cortesia não vira margem infinita', () => {
    const [m] = margemPorServico(tresVezes([item('cortesia', 0, 500, 0)]))
    expect(m!.margemBps).toBe(0)
    expect(Number.isFinite(m!.margemBps)).toBe(true)
  })

  it('ordena do pior para o melhor — quem abre a tela quer ver o problema', () => {
    const comandas = [
      ...tresVezes([item('ruim', 10_000, 8_000, 1_000)]),
      ...tresVezes([item('bom', 10_000, 200, 0)]),
    ]
    expect(margemPorServico(comandas).map((m) => m.serviceId)).toEqual(['ruim', 'bom'])
  })

  it('margem negativa é resultado válido, e não some', () => {
    const [m] = margemPorServico(tresVezes([item('prejuizo', 5_000, 4_000, 3_000)]))
    expect(m!.lucroCents).toBeLessThan(0)
    expect(m!.margemBps).toBeLessThan(0)
  })
})
