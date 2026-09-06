import { describe, expect, it } from 'vitest'

import {
  algumaTaxaCobrada,
  calcularTaxaDaMaquininha,
  FORMAS_DE_PAGAMENTO,
  lerTaxasDePagamento,
  NOME_DA_FORMA,
  taxaEstaConfigurada,
  TAXAS_ZERADAS,
} from '@/core/comanda/taxa-de-pagamento'

describe('lerTaxasDePagamento', () => {
  it('sem settings, todas as formas voltam zeradas', () => {
    expect(lerTaxasDePagamento(null)).toEqual(TAXAS_ZERADAS)
    expect(lerTaxasDePagamento(undefined)).toEqual(TAXAS_ZERADAS)
    expect(lerTaxasDePagamento({})).toEqual(TAXAS_ZERADAS)
  })

  it('lê o que o dono gravou, forma por forma', () => {
    const taxas = lerTaxasDePagamento({ payment_fees_bps: { credit: 349, debit: 149, pix: 99, cash: 0, other: 500 } })
    expect(taxas).toEqual({ credit: 349, debit: 149, pix: 99, cash: 0, other: 500 })
  })

  it('forma ausente no jsonb não contamina as outras', () => {
    expect(lerTaxasDePagamento({ payment_fees_bps: { credit: 349 } })).toEqual({ ...TAXAS_ZERADAS, credit: 349 })
  })

  /**
   * A armadilha de `configuracoes-agenda.ts`, e aqui ela é pior: lá zero era um valor de fronteira,
   * aqui zero é o padrão. `Number(null)` é 0 — com coerção, um jsonb corrompido devolveria
   * "taxa zero" com a mesma cara de uma taxa zero de verdade, e ninguém veria diferença.
   */
  it('valor que não é número não vira zero por coerção — cai no padrão, que também é zero, mas pelo caminho certo', () => {
    const taxas = lerTaxasDePagamento({ payment_fees_bps: { credit: '349', debit: null, pix: true, cash: NaN, other: Infinity } })
    expect(taxas).toEqual(TAXAS_ZERADAS)
  })

  it('negativo e acima de 100% são contidos, não propagados', () => {
    expect(lerTaxasDePagamento({ payment_fees_bps: { credit: -50, debit: 99_999 } })).toMatchObject({ credit: 0, debit: 10_000 })
  })

  it('decimal é arredondado, porque bps é inteiro', () => {
    expect(lerTaxasDePagamento({ payment_fees_bps: { credit: 349.6 } }).credit).toBe(350)
  })

  it('payment_fees_bps que não é objeto não derruba a leitura', () => {
    expect(lerTaxasDePagamento({ payment_fees_bps: 'trezentos' })).toEqual(TAXAS_ZERADAS)
    expect(lerTaxasDePagamento({ payment_fees_bps: 7 })).toEqual(TAXAS_ZERADAS)
  })
})

describe('taxaEstaConfigurada — a diferença entre responder zero e nunca ter respondido', () => {
  it('sem a chave, a pergunta não foi feita', () => {
    expect(taxaEstaConfigurada({})).toBe(false)
    expect(taxaEstaConfigurada(null)).toBe(false)
  })

  it('com a chave gravada só de zeros, foi respondida — o salão só recebe dinheiro e Pix', () => {
    expect(taxaEstaConfigurada({ payment_fees_bps: { cash: 0, pix: 0, debit: 0, credit: 0, other: 0 } })).toBe(true)
    expect(algumaTaxaCobrada(lerTaxasDePagamento({ payment_fees_bps: { cash: 0 } }))).toBe(false)
  })

  it('chave presente mas não-objeto não conta como resposta', () => {
    expect(taxaEstaConfigurada({ payment_fees_bps: 'sim' })).toBe(false)
  })
})

describe('calcularTaxaDaMaquininha', () => {
  it('3,49% de R$ 100 é R$ 3,49', () => {
    expect(calcularTaxaDaMaquininha({ totalCents: 10_000, feeBps: 349 })).toBe(349)
  })

  it('arredonda uma vez, no fim', () => {
    // 4.567 × 3,49% = 159,388... centavos
    expect(calcularTaxaDaMaquininha({ totalCents: 4_567, feeBps: 349 })).toBe(159)
  })

  it('sem taxa configurada, não inventa nada', () => {
    expect(calcularTaxaDaMaquininha({ totalCents: 10_000, feeBps: 0 })).toBe(0)
  })

  it('comanda de zero não gera taxa negativa nem NaN', () => {
    expect(calcularTaxaDaMaquininha({ totalCents: 0, feeBps: 349 })).toBe(0)
    expect(calcularTaxaDaMaquininha({ totalCents: -100, feeBps: 349 })).toBe(0)
  })

  /**
   * A gorjeta passa na máquina junto com o serviço, então a máquina cobra sobre ela. E como a
   * gorjeta é 100% do profissional (F84), o salão paga taxa de um dinheiro que não fica com ele.
   * É a parte cara, e é a que sumiria se a base fosse o subtotal.
   */
  it('a base inclui a gorjeta, porque a maquininha não sabe o que é gorjeta', () => {
    const semGorjeta = calcularTaxaDaMaquininha({ totalCents: 10_000, feeBps: 349 })
    const comGorjeta = calcularTaxaDaMaquininha({ totalCents: 12_000, feeBps: 349 })
    expect(comGorjeta).toBeGreaterThan(semGorjeta)
    expect(comGorjeta).toBe(419)
  })
})

describe('as formas de pagamento oferecidas no fechamento', () => {
  it('são as cinco que alguém escolhe na hora — clube, pacote e voucher entraram por outro caminho', () => {
    expect([...FORMAS_DE_PAGAMENTO]).toEqual(['cash', 'pix', 'debit', 'credit', 'other'])
    expect(FORMAS_DE_PAGAMENTO).not.toContain('club')
    expect(FORMAS_DE_PAGAMENTO).not.toContain('package')
    expect(FORMAS_DE_PAGAMENTO).not.toContain('voucher')
  })

  it('toda forma tem nome em português para a tela', () => {
    for (const forma of FORMAS_DE_PAGAMENTO) {
      expect(NOME_DA_FORMA[forma], `forma ${forma} sem nome`).toBeTruthy()
      expect(NOME_DA_FORMA[forma]).not.toBe(forma)
    }
  })
})
