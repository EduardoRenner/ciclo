import { describe, expect, it } from 'vitest'

import { diaMaisOcioso, streakDeSemanasVazias, type Weekday } from '@/core/agenda/ociosidade'

describe('streakDeSemanasVazias', () => {
  it('conta a partir da mais recente, e para na primeira ocupada', () => {
    expect(streakDeSemanasVazias([false, false, false])).toBe(3)
    expect(streakDeSemanasVazias([false, false, true, false])).toBe(2)
    expect(streakDeSemanasVazias([true, false, false])).toBe(0)
  })

  it('lista vazia não tem streak nenhum', () => {
    expect(streakDeSemanasVazias([])).toBe(0)
  })
})

describe('diaMaisOcioso', () => {
  it('sem nenhum dia qualificado, devolve null — nunca fabrica vilão', () => {
    const porWeekday = new Map<Weekday, boolean[]>([
      [2, [true, true, true, true]],
      [4, [true, false, true, true]],
    ])
    expect(diaMaisOcioso(porWeekday)).toBeNull()
  })

  it('menos que o mínimo de semanas observadas não qualifica, mesmo 100% vazio', () => {
    const porWeekday = new Map<Weekday, boolean[]>([[2, [false, false, false]]])
    expect(diaMaisOcioso(porWeekday)).toBeNull()
  })

  it('streak abaixo do mínimo não qualifica, mesmo com bastante histórico', () => {
    const porWeekday = new Map<Weekday, boolean[]>([[2, [false, false, true, true, true, true, true, true]]])
    expect(diaMaisOcioso(porWeekday)).toBeNull()
  })

  it('um dia qualificado vence sozinho', () => {
    const porWeekday = new Map<Weekday, boolean[]>([
      [2, [false, false, false, false, true, true]],
      [4, [true, true, true, true]],
    ])
    expect(diaMaisOcioso(porWeekday)).toEqual({ weekday: 2, semanasSeguidasVazias: 4, semanasObservadas: 6 })
  })

  it('entre dois qualificados, vence o streak mais longo — não o mais observado', () => {
    const porWeekday = new Map<Weekday, boolean[]>([
      // terça: streak 3, mas 10 semanas de histórico
      [2, [false, false, false, true, true, true, true, true, true, true]],
      // quinta: streak 5, só 5 semanas de histórico
      [4, [false, false, false, false, false]],
    ])
    expect(diaMaisOcioso(porWeekday)).toEqual({ weekday: 4, semanasSeguidasVazias: 5, semanasObservadas: 5 })
  })

  it('mapa vazio devolve null', () => {
    expect(diaMaisOcioso(new Map())).toBeNull()
  })
})
