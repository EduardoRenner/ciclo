import { describe, expect, it } from 'vitest'

import { aindaContaComoReceita } from '@/core/agenda/ainda-conta-como-receita'

/**
 * O defeito medido em produção: 19 agendamentos `pending` cuja hora já tinha passado somavam no
 * "previsto" do dia. O estado `expired`, que o filtro dizia excluir, nunca foi alcançado por nada
 * — zero linhas na história inteira do banco.
 */
const AGORA = new Date('2026-09-03T18:00:00Z')
const PASSADO = '2026-09-03T12:00:00Z'
const FUTURO = '2026-09-03T21:00:00Z'

describe('aindaContaComoReceita', () => {
  it('pending cuja hora já passou NÃO conta — ninguém confirmou e o horário foi embora', () => {
    expect(aindaContaComoReceita({ status: 'pending', endsAt: PASSADO }, AGORA)).toBe(false)
  })

  it('pending ainda por vir conta — o pedido continua de pé', () => {
    expect(aindaContaComoReceita({ status: 'pending', endsAt: FUTURO }, AGORA)).toBe(true)
  })

  it.each(['confirmed', 'arrived', 'done'])('%s conta mesmo com a hora passada — houve decisão humana', (status) => {
    expect(aindaContaComoReceita({ status, endsAt: PASSADO }, AGORA)).toBe(true)
  })

  it.each(['canceled', 'no_show', 'expired'])('%s nunca conta', (status) => {
    expect(aindaContaComoReceita({ status, endsAt: FUTURO }, AGORA)).toBe(false)
  })

  it('a virada é exatamente o fim do horário, não o começo', () => {
    const fim = '2026-09-03T18:00:00Z'
    // Terminando AGORA ainda não venceu: o atendimento pode estar acontecendo neste segundo.
    expect(aindaContaComoReceita({ status: 'pending', endsAt: fim }, new Date('2026-09-03T17:59:59Z'))).toBe(true)
    expect(aindaContaComoReceita({ status: 'pending', endsAt: fim }, new Date('2026-09-03T18:00:01Z'))).toBe(false)
  })
})
