import { describe, expect, it } from 'vitest'

import { addDays, diaDaSemana, diffDays, fmtDiaSemana, hojeNoFuso } from '@/core/advocacia/datas'

describe('hojeNoFuso: o dia do tenant, não o da máquina', () => {
  /*
   * Achado por mutação em 2026-10-08: tirar o `timeZone` de `hojeNoFuso` passava VERDE, porque a
   * máquina que roda os testes está em Brasília e o `Intl` sem fuso usa o da máquina. O mesmo
   * instante em DOIS fusos que caem em dias diferentes é o que pega o defeito em qualquer máquina:
   * sem o fuso, as duas respostas saem iguais e uma delas erra.
   */
  const instante = new Date('2026-10-05T16:00:00Z') // 13:00 em Brasília, 01:00 do dia 6 em Tóquio

  it('o mesmo instante dá dias diferentes em fusos diferentes', () => {
    expect(hojeNoFuso('America/Sao_Paulo', instante)).toBe('2026-10-05')
    expect(hojeNoFuso('Asia/Tokyo', instante)).toBe('2026-10-06')
  })

  it('às 23:30 de Brasília ainda é o mesmo dia, mesmo que em UTC já seja amanhã', () => {
    expect(hojeNoFuso('America/Sao_Paulo', new Date('2026-10-06T02:30:00Z'))).toBe('2026-10-05')
    expect(hojeNoFuso('UTC', new Date('2026-10-06T02:30:00Z'))).toBe('2026-10-06')
  })
})

describe('aritmética de dia civil', () => {
  it('soma e diferença atravessam fim de mês e de ano', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(diffDays('2026-02-27', '2026-03-02')).toBe(3)
  })

  it('domingo em que o horário de verão começaria não tem 23 horas aqui: é dia civil', () => {
    // A aritmética é em UTC sobre a data, então nenhum fuso muda o resultado.
    expect(addDays('2026-11-01', 1)).toBe('2026-11-02')
  })

  it('dia da semana e o rótulo da memória de cálculo', () => {
    expect(diaDaSemana('2026-10-08')).toBe(4)
    expect(fmtDiaSemana('2026-10-02')).toBe('sex 02/10')
  })
})
