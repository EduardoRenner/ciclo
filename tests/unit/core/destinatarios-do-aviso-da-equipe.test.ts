import { describe, expect, it } from 'vitest'

import { destinatariosDoAvisoDaEquipe } from '@/core/mensageria/destinatarios-da-equipe'

/**
 * docs/112 EXP-A06 (achado D8 do `05-avisos.md`): o push de "Novo pedido de agendamento" ia para
 * TODOS os aparelhos do negócio. Com a visão restrita ligada, uma profissional via na tela
 * bloqueada o nome da cliente de outra. Quem precisa saber: quem administra e quem vai atender.
 */
const equipe = [
  { userId: 'dona', role: 'owner', active: true },
  { userId: 'gerente', role: 'manager', active: true },
  { userId: 'recepcao', role: 'reception', active: true },
  { userId: 'financeiro', role: 'finance', active: true },
  { userId: 'marina', role: 'professional', active: true },
  { userId: 'bia', role: 'professional', active: true },
  { userId: 'ex', role: 'manager', active: false },
] as const

describe('quem recebe o aviso da equipe', () => {
  it('pedido de agendamento: quem administra e a profissional do horário, mais ninguém', () => {
    expect([...destinatariosDoAvisoDaEquipe(equipe, 'marina')].sort()).toEqual(['dona', 'gerente', 'marina', 'recepcao'])
  })

  it('a outra profissional não recebe o nome da cliente de quem vai atender', () => {
    expect(destinatariosDoAvisoDaEquipe(equipe, 'marina').has('bia')).toBe(false)
  })

  it('aviso sem profissional (orçamento): só quem administra', () => {
    expect([...destinatariosDoAvisoDaEquipe(equipe, null)].sort()).toEqual(['dona', 'gerente', 'recepcao'])
  })

  it('quem saiu da equipe não recebe', () => {
    expect(destinatariosDoAvisoDaEquipe(equipe, null).has('ex')).toBe(false)
  })

  it('a dona sempre recebe, mesmo quando ela é a profissional do horário', () => {
    expect([...destinatariosDoAvisoDaEquipe([{ userId: 'dona', role: 'owner', active: true }], 'dona')]).toEqual(['dona'])
  })
})
