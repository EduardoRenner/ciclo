import { describe, expect, it } from 'vitest'

import { deveMostrarHeroiDoMotor } from '@/app/admin/hoje/hoje'

/**
 * F1 (`docs/25-ESTRATEGIA-E-EXECUCAO.md`): em dia sem movimento, a home mostra o que o Motor de
 * Ciclo trouxe este mês em vez de "Faturado hoje · R$ 0,00" — mas só quando há algo de verdade
 * pra mostrar no lugar. Sem harness de render de componente neste projeto, testa a decisão pura.
 */
describe('deveMostrarHeroiDoMotor', () => {
  it('dia parado e o Motor já trouxe alguém de volta este mês: mostra o herói do Motor', () => {
    expect(deveMostrarHeroiDoMotor(0, false, 3)).toBe(true)
  })

  it('dia parado mas o Motor não trouxe nada ainda: mantém o Faturado hoje (nada pra mostrar no lugar)', () => {
    expect(deveMostrarHeroiDoMotor(0, false, 0)).toBe(false)
  })

  it('já faturou algo hoje: mantém o Faturado hoje, mesmo com atribuição no mês', () => {
    expect(deveMostrarHeroiDoMotor(5_000, false, 3)).toBe(false)
  })

  it('tem próximo cliente marcado: mantém o Faturado hoje, mesmo sem faturamento ainda', () => {
    expect(deveMostrarHeroiDoMotor(0, true, 3)).toBe(false)
  })

  it('dia cheio de movimento: mantém o Faturado hoje', () => {
    expect(deveMostrarHeroiDoMotor(12_000, true, 5)).toBe(false)
  })
})
