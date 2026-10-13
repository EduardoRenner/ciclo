import { createHash } from 'node:crypto'

import { parsePhoneNumberFromString } from 'libphonenumber-js'

/**
 * DDDs de fato atribuídos pela Anatel. `libphonenumber-js` valida o *formato*
 * do número brasileiro (2 dígitos de DDD + celular de 9 ou fixo de 8), mas
 * trata qualquer DDD de 11 a 99 como sintaticamente válido — medido:
 * `parsePhoneNumberFromString('10987654321', 'BR')?.isValid()` devolve `true`,
 * e DDD 10 nunca existiu. A FAQ D49 pede "rejeite DDD inexistente"; sem esta
 * lista, a promessa não se cumpre.
 */
const DDD_VALIDOS = new Set([
  11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 24, 27, 28, 31, 32, 33, 34, 35, 37, 38, 41, 42, 43, 44,
  45, 46, 47, 48, 49, 51, 53, 54, 55, 61, 62, 63, 64, 65, 66, 67, 68, 69, 71, 73, 74, 75, 77, 79, 81,
  82, 83, 84, 85, 86, 87, 88, 89, 91, 92, 93, 94, 95, 96, 97, 98, 99,
])

/**
 * D49: sempre E.164, via `libphonenumber-js` + a lista de DDDs acima. Aqui é o
 * telefone de cliente, que entra por CSV e booking público — fontes mais
 * sujas do que o cadastro de dono, que usa a regex mais simples de
 * `auth/schemas.ts`.
 */
/**
 * Os dígitos do número NACIONAL (DDD + assinante), sem o 55, o 0 de tronco e o código de operadora.
 * `"+55 (11) 99999-0000"`, `"011 99999-0000"` e `"0 15 11 99999-0000"` dão `"11999990000"`.
 */
function digitosNacionais(bruto: string): string {
  let d = bruto.replace(/\D/g, '')
  if (d.startsWith('55') && (bruto.trim().startsWith('+') || d.length >= 12)) d = d.slice(2)
  if (d.startsWith('0')) {
    d = d.replace(/^0+/, '')
    // Sobrou 12 ou 13 dígitos: os dois primeiros eram o código da operadora ("0 15 11 …").
    if (d.length === 12 || d.length === 13) d = d.slice(2)
  }
  return d
}

/**
 * CNV-002 (achado D1 da auditoria do conversor): sem DDD, a função NÃO inventa um. Antes,
 * `"99999-0000"` virava `+55999990000` — os dois primeiros dígitos do celular viravam DDD 99, e a
 * mensagem ia para outra pessoa, em outro estado. Agora, número sem DDD só passa se quem chama disser
 * o DDD do salão (`dddPadrao`); senão é `null`, e a tela pede o DDD.
 */
export function normalizarTelefoneBR(bruto: string, dddPadrao?: number): string | null {
  let nacional = digitosNacionais(bruto)
  if (nacional.length === 8 || nacional.length === 9) {
    if (dddPadrao === undefined || !DDD_VALIDOS.has(dddPadrao)) return null
    nacional = `${dddPadrao}${nacional}`
  }
  if (nacional.length !== 10 && nacional.length !== 11) return null

  const numero = parsePhoneNumberFromString(nacional, 'BR')
  if (!numero?.isValid()) return null

  const ddd = Number(numero.nationalNumber.slice(0, 2))
  if (!DDD_VALIDOS.has(ddd)) return null

  return numero.number
}

/** Hash para busca sem guardar o telefone em claro em índice (D49). */
export function hashTelefone(e164: string): string {
  const sal = process.env.PHONE_HASH_SALT
  if (!sal) throw new Error('PHONE_HASH_SALT ausente — necessário para hash de telefone.')
  return createHash('sha256').update(e164 + sal, 'utf8').digest('hex')
}
