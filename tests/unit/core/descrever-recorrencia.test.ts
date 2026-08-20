import { describe, expect, it } from 'vitest'

import { descreverRegra } from '@/core/recurrence/descrever'

describe('descreverRegra', () => {
  it('semanal, toda semana', () => {
    expect(descreverRegra({ tipo: 'semanal', weekday: 2, intervaloSemanas: 1 })).toBe('Terça-feira, toda semana')
  })

  it('semanal, a cada N semanas', () => {
    expect(descreverRegra({ tipo: 'semanal', weekday: 1, intervaloSemanas: 2 })).toBe('Segunda-feira, a cada 2 semanas')
  })

  it('sábado e domingo não quebram concordância de gênero (nenhum "todo"/"toda" antes do dia)', () => {
    expect(descreverRegra({ tipo: 'semanal', weekday: 6, intervaloSemanas: 1 })).toBe('Sábado, toda semana')
    expect(descreverRegra({ tipo: 'semanal', weekday: 0, intervaloSemanas: 1 })).toBe('Domingo, toda semana')
  })

  it('a cada X dias', () => {
    expect(descreverRegra({ tipo: 'a_cada_dias', intervaloDias: 15 })).toBe('A cada 15 dias')
  })

  it('mensal por posição no mês', () => {
    expect(descreverRegra({ tipo: 'mensal_dia_semana', weekday: 1, ordinal: 1 })).toBe('Segunda-feira, 1ª do mês')
  })

  it('ordinal 5 é "última do mês", não "5ª" — exista ou não a 5ª ocorrência real', () => {
    expect(descreverRegra({ tipo: 'mensal_dia_semana', weekday: 5, ordinal: 5 })).toBe('Sexta-feira, última do mês')
  })
})
