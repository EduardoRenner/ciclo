import { describe, expect, it } from 'vitest'

import { separarFilaPorDono } from '@/core/offline/dono'

const ANA = { userId: 'u-ana', tenantId: 't-1' }
const BIA = { userId: 'u-bia', tenantId: 't-1' }

describe('separarFilaPorDono (APR-020)', () => {
  it('fila com dois donos: só a da sessão atual drena', () => {
    const fila = [
      { id: '1', dono: ANA },
      { id: '2', dono: BIA },
      { id: '3', dono: ANA },
    ]
    const s = separarFilaPorDono(fila, ANA)
    expect(s.minhas.map((m) => m.id)).toEqual(['1', '3'])
    expect(s.deOutros.map((m) => m.id)).toEqual(['2'])
    expect(s.semDono).toEqual([])
  })

  it('mesma pessoa em OUTRO negócio não é "minha" aqui', () => {
    const s = separarFilaPorDono([{ id: '1', dono: { userId: 'u-ana', tenantId: 't-2' } }], ANA)
    expect(s.minhas).toEqual([])
    expect(s.deOutros).toHaveLength(1)
  })

  it('item do formato antigo (sem dono) não sai sem confirmação, e não some', () => {
    const s = separarFilaPorDono([{ id: 'velho' }, { id: 'nulo', dono: null }], ANA)
    expect(s.minhas).toEqual([])
    expect(s.semDono.map((m) => m.id)).toEqual(['velho', 'nulo'])
  })
})
