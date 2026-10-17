import { describe, expect, it } from 'vitest'

import { diaPorExtensoNoFuso } from '@/core/agenda/resumo-do-horario'

describe('dia por extenso tirado do próprio horário (APR-003)', () => {
  it('23:30 UTC ainda é o mesmo dia em São Paulo, não o dia seguinte', () => {
    // 2026-10-15T23:30Z = quinta 15/10 às 20:30 em Brasília
    expect(diaPorExtensoNoFuso('2026-10-15T23:30:00Z', 'America/Sao_Paulo')).toBe('quinta-feira, 15 de outubro')
  })

  it('02:00 UTC é o dia ANTERIOR em São Paulo', () => {
    // 2026-10-16T02:00Z = quinta 15/10 às 23:00 em Brasília
    expect(diaPorExtensoNoFuso('2026-10-16T02:00:00Z', 'America/Sao_Paulo')).toBe('quinta-feira, 15 de outubro')
  })

  it('o resultado depende só do horário e do fuso: outro fuso, outro dia', () => {
    expect(diaPorExtensoNoFuso('2026-10-16T02:00:00Z', 'Asia/Tokyo')).toBe('sexta-feira, 16 de outubro')
  })
})
