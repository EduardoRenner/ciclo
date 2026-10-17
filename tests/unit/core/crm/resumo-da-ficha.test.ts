import { describe, expect, it } from 'vitest'

import { tilesDoResumo } from '@/core/crm/resumo-da-ficha'

import type { LucroDoCliente } from '@/core/crm/lucro-do-cliente'

const lucro = (parte: Partial<LucroDoCliente>): LucroDoCliente => ({
  lucroCents: 0,
  lucroPorVisitaCents: null,
  lucroAnualCents: null,
  visitasSemComanda: 0,
  cobertura: 'nenhuma',
  ...parte,
})

describe('resumo da ficha: número só aparece com dado (APR-115)', () => {
  it('pessoa nova: só "Visitas 0" — sem gasto médio, sem Sobrou, sem Faltas', () => {
    const tiles = tilesDoResumo({ visitas: 0, faltas: 0, ticketMedioCents: 0, lucro: lucro({}) })
    expect(tiles.map((t) => t.chave)).toEqual(['visitas'])
    expect(tiles[0]!.valor).toEqual({ tipo: 'contagem', n: 0 })
  })

  it('com visita e sem comanda fechada: Visitas e Gasto médio; "Sobrou" NÃO aparece como R$ 0,00', () => {
    const tiles = tilesDoResumo({ visitas: 3, faltas: 0, ticketMedioCents: 5_500, lucro: lucro({ visitasSemComanda: 3 }) })
    expect(tiles.map((t) => t.chave)).toEqual(['visitas', 'gasto'])
    expect(tiles[1]).toMatchObject({ rotulo: 'Gasto médio por visita', valor: { tipo: 'dinheiro', cents: 5_500 } })
  })

  it('"Sobrou" só com comanda fechada, e diz de quantas visitas é', () => {
    const parcial = tilesDoResumo({
      visitas: 4,
      faltas: 0,
      ticketMedioCents: 6_000,
      lucro: lucro({ lucroCents: 9_000, visitasSemComanda: 1, cobertura: 'parcial' }),
    })
    expect(parcial.find((t) => t.chave === 'sobrou')).toMatchObject({ valor: { cents: 9_000 }, apoio: 'de 3 de 4 visitas' })

    const completa = tilesDoResumo({ visitas: 4, faltas: 0, ticketMedioCents: 6_000, lucro: lucro({ lucroCents: 12_000, cobertura: 'completa' }) })
    expect(completa.find((t) => t.chave === 'sobrou')?.apoio).toBe('de todas as visitas')
  })

  it('"Faltas" só quando houve falta', () => {
    expect(tilesDoResumo({ visitas: 2, faltas: 0, ticketMedioCents: 100, lucro: null }).some((t) => t.chave === 'faltas')).toBe(false)
    expect(tilesDoResumo({ visitas: 2, faltas: 1, ticketMedioCents: 100, lucro: null }).find((t) => t.chave === 'faltas')?.valor).toEqual({ tipo: 'contagem', n: 1 })
  })

  it('quem não alcança o lucro (lucro null) nunca vê "Sobrou" nem "Lucro por ano"', () => {
    const tiles = tilesDoResumo({ visitas: 9, faltas: 2, ticketMedioCents: 7_000, lucro: null })
    expect(tiles.map((t) => t.chave)).toEqual(['visitas', 'gasto', 'faltas'])
  })

  it('"Lucro por ano" só com cadência medida', () => {
    const tiles = tilesDoResumo({ visitas: 9, faltas: 0, ticketMedioCents: 7_000, lucro: lucro({ lucroCents: 1, cobertura: 'completa', lucroAnualCents: 48_000 }) })
    expect(tiles.find((t) => t.chave === 'ano')).toMatchObject({ valor: { cents: 48_000 }, apoio: 'no ritmo de hoje' })
  })
})
