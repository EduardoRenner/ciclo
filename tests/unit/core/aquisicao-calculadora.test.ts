import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { LIMITES, calcularParado } from '@/core/aquisicao/calculadora'

describe('calcularParado (docs/82 §8)', () => {
  it('8 clientes, R$ 35, voltando a cada 30 dias', () => {
    // 365 ÷ 30 = 12,17 visitas/ano · R$ 35 × 12,17 = R$ 425,83 → R$ 426 por cliente · × 8 = R$ 3.408
    expect(calcularParado({ clientesSumidos: 8, ticketCents: 3500, retornoDias: 30 })).toEqual({
      visitasPorAno: 12.2,
      valorPorClientePorAnoCents: 42600,
      paradoPorAnoCents: 340800,
      paradoPorMesCents: 28400,
    })
  })

  it('ritmo mais curto vale mais: o mesmo cliente a cada 15 dias vale o dobro do de 30', () => {
    // R$ 42 × 365 é divisível por 30: a conta fecha sem arredondamento e o dobro é exato.
    const a30 = calcularParado({ clientesSumidos: 1, ticketCents: 4200, retornoDias: 30 })!
    const a15 = calcularParado({ clientesSumidos: 1, ticketCents: 4200, retornoDias: 15 })!
    expect(a15.paradoPorAnoCents).toBe(a30.paradoPorAnoCents * 2)
  })

  it('a conta aberta na tela fecha EXATA: valor por cliente (em reais inteiros) × clientes = total', () => {
    // Medido no navegador: "R$ 426 por ano. Vezes 8" em cima de "R$ 3.407" — quem confere acha.
    const casos: Array<[number, number, number]> = [[8, 3500, 30], [37, 8990, 21], [3, 12000, 45], [120, 2500, 15]]
    for (const [n, ticket, dias] of casos) {
      const r = calcularParado({ clientesSumidos: n, ticketCents: ticket, retornoDias: dias })!
      expect(r.valorPorClientePorAnoCents % 100, 'a parcela mostrada é em reais inteiros').toBe(0)
      expect(r.paradoPorAnoCents).toBe(r.valorPorClientePorAnoCents * n)
    }
  })

  it.each([
    ['zero clientes', { clientesSumidos: 0, ticketCents: 3500, retornoDias: 30 }],
    ['ticket zerado', { clientesSumidos: 5, ticketCents: 0, retornoDias: 30 }],
    ['retorno zero (365 ÷ 0)', { clientesSumidos: 5, ticketCents: 3500, retornoDias: 0 }],
    ['retorno de um ano inteiro', { clientesSumidos: 5, ticketCents: 3500, retornoDias: 365 }],
    ['clientes demais para "os que você lembra"', { clientesSumidos: 5000, ticketCents: 3500, retornoDias: 30 }],
    ['número quebrado', { clientesSumidos: 2.5, ticketCents: 3500, retornoDias: 30 }],
  ])('fora da faixa (%s) não vira número na tela', (_nome, entrada) => {
    expect(calcularParado(entrada)).toBeNull()
  })
})

describe('toda entrada que calcularParado recusa tem frase na tela (revisão 2026-09-23)', () => {
  it('ticket de tatuagem (R$ 1.500) entra na conta', () => {
    expect(calcularParado({ clientesSumidos: 3, ticketCents: 150_000, retornoDias: 60 })).not.toBeNull()
  })

  it('a tela tem um ramo de erro para o mínimo E o máximo de cada limite', () => {
    const tela = readFileSync(join(__dirname, '..', '..', '..', 'src/app/(public)/calculadora/calculadora.tsx'), 'utf8')
    for (const campo of Object.keys(LIMITES)) {
      expect(tela, `falta erro de mínimo para ${campo}`).toContain(`LIMITES.${campo}.min`)
      expect(tela, `falta erro de máximo para ${campo}`).toContain(`LIMITES.${campo}.max`)
    }
  })
})

