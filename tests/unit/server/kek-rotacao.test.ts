import { randomBytes } from 'node:crypto'

import { describe, expect, it } from 'vitest'

import { abrirDekCifrada, rewrapDek } from '@/server/crypto/kek'

/**
 * Achado S8 da auditoria de 2026-08-23: não existia caminho de rotação da KEK.
 * `abrirDekCifrada` só conhecia `process.env.VAULT_KEK`, então trocar a chave fazia o GCM falhar
 * em **todo** `dek_wrapped` — nenhuma anamnese de nenhum tenant voltava a abrir. Rotacionar tinha
 * o mesmo efeito que perder a chave, o que transformava a resposta correta a um vazamento
 * ("rotacione") em destruição de dado.
 *
 * O teste antigo (`vault.test.ts`) dizia simular "a rotação anual da KEK" e re-embrulhava com a
 * **mesma** chave — passava sem provar nada sobre rotação. Estes trocam a chave de verdade.
 *
 * Chaves injetadas em vez de `process.env`: no Vitest, arquivos rodam em threads que compartilham
 * o env por referência, e um teste que muta a KEK vazaria para outro arquivo em paralelo.
 */

const KEK_A = randomBytes(32).toString('base64')
const KEK_B = randomBytes(32).toString('base64')

describe('rotação de KEK (achado S8)', () => {
  it('a DEK embrulhada pela chave ANTIGA continua abrindo depois da rotação', () => {
    const dek = randomBytes(32)
    const { wrapped } = rewrapDek(dek, KEK_A)

    // Depois da rotação: VAULT_KEK = B, VAULT_KEK_PREVIOUS = A.
    const aberta = abrirDekCifrada(wrapped, [KEK_B, KEK_A])
    expect(aberta.equals(dek)).toBe(true)
  })

  it('sem a chave anterior no ambiente, o material antigo NÃO abre — este é o S8', () => {
    const dek = randomBytes(32)
    const { wrapped } = rewrapDek(dek, KEK_A)

    // É exatamente o que acontecia antes da correção: rotacionou, perdeu tudo.
    expect(() => abrirDekCifrada(wrapped, [KEK_B])).toThrow(/não foi possível abrir a dek/i)
  })

  it('o erro diz o que fazer, sem entregar qual chave existe no ambiente', () => {
    const { wrapped } = rewrapDek(randomBytes(32), KEK_A)
    try {
      abrirDekCifrada(wrapped, [KEK_B])
      expect.unreachable('deveria ter lançado')
    } catch (erro) {
      const mensagem = (erro as Error).message
      expect(mensagem).toMatch(/VAULT_KEK_PREVIOUS/)
      expect(mensagem).toMatch(/rotacionar-kek/)
      // Nenhum pedaço de chave na mensagem.
      expect(mensagem).not.toContain(KEK_A.slice(0, 12))
      expect(mensagem).not.toContain(KEK_B.slice(0, 12))
    }
  })

  it('re-embrulhar com a chave NOVA preserva a DEK byte a byte', () => {
    const dek = randomBytes(32)
    const { wrapped: pelaAntiga } = rewrapDek(dek, KEK_A)

    // O que `scripts/rotacionar-kek.mjs` faz: abre com a antiga, fecha com a nova.
    const emClaro = abrirDekCifrada(pelaAntiga, [KEK_B, KEK_A])
    const { wrapped: pelaNova } = rewrapDek(emClaro, KEK_B)

    // A DEK não muda na rotação — é o que dispensa recifrar `health_records` inteiro.
    expect(abrirDekCifrada(pelaNova, [KEK_B]).equals(dek)).toBe(true)
    expect(pelaNova).not.toBe(pelaAntiga)
  })

  it('depois do re-embrulho, a chave antiga sozinha já não abre — a rotação valeu', () => {
    const dek = randomBytes(32)
    const { wrapped: pelaNova } = rewrapDek(dek, KEK_B)
    expect(() => abrirDekCifrada(pelaNova, [KEK_A])).toThrow()
  })

  it('KEK de tamanho errado é recusada na decodificação, não usada torta', () => {
    const curta = randomBytes(16).toString('base64')
    const { wrapped } = rewrapDek(randomBytes(32), KEK_A)
    expect(() => abrirDekCifrada(wrapped, [curta])).toThrow(/32 bytes/)
  })
})
