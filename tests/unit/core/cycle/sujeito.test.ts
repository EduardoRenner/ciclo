import { Temporal } from '@js-temporal/polyfill'
import { describe, expect, it } from 'vitest'

import { O_PROPRIO_CLIENTE, agruparPorSujeito } from '@/core/cycle/sujeito'

const d = (s: string) => Temporal.PlainDate.from(s)

describe('agruparPorSujeito (C-003)', () => {
  it('beleza: sem sujeito, tudo é o próprio cliente, numa série só', () => {
    const g = agruparPorSujeito([{ date: d('2026-01-01') }, { date: d('2026-01-22'), sujeito: null }])
    expect([...g.keys()]).toEqual([O_PROPRIO_CLIENTE])
    expect(g.get(O_PROPRIO_CLIENTE)).toHaveLength(2)
  })

  it('pet: dois animais viram duas séries, cada uma em ordem', () => {
    const g = agruparPorSujeito([
      { date: d('2026-01-15'), sujeito: 'rex' },
      { date: d('2026-01-08'), sujeito: 'mel' },
      { date: d('2026-01-01'), sujeito: 'rex' },
      { date: d('2026-01-22'), sujeito: 'mel' },
    ])
    expect(g.get('rex')!.map(String)).toEqual(['2026-01-01', '2026-01-15'])
    expect(g.get('mel')!.map(String)).toEqual(['2026-01-08', '2026-01-22'])
  })
})
