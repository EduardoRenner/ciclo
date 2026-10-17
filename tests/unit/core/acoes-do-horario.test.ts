import { describe, expect, it } from 'vitest'

import { acoesDoHorario } from '@/core/scheduling/acoes-do-horario'
import { proximosEstados, type EstadoAgendamento } from '@/core/scheduling/state'

/** APR-105: um primário por estado, a próxima ação do caminho feliz. */
describe('estado → ação primária do detalhe do horário (APR-105)', () => {
  it('cada estado com ação tem exatamente UM primário, e é o próximo passo do atendimento', () => {
    expect(acoesDoHorario('pending')).toMatchObject({ principal: 'confirmed', podeCancelar: true })
    expect(acoesDoHorario('confirmed')).toMatchObject({ principal: 'arrived', secundarias: ['no_show'], podeCancelar: true })
    expect(acoesDoHorario('arrived')).toMatchObject({ principal: 'done', secundarias: [], podeCancelar: false })
  })

  it('"Marcar falta" nunca é primária (o sistema sugere, o profissional marca)', () => {
    for (const e of ['pending', 'confirmed', 'arrived', 'done', 'no_show', 'canceled', 'expired'] as EstadoAgendamento[]) {
      expect(acoesDoHorario(e).principal).not.toBe('no_show')
    }
  })

  it('estado final não tem ação', () => {
    for (const e of ['done', 'no_show', 'canceled', 'expired'] as EstadoAgendamento[]) {
      expect(acoesDoHorario(e)).toEqual({ principal: null, secundarias: [], podeCancelar: false })
    }
  })

  it('controle: o jeito antigo (toda transição com rótulo vira botão primário) dava 2 primários no confirmado', () => {
    const antigo = proximosEstados('confirmed').filter((e) => ['confirmed', 'arrived', 'done', 'no_show'].includes(e))
    expect(antigo.length).toBe(2)
  })
})
