import { describe, expect, it } from 'vitest'

import { CATALOGO } from '@/core/billing/planos'
import { modulosDesligadosNaEntrada } from '@/core/onboarding/modulos-de-entrada'

/**
 * docs/108: a conta nova da beleza feminina que trabalha sozinha nasce sem orçamento, estoque, campanhas,
 * clube e documentos. O dia dela (agenda, Motor, clientes, página, lembrete, caixa, anamnese) fica ligado.
 */
describe('módulos que a conta nova já começa desligados', () => {
  it.each(['lashes', 'brows', 'nails', 'waxing'])('%s começa enxuta', (slug) => {
    expect([...modulosDesligadosNaEntrada(slug)].sort()).toEqual(['campaigns', 'club', 'documents', 'quotes', 'stock', 'team'])
  })

  it.each(['barber', 'hair', 'aesthetics', 'tattoo', 'outra-profissao'])('%s não muda o começo', (slug) => {
    expect(modulosDesligadosNaEntrada(slug)).toEqual([])
  })

  it('sem profissão, nada é desligado', () => {
    expect(modulosDesligadosNaEntrada(null)).toEqual([])
    expect(modulosDesligadosNaEntrada(undefined)).toEqual([])
  })

  it('nunca desliga o que é o dia dela, nem o que o produto não deixa desligar', () => {
    const desligados = new Set(modulosDesligadosNaEntrada('lashes'))
    for (const essencial of ['agenda', 'cycle_engine', 'clients', 'public_page', 'reminders', 'register', 'health_records', 'recurrence'] as const) {
      expect(desligados.has(essencial), essencial).toBe(false)
    }
    for (const m of CATALOGO.filter((c) => c.sempreLigado)) expect(desligados.has(m.key), m.key).toBe(false)
  })

  it('todo módulo desligado existe no catálogo', () => {
    const chaves = new Set(CATALOGO.map((c) => c.key))
    for (const m of modulosDesligadosNaEntrada('nails')) expect(chaves.has(m), m).toBe(true)
  })
})
