import { describe, expect, it } from 'vitest'

import { fraseDaMargem } from '@/core/caixa/frase-da-margem'
import { margemPorServico } from '@/core/caixa/margem-do-servico'

/**
 * A guarda desta frase é sobre o que ela NÃO pode dizer. O `CLAUDE.md` veta precificação
 * automática, e o `docs/50` §5.2 repete: nomear a alavanca é observação, puxá-la é decisão do dono.
 * Um texto que fica "mais útil" atravessa essa linha sem que ninguém perceba.
 */

const tresVezes = (serviceId: string, totalCents: number, costCents: number, commissionCents: number, feeCents = 0) =>
  [1, 2, 3].map(() => ({ itens: [{ serviceId, totalCents, costCents, commissionCents }], discountCents: 0, feeCents }))

const frasePara = (...args: Parameters<typeof tresVezes>) => fraseDaMargem(margemPorServico(tresVezes(...args))[0]!)

describe('fraseDaMargem — nomeia a alavanca, nunca a puxa', () => {
  it('comissão dominante vira a fatia da comissão sobre o faturamento', () => {
    // Comissão de 70%: sobra 25% e o piso de 30% é cruzado. Com 60% de comissão sobrariam 35% —
    // serviço saudável, e a função calaria, que é o caso do teste logo abaixo.
    expect(frasePara('corte', 10_000, 500, 7_000)).toBe('A comissão leva 70% do que este serviço fatura.')
  })

  it('produto dominante fala de produto', () => {
    expect(frasePara('coloracao', 18_000, 13_000, 1_000)).toBe('O produto leva 72% do que este serviço fatura.')
  })

  it('taxa dominante fala da maquininha', () => {
    expect(frasePara('corte', 10_000, 100, 100, 8_000)).toBe('A taxa da maquininha leva 80% do que este serviço fatura.')
  })

  it('serviço saudável não ganha frase nenhuma', () => {
    expect(frasePara('corte', 10_000, 500, 1_000)).toBeNull()
  })

  /**
   * O caso que separa observação de conselho, e a razão de a fatia ser sobre a RECEITA: num serviço
   * no vermelho, "leva 180% do que sobra" é aritmeticamente certo e inútil. O dono precisa da fatia
   * do bolo, não da fatia do que sobrou dele.
   */
  it('serviço no vermelho não produz percentual absurdo', () => {
    const frase = frasePara('prejuizo', 5_000, 4_000, 3_000)!
    const pct = Number(/(\d+)%/.exec(frase)![1])
    expect(pct).toBeLessThanOrEqual(100)
    expect(pct).toBeGreaterThan(0)
  })

  it.each([
    ['corte', 10_000, 500, 7_000, 0],
    ['coloracao', 18_000, 13_000, 1_000, 0],
    ['corte', 10_000, 100, 100, 8_000],
  ] as const)('nunca sugere preço, desconto nem mudança de comissão (%s)', (id, total, custo, comissao, taxa) => {
    const frase = frasePara(id, total, custo, comissao, taxa)!
    const proibidos = /\b(suba|aumente|cobre|reduza|diminua|baixe|renegocie|deveria|recomend|sugerimos|ideal)\w*/i
    expect(frase, `a frase virou conselho: "${frase}"`).not.toMatch(proibidos)
    expect(frase, 'a frase passou a citar um preço').not.toMatch(/R\$/)
  })
})
