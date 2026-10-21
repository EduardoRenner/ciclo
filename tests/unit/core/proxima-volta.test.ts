import { describe, expect, it } from 'vitest'

import { proximaVolta } from '@/core/ciclo/proxima-volta'

/**
 * docs/114 L-05: depois do atendimento, quem foi atendido vê "por volta de {dia}" com "Marcar agora".
 * O dia é o que o Motor previu para essa pessoa e esse serviço; sem previsão, o último atendimento
 * mais o ritmo do serviço. Nunca no passado (quem já passou do dia marca a partir de amanhã), e
 * serviço sem volta (ritmo de 180 dias ou mais, como a remoção) não sugere nada.
 */
describe('proximaVolta', () => {
  const hoje = '2026-10-21'

  it('usa o dia que o Motor previu', () => {
    expect(proximaVolta({ previsto: '2026-11-11', ultimaVisita: '2026-10-21', ritmoDias: 21, hoje })).toBe('2026-11-11')
  })

  it('sem previsão, o último atendimento mais o ritmo do serviço', () => {
    expect(proximaVolta({ previsto: null, ultimaVisita: '2026-10-21', ritmoDias: 21, hoje })).toBe('2026-11-11')
  })

  it('dia já passado vira amanhã', () => {
    expect(proximaVolta({ previsto: '2026-10-01', ultimaVisita: '2026-09-10', ritmoDias: 21, hoje })).toBe('2026-10-22')
  })

  it('serviço sem volta não sugere dia', () => {
    expect(proximaVolta({ previsto: null, ultimaVisita: '2026-10-21', ritmoDias: 365, hoje })).toBeNull()
    expect(proximaVolta({ previsto: '2027-10-21', ultimaVisita: '2026-10-21', ritmoDias: 365, hoje })).toBeNull()
    expect(proximaVolta({ previsto: null, ultimaVisita: '2026-10-21', ritmoDias: 0, hoje })).toBeNull()
  })
})
