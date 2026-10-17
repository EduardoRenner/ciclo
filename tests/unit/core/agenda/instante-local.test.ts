import { describe, expect, it } from 'vitest'

import { paraInstante, paraLocal } from '@/core/agenda/instante-local'

describe('data local do negócio ↔ instante (APR-201)', () => {
  it('14:00 em São Paulo é 17:00Z; 14:00 em Manaus é 18:00Z — o fuso é o do NEGÓCIO, não o do aparelho', () => {
    expect(paraInstante('2026-10-20T14:00', 'America/Sao_Paulo')).toBe('2026-10-20T17:00:00.000Z')
    expect(paraInstante('2026-10-20T14:00', 'America/Manaus')).toBe('2026-10-20T18:00:00.000Z')
    expect(paraInstante('2026-10-20T14:00', 'UTC')).toBe('2026-10-20T14:00:00.000Z')
  })

  it('ida e volta fecha, inclusive do lado de lá da meia-noite', () => {
    const iso = paraInstante('2026-01-05T23:30', 'America/Sao_Paulo')
    expect(iso).toBe('2026-01-06T02:30:00.000Z')
    expect(paraLocal(iso, 'America/Sao_Paulo')).toBe('2026-01-05T23:30')
    expect(paraLocal(iso, 'America/Manaus')).toBe('2026-01-05T22:30')
  })

  it('fuso com horário de verão: a hora que existe vale, a que não existe cai na seguinte', () => {
    // Nova York, 8 de março de 2026: 02:00 → 03:00. 02:30 não existe.
    expect(paraInstante('2026-03-08T01:30', 'America/New_York')).toBe('2026-03-08T06:30:00.000Z')
    expect(paraInstante('2026-03-08T03:30', 'America/New_York')).toBe('2026-03-08T07:30:00.000Z')
    const inexistente = paraInstante('2026-03-08T02:30', 'America/New_York')
    expect(['2026-03-08T07:30:00.000Z', '2026-03-08T06:30:00.000Z']).toContain(inexistente)
  })

  it('entrada que não é data local reclama em vez de inventar', () => {
    expect(() => paraInstante('amanhã', 'America/Sao_Paulo')).toThrow()
  })
})
