import { describe, expect, it } from 'vitest'

import { SISTEMAS_ANTERIORES } from '@/core/onboarding/perfil'

/**
 * docs/112 EXP-S14 (`04-salao.md` §7.3): "Qual sistema você usa?" abria por AppBarber e BarbUp, dois
 * de barbearia, sem nenhum dos que a beleza feminina usa. Agora a beleza vem em cima; os dois de
 * barbearia ficam antes de "Outro", porque a barbearia continua aceita.
 */
const DE_BARBEARIA = ['appbarber', 'barbup']

describe('sistemas anteriores do cadastro (docs/112 EXP-S14)', () => {
  it('começa pelos sistemas da beleza, na ordem do §7.3', () => {
    expect(SISTEMAS_ANTERIORES.slice(0, 7)).toEqual(['trinks', 'booksy', 'avec', 'gendo', 'fresha', 'agendapro', 'agendiva'])
  })

  it('os de barbearia vêm depois de todos os de beleza, e "outro" por último', () => {
    const primeiraBarbearia = SISTEMAS_ANTERIORES.findIndex((s) => DE_BARBEARIA.includes(s))
    const ultimaBeleza = SISTEMAS_ANTERIORES.reduce((u, s, i) => (DE_BARBEARIA.includes(s) || s === 'outro' ? u : i), -1)
    expect(primeiraBarbearia).toBeGreaterThan(ultimaBeleza)
    expect(SISTEMAS_ANTERIORES.at(-1)).toBe('outro')
  })

  it('nenhuma chave antiga sumiu: há respostas gravadas com elas no evento perfil_respondido', () => {
    for (const antiga of ['appbarber', 'trinks', 'belasis', 'barbup', 'booksy', 'outro']) expect(SISTEMAS_ANTERIORES).toContain(antiga)
  })
})
