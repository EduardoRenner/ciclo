import { describe, expect, it } from 'vitest'

import { diasDesde } from '@/core/tempo/dia'

describe('diasDesde', () => {
  it('conta dias inteiros completos, sem arredondar para cima', () => {
    const agora = new Date('2026-08-31T10:00:00Z')
    // 23h de diferença: ainda não completou 1 dia inteiro.
    expect(diasDesde('2026-08-30T11:00:00Z', agora)).toBe(0)
    // 25h de diferença: 1 dia completo.
    expect(diasDesde('2026-08-30T09:00:00Z', agora)).toBe(1)
  })

  it('24 dias exatos bate com o que personal_cycle_days mediria', () => {
    const agora = new Date('2026-08-31T10:00:00Z')
    expect(diasDesde('2026-08-07T10:00:00Z', agora)).toBe(24)
  })

  it('nunca devolve negativo, mesmo com data futura', () => {
    const agora = new Date('2026-08-31T10:00:00Z')
    expect(diasDesde('2026-09-01T10:00:00Z', agora)).toBe(0)
  })
})
