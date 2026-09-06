import { describe, expect, it } from 'vitest'

import { calcularTaxaDoMes, type TicketDoMesParaTaxa } from '@/core/caixa/taxa-por-forma'
import { TAXAS_ZERADAS, type TaxasDePagamento } from '@/core/comanda/taxa-de-pagamento'

const taxas: TaxasDePagamento = { cash: 0, pix: 0, debit: 150, credit: 349, other: 0 }

describe('calcularTaxaDoMes — quando o dono nunca respondeu', () => {
  it('não mostra bloco nenhum, mesmo com tickets no mês', () => {
    const tickets: TicketDoMesParaTaxa[] = [{ paymentMethod: 'credit', totalCents: 10_000, feeCents: 349 }]
    expect(calcularTaxaDoMes(tickets, TAXAS_ZERADAS, false)).toEqual({ respondida: false })
  })
})

describe('calcularTaxaDoMes — respondido, com movimento', () => {
  const tickets: TicketDoMesParaTaxa[] = [
    { paymentMethod: 'credit', totalCents: 10_000, feeCents: 349 },
    { paymentMethod: 'credit', totalCents: 20_000, feeCents: 698 },
    { paymentMethod: 'pix', totalCents: 5_000, feeCents: 0 },
    { paymentMethod: 'cash', totalCents: 3_000, feeCents: 0 },
  ]

  it('agrupa por forma, com o que já foi cobrado de verdade', () => {
    const r = calcularTaxaDoMes(tickets, taxas, true)
    if (!r.respondida) throw new Error('deveria ter respondido')

    const credito = r.porForma.find((l) => l.forma === 'credit')
    expect(credito).toEqual({ forma: 'credit', atendimentos: 2, totalCents: 30_000, feeCents: 1_047 })

    const pix = r.porForma.find((l) => l.forma === 'pix')
    expect(pix).toEqual({ forma: 'pix', atendimentos: 1, totalCents: 5_000, feeCents: 0 })
  })

  it('forma sem nenhum atendimento no mês não aparece na lista', () => {
    const r = calcularTaxaDoMes(tickets, taxas, true)
    if (!r.respondida) throw new Error('deveria ter respondido')
    expect(r.porForma.find((l) => l.forma === 'debit')).toBeUndefined()
    expect(r.porForma.find((l) => l.forma === 'other')).toBeUndefined()
  })

  it('o total de taxa é a soma do que já foi congelado, não um recálculo', () => {
    const r = calcularTaxaDoMes(tickets, taxas, true)
    if (!r.respondida) throw new Error('deveria ter respondido')
    expect(r.totalFeeCents).toBe(1_047)
    expect(r.volumeTotalCents).toBe(38_000)
  })

  /**
   * O coração do A-01: a contrafactual só aparece para formas que o salão JÁ usa. Propor "e se
   * fosse débito" para quem nunca passou um cartão de débito este mês é número de marketing, não
   * informação — a mesma régua do `docs/50` §5.6 contra prometer o que a conta de hoje não mostra.
   */
  it('a contrafactual só cobre as formas que o salão já usou este mês', () => {
    const r = calcularTaxaDoMes(tickets, taxas, true)
    if (!r.respondida) throw new Error('deveria ter respondido')
    const formasNaContrafactual = r.contrafactual.map((c) => c.forma).sort()
    expect(formasNaContrafactual).toEqual(['cash', 'credit', 'pix'])
    expect(r.contrafactual.find((c) => c.forma === 'debit')).toBeUndefined()
  })

  it('a contrafactual usa o percentual de HOJE sobre o volume total, não o percentual histórico', () => {
    const r = calcularTaxaDoMes(tickets, taxas, true)
    if (!r.respondida) throw new Error('deveria ter respondido')
    // volumeTotalCents = 38_000. Se tudo fosse crédito a 3,49%: 1.326,2 -> 1326
    const seFosseCredito = r.contrafactual.find((c) => c.forma === 'credit')
    expect(seFosseCredito?.feeCentsSeTudoFosseAssim).toBe(1_326)
    // Se tudo fosse Pix a 0%: zero
    const seFossePix = r.contrafactual.find((c) => c.forma === 'pix')
    expect(seFossePix?.feeCentsSeTudoFosseAssim).toBe(0)
  })
})

describe('calcularTaxaDoMes — respondido, sem nenhuma comanda no mês', () => {
  it('não inventa forma nenhuma: listas vazias, não um erro', () => {
    const r = calcularTaxaDoMes([], taxas, true)
    if (!r.respondida) throw new Error('deveria ter respondido')
    expect(r.porForma).toEqual([])
    expect(r.contrafactual).toEqual([])
    expect(r.totalFeeCents).toBe(0)
  })
})

describe('calcularTaxaDoMes — formas que não entram nesta conta', () => {
  it('club, package e voucher são ignorados: são dinheiro que já entrou por outro caminho', () => {
    const tickets: TicketDoMesParaTaxa[] = [
      { paymentMethod: 'club', totalCents: 5_000, feeCents: 0 },
      { paymentMethod: 'package', totalCents: 5_000, feeCents: 0 },
      { paymentMethod: 'voucher', totalCents: 5_000, feeCents: 0 },
      { paymentMethod: 'credit', totalCents: 10_000, feeCents: 349 },
    ]
    const r = calcularTaxaDoMes(tickets, taxas, true)
    if (!r.respondida) throw new Error('deveria ter respondido')
    expect(r.porForma).toHaveLength(1)
    expect(r.volumeTotalCents).toBe(10_000)
  })

  it('payment_method nulo (comanda antiga) não quebra e não entra em forma nenhuma', () => {
    const tickets: TicketDoMesParaTaxa[] = [{ paymentMethod: null, totalCents: 5_000, feeCents: 0 }]
    const r = calcularTaxaDoMes(tickets, taxas, true)
    if (!r.respondida) throw new Error('deveria ter respondido')
    expect(r.porForma).toEqual([])
  })
})
