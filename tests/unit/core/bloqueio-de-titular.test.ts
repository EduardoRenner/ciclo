import { describe, expect, it } from 'vitest'

import { bloqueioDeTitularSemSucessor } from '@/core/auth/bloqueio-de-titular'

/**
 * O bloqueio da exclusão de conta mandava "fale com o suporte para transferir". Suporte não é um
 * lugar: produção não tem canal de contato configurado (`lib/contato.ts`), e a frase mandava a
 * pessoa procurar uma porta que não existe (`docs/82` §16, rodada 26).
 */
describe('bloqueioDeTitularSemSucessor', () => {
  it('sem canal de contato, não promete suporte nenhum', () => {
    const texto = bloqueioDeTitularSemSucessor(false)
    expect(texto).toMatch(/assumir como titular/)
    expect(texto).not.toMatch(/suporte|fale com|a gente/i)
  })

  it('com canal, diz para falar com a gente (o botão do canal vem junto na tela)', () => {
    expect(bloqueioDeTitularSemSucessor(true)).toMatch(/fale com a gente/i)
  })
})
