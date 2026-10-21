import { describe, expect, it } from 'vitest'

import { avisoDeCancelamentoPelaCliente } from '@/core/mensageria/aviso-de-cancelamento'

/** docs/112 EXP-A03: o aviso que a equipe recebe quando a cliente cancela pelo link. */
describe('aviso de cancelamento pela cliente', () => {
  it('diz quem cancelou, quando era (no fuso do negócio) e que a vaga ficou livre', () => {
    // 17:30 UTC numa quinta = 14:30 em São Paulo (sem horário de verão em 2026).
    const aviso = avisoDeCancelamentoPelaCliente({
      nomeDaCliente: 'Isadora Campos',
      startsAt: '2026-10-22T17:30:00Z',
      timezone: 'America/Sao_Paulo',
    })
    expect(aviso.title).toBe('Horário cancelado')
    expect(aviso.body).toBe('Isadora Campos cancelou o horário de quinta, 14:30. A vaga ficou livre para outra pessoa.')
  })

  it('sem o nome, não sai "null cancelou"', () => {
    const aviso = avisoDeCancelamentoPelaCliente({ nomeDaCliente: null, startsAt: '2026-10-22T17:30:00Z', timezone: 'America/Sao_Paulo' })
    expect(aviso.body.startsWith('Quem tinha marcado cancelou')).toBe(true)
  })
})
