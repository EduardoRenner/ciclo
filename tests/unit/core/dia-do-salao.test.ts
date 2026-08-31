import { describe, expect, it } from 'vitest'

import { diaDaquiA, diaNoFuso } from '@/core/tempo/dia'

/**
 * `new Date().toISOString().slice(0, 10)` e "hoje em UTC", nao hoje no salao. Em Brasilia (UTC-3)
 * devolve o dia SEGUINTE das 21h a meia-noite, e o projeto ja pagou por isso uma vez — o
 * comentario em `admin/agenda/page.tsx` conta: "o dono fechava a barbearia as 21h30, abria a agenda
 * e via amanha. Tres horas erradas por noite, todas as noites."
 */
const NOITE_DE_BRASILIA = new Date('2026-08-31T23:30:00-03:00')
const SP = 'America/Sao_Paulo'

describe('o dia e o do salao, nao o do servidor', () => {
  it('as 23h30 de 31/08 em Brasilia, o dia ainda e 31/08', () => {
    // O caso do defeito: em UTC ja e 01/09.
    expect(NOITE_DE_BRASILIA.toISOString().slice(0, 10), 'o cenario nao foi montado').toBe('2026-09-01')
    expect(diaNoFuso(SP, NOITE_DE_BRASILIA)).toBe('2026-08-31')
  })

  it('o mesmo instante em Lisboa ja e outro dia — o fuso importa de verdade', () => {
    expect(diaNoFuso('Europe/Lisbon', NOITE_DE_BRASILIA)).toBe('2026-09-01')
  })

  it('validade de 7 dias conta a partir do dia do salao', () => {
    // Era o defeito do orcamento: as 23h30 do dia 31, "7 dias" virava 08/09 em vez de 07/09.
    expect(NOITE_DE_BRASILIA.toISOString().slice(0, 10)).toBe('2026-09-01')
    expect(diaDaquiA(SP, 7, NOITE_DE_BRASILIA)).toBe('2026-09-07')
  })

  it('zero dias e hoje', () => {
    expect(diaDaquiA(SP, 0, NOITE_DE_BRASILIA)).toBe(diaNoFuso(SP, NOITE_DE_BRASILIA))
  })

  it('de manha nao ha divergencia — o defeito e so na janela da noite', () => {
    const manha = new Date('2026-08-31T09:00:00-03:00')
    expect(diaNoFuso(SP, manha)).toBe(manha.toISOString().slice(0, 10))
  })
})
