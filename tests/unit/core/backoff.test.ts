import { describe, expect, it } from 'vitest'

import { backoffMinutos, decidirDesfecho } from '@/core/jobs/backoff'

describe('backoffMinutos', () => {
  it('dobra a cada tentativa: 1, 2, 4, 8, 16...', () => {
    expect([0, 1, 2, 3, 4].map(backoffMinutos)).toEqual([1, 2, 4, 8, 16])
  })

  it('trava no teto de 60min — não cresce para sempre', () => {
    expect(backoffMinutos(10)).toBe(60)
    expect(backoffMinutos(30)).toBe(60)
  })
})

describe('decidirDesfecho', () => {
  it('falha 5× (max_attempts padrão) vai para dead na última', () => {
    // attempts é o valor ANTES da falha atual — a 5ª falha acontece com attempts=4.
    expect(decidirDesfecho(0, 5)).toBe('failed')
    expect(decidirDesfecho(1, 5)).toBe('failed')
    expect(decidirDesfecho(2, 5)).toBe('failed')
    expect(decidirDesfecho(3, 5)).toBe('failed')
    expect(decidirDesfecho(4, 5)).toBe('dead')
  })

  it('respeita max_attempts customizado, não um número fixo', () => {
    expect(decidirDesfecho(0, 1)).toBe('dead')
    expect(decidirDesfecho(1, 2)).toBe('dead')
  })
})
