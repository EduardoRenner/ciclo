import { Temporal } from '@js-temporal/polyfill'
import { describe, expect, it } from 'vitest'

import { atribuirReceita } from '@/core/attribution/compute'

const instante = (iso: string) => Temporal.Instant.from(iso)

describe('atribuirReceita', () => {
  it('agendamento criado depois da campanha, dentro da janela, é atribuído', () => {
    const resultado = atribuirReceita(
      [{ clientId: 'c1', sentAt: instante('2026-08-01T10:00:00Z') }],
      [{ id: 'a1', clientId: 'c1', createdAt: instante('2026-08-05T10:00:00Z'), valueCents: 8_000 }],
    )
    expect(resultado).toEqual([{ appointmentId: 'a1', clientId: 'c1', valueCents: 8_000, campaignSentAt: instante('2026-08-01T10:00:00Z') }])
  })

  it('agendamento criado ANTES da campanha não é atribuído (não pode ser efeito de algo que ainda não aconteceu)', () => {
    const resultado = atribuirReceita(
      [{ clientId: 'c1', sentAt: instante('2026-08-10T10:00:00Z') }],
      [{ id: 'a1', clientId: 'c1', createdAt: instante('2026-08-05T10:00:00Z'), valueCents: 8_000 }],
    )
    expect(resultado).toEqual([])
  })

  it('agendamento fora da janela de 30 dias não é atribuído', () => {
    const resultado = atribuirReceita(
      [{ clientId: 'c1', sentAt: instante('2026-08-01T10:00:00Z') }],
      [{ id: 'a1', clientId: 'c1', createdAt: instante('2026-09-05T10:00:00Z'), valueCents: 8_000 }],
    )
    expect(resultado).toEqual([])
  })

  it('exatamente 30 dias depois ainda conta (janela inclusiva no limite)', () => {
    const resultado = atribuirReceita(
      [{ clientId: 'c1', sentAt: instante('2026-08-01T10:00:00Z') }],
      [{ id: 'a1', clientId: 'c1', createdAt: instante('2026-08-31T10:00:00Z'), valueCents: 8_000 }],
    )
    expect(resultado).toHaveLength(1)
  })

  it('cliente que recebe 2 campanhas mas agenda 1 vez só: só a primeira campanha reivindica, receita não duplica', () => {
    const resultado = atribuirReceita(
      [
        { clientId: 'c1', sentAt: instante('2026-08-01T10:00:00Z') },
        { clientId: 'c1', sentAt: instante('2026-08-03T10:00:00Z') },
      ],
      [{ id: 'a1', clientId: 'c1', createdAt: instante('2026-08-05T10:00:00Z'), valueCents: 8_000 }],
    )
    expect(resultado).toHaveLength(1)
    expect(resultado[0]!.campaignSentAt).toEqual(instante('2026-08-01T10:00:00Z'))
  })

  it('2 campanhas e 2 agendamentos: cada campanha reivindica o seu, nenhum fica sem par por engano', () => {
    const resultado = atribuirReceita(
      [
        { clientId: 'c1', sentAt: instante('2026-08-01T10:00:00Z') },
        { clientId: 'c1', sentAt: instante('2026-08-10T10:00:00Z') },
      ],
      [
        { id: 'a1', clientId: 'c1', createdAt: instante('2026-08-05T10:00:00Z'), valueCents: 5_000 },
        { id: 'a2', clientId: 'c1', createdAt: instante('2026-08-15T10:00:00Z'), valueCents: 7_000 },
      ],
    )
    expect(resultado).toHaveLength(2)
    expect(resultado.map((r) => r.appointmentId).sort()).toEqual(['a1', 'a2'])
  })

  it('campanha de outro cliente nunca reivindica agendamento de quem não a recebeu', () => {
    const resultado = atribuirReceita(
      [{ clientId: 'outro-cliente', sentAt: instante('2026-08-01T10:00:00Z') }],
      [{ id: 'a1', clientId: 'c1', createdAt: instante('2026-08-05T10:00:00Z'), valueCents: 8_000 }],
    )
    expect(resultado).toEqual([])
  })

  it('sem campanha nenhuma, nada é atribuído', () => {
    expect(atribuirReceita([], [{ id: 'a1', clientId: 'c1', createdAt: instante('2026-08-05T10:00:00Z'), valueCents: 8_000 }])).toEqual([])
  })
})
