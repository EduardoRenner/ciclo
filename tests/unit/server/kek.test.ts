import { randomBytes } from 'node:crypto'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Cada teste isola sua própria VAULT_KEK antes de importar o módulo, porque
// `kek()` lê `process.env` a cada chamada — não há estado de módulo para
// vazar entre casos, mas o valor precisa existir antes do primeiro uso.
async function comKek(base64: string | undefined) {
  vi.resetModules()
  if (base64 === undefined) delete process.env.VAULT_KEK
  else process.env.VAULT_KEK = base64
  return import('@/server/crypto/kek')
}

const KEK_VALIDA = randomBytes(32).toString('base64')

describe('gerarDekCifrada / abrirDekCifrada', () => {
  const originalKek = process.env.VAULT_KEK
  const originalVersao = process.env.VAULT_KEK_VERSION

  beforeEach(() => {
    delete process.env.VAULT_KEK_VERSION
  })
  afterEach(() => {
    if (originalKek === undefined) delete process.env.VAULT_KEK
    else process.env.VAULT_KEK = originalKek
    if (originalVersao === undefined) delete process.env.VAULT_KEK_VERSION
    else process.env.VAULT_KEK_VERSION = originalVersao
    vi.resetModules()
  })

  it('ida e volta preserva os 32 bytes da DEK', async () => {
    const { gerarDekCifrada, abrirDekCifrada } = await comKek(KEK_VALIDA)

    const { wrapped } = gerarDekCifrada()
    const dek = abrirDekCifrada(wrapped)

    expect(dek).toHaveLength(32)
  })

  it('duas chamadas geram DEKs diferentes — não é determinístico', async () => {
    const { gerarDekCifrada, abrirDekCifrada } = await comKek(KEK_VALIDA)

    const a = abrirDekCifrada(gerarDekCifrada().wrapped)
    const b = abrirDekCifrada(gerarDekCifrada().wrapped)

    expect(a.equals(b)).toBe(false)
  })

  it('sai no literal hex de bytea que o PostgREST espera', async () => {
    const { gerarDekCifrada } = await comKek(KEK_VALIDA)
    const { wrapped } = gerarDekCifrada()

    expect(wrapped).toMatch(/^\\x[0-9a-f]+$/)
  })

  it('a versão da KEK vai junto, para reencriptar em lote na rotação (FAQ G89)', async () => {
    const { gerarDekCifrada } = await comKek(KEK_VALIDA)
    process.env.VAULT_KEK_VERSION = '3'

    expect(gerarDekCifrada().keyVersion).toBe(3)
  })

  it('versão ausente ou inválida cai em 1, nunca em NaN ou 0', async () => {
    const { gerarDekCifrada } = await comKek(KEK_VALIDA)

    delete process.env.VAULT_KEK_VERSION
    expect(gerarDekCifrada().keyVersion).toBe(1)

    process.env.VAULT_KEK_VERSION = 'não é número'
    expect(gerarDekCifrada().keyVersion).toBe(1)
  })

  it('sem VAULT_KEK, estoura em vez de gerar uma DEK que ninguém consegue abrir depois', async () => {
    const { gerarDekCifrada } = await comKek(undefined)
    expect(() => gerarDekCifrada()).toThrow('VAULT_KEK ausente')
  })

  it('VAULT_KEK de tamanho errado estoura — senão o AES roda com chave fraca', async () => {
    const { gerarDekCifrada } = await comKek(Buffer.from('curta demais').toString('base64'))
    expect(() => gerarDekCifrada()).toThrow(/32 bytes/)
  })

  it('adulterar um byte do wrapped derruba a tag do GCM — não abre em silêncio', async () => {
    const { gerarDekCifrada, abrirDekCifrada } = await comKek(KEK_VALIDA)
    const { wrapped } = gerarDekCifrada()

    const adulterado = wrapped.slice(0, -1) + (wrapped.endsWith('0') ? '1' : '0')

    expect(() => abrirDekCifrada(adulterado)).toThrow()
  })

  it('KEK diferente não abre o que outra KEK cifrou', async () => {
    const { gerarDekCifrada } = await comKek(KEK_VALIDA)
    const { wrapped } = gerarDekCifrada()

    const { abrirDekCifrada: abrirComOutraKek } = await comKek(randomBytes(32).toString('base64'))
    expect(() => abrirComOutraKek(wrapped)).toThrow()
  })
})
