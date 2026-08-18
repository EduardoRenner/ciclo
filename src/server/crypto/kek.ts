import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

/**
 * Só o envelope da chave (§8: "KEK → DEK por tenant, gerada no onboarding,
 * guardada CIFRADA em tenant_keys"). O `encryptVault`/`decryptVault` que cifra
 * registro por registro com a DEK é módulo à parte, do TICKET-049 — aqui só
 * nasce e embrulha a DEK; ela não decifra nada ainda.
 */

const TAMANHO_DEK = 32 // AES-256
const TAMANHO_IV = 12 // padrão do GCM
const TAMANHO_TAG = 16

function kek(): Buffer {
  const bruta = process.env.VAULT_KEK
  if (!bruta) throw new Error('VAULT_KEK ausente — sem ela nenhum tenant novo pode gerar cofre.')

  const chave = Buffer.from(bruta, 'base64')
  if (chave.length !== TAMANHO_DEK) {
    throw new Error(`VAULT_KEK precisa decodificar para 32 bytes; tem ${chave.length}.`)
  }
  return chave
}

function versaoKek(): number {
  const v = Number(process.env.VAULT_KEK_VERSION ?? '1')
  return Number.isInteger(v) && v > 0 ? v : 1
}

/** Literal hex de bytea que o PostgREST espera (`\x` + hex) — é como o schema já grava binário. */
function paraBytea(buf: Buffer): string {
  return `\\x${buf.toString('hex')}`
}

function deBytea(literal: string): Buffer {
  return Buffer.from(literal.replace(/^\\x/, ''), 'hex')
}

/**
 * Embrulha uma DEK (nova ou já existente) pela KEK atual — pronta para
 * `tenant_keys.dek_wrapped`. `rewrapDek` é o que a rotação anual da KEK usa
 * (§8): a DEK do tenant não muda, só a chave que a protege; reaproveitar essa
 * função para os dois casos evita duas implementações do mesmo envelope.
 */
export function rewrapDek(dek: Buffer): { wrapped: string; keyVersion: number } {
  const iv = randomBytes(TAMANHO_IV)

  const cifra = createCipheriv('aes-256-gcm', kek(), iv)
  const ciphertext = Buffer.concat([cifra.update(dek), cifra.final()])
  const tag = cifra.getAuthTag()

  // iv || tag || ciphertext num bytea só: mais simples que três colunas, e o
  // tamanho de cada pedaço é fixo, então separar de volta não precisa de delimitador.
  return { wrapped: paraBytea(Buffer.concat([iv, tag, ciphertext])), keyVersion: versaoKek() }
}

/** Gera a DEK do tenant já cifrada pela KEK — pronta para `tenant_keys.dek_wrapped`. */
export function gerarDekCifrada(): { wrapped: string; keyVersion: number } {
  return rewrapDek(randomBytes(TAMANHO_DEK))
}

/** Volta a DEK em claro. Uso restrito ao TICKET-049 — nasce aqui só para ter teste de ida e volta. */
export function abrirDekCifrada(wrapped: string): Buffer {
  const bruto = deBytea(wrapped)
  const iv = bruto.subarray(0, TAMANHO_IV)
  const tag = bruto.subarray(TAMANHO_IV, TAMANHO_IV + TAMANHO_TAG)
  const ciphertext = bruto.subarray(TAMANHO_IV + TAMANHO_TAG)

  const decifra = createDecipheriv('aes-256-gcm', kek(), iv)
  decifra.setAuthTag(tag)
  return Buffer.concat([decifra.update(ciphertext), decifra.final()])
}
