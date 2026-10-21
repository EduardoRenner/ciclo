import { createHmac, randomBytes } from 'node:crypto'

import { describe, expect, it } from 'vitest'

import { assinaturaDoHookConfere } from '@/server/auth/assinatura-do-hook'

const CHAVE = randomBytes(32)
const SEGREDO = `v1,whsec_${CHAVE.toString('base64')}`
const AGORA = 1_760_000_000_000
const TIMESTAMP = String(Math.floor(AGORA / 1000))
const ID = 'msg_teste'
const CORPO = JSON.stringify({ user: { phone: '5511900000001' }, sms: { otp: '123456' } })

function assinar(corpo: string, chave = CHAVE, timestamp = TIMESTAMP): string {
  return `v1,${createHmac('sha256', chave).update(`${ID}.${timestamp}.${corpo}`).digest('base64')}`
}

const base = { segredo: SEGREDO, id: ID, timestamp: TIMESTAMP, corpo: CORPO, agora: AGORA }

describe('assinatura do hook de envio do código (docs/110 L1)', () => {
  it('aceita a assinatura feita com a chave certa', () => {
    expect(assinaturaDoHookConfere({ ...base, assinatura: assinar(CORPO) })).toBe(true)
  })

  it('aceita quando uma das várias assinaturas confere (troca de chave em curso)', () => {
    const outra = assinar(CORPO, randomBytes(32))
    expect(assinaturaDoHookConfere({ ...base, assinatura: `${outra} ${assinar(CORPO)}` })).toBe(true)
  })

  it('recusa chave errada', () => {
    expect(assinaturaDoHookConfere({ ...base, assinatura: assinar(CORPO, randomBytes(32)) })).toBe(false)
  })

  it('recusa corpo trocado depois de assinado (outro número ou outro código)', () => {
    const adulterado = CORPO.replace('5511900000001', '5511988887777')
    expect(assinaturaDoHookConfere({ ...base, corpo: adulterado, assinatura: assinar(CORPO) })).toBe(false)
  })

  it('recusa chamada antiga reenviada (mais de 5 minutos)', () => {
    const velho = String(Number(TIMESTAMP) - 301)
    expect(assinaturaDoHookConfere({ ...base, timestamp: velho, assinatura: assinar(CORPO, CHAVE, velho) })).toBe(false)
  })

  it('recusa sem segredo configurado, sem cabeçalho ou com versão desconhecida', () => {
    const assinatura = assinar(CORPO)
    expect(assinaturaDoHookConfere({ ...base, segredo: undefined, assinatura })).toBe(false)
    expect(assinaturaDoHookConfere({ ...base, id: null, assinatura })).toBe(false)
    expect(assinaturaDoHookConfere({ ...base, assinatura: null })).toBe(false)
    expect(assinaturaDoHookConfere({ ...base, assinatura: assinatura.replace('v1,', 'v2,') })).toBe(false)
  })
})
