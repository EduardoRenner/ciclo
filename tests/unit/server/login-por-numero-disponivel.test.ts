import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { ENTRAR_COM_CODIGO, loginPorNumeroDisponivel } from '@/server/auth/login-por-numero'

import { semComentarios } from '../../helpers/fonte'

const TUDO = {
  NODE_ENV: 'production',
  WHATSAPP_PHONE_NUMBER_ID: 'id',
  WHATSAPP_ACCESS_TOKEN: 'token',
  WHATSAPP_APP_SECRET: 'segredo',
  SEND_SMS_HOOK_SECRET: 'v1,whsec_x',
}

/**
 * docs/112 EXP-J08: a tela de entrar abria no número mesmo sem como mandar o código, e em
 * produção a pessoa ficava num "tente de novo" que nunca ia funcionar.
 */
describe('o login por número só é porta de entrada quando o código sai', () => {
  it('em produção com a credencial e o segredo do hook, aparece', () => {
    expect(loginPorNumeroDisponivel(TUDO)).toBe(true)
  })

  it.each(['WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_ACCESS_TOKEN', 'WHATSAPP_APP_SECRET', 'SEND_SMS_HOOK_SECRET'])(
    'em produção sem %s, some',
    (falta) => {
      expect(loginPorNumeroDisponivel({ ...TUDO, [falta]: '' })).toBe(false)
    },
  )

  it('fora de produção fica ligado (o hook escreve o código no log)', () => {
    expect(loginPorNumeroDisponivel({ NODE_ENV: 'development' })).toBe(true)
  })

  it('a tela de entrar passa a decisão para o formulário, e o formulário obedece', () => {
    const pagina = semComentarios(readFileSync('src/app/(auth)/entrar/page.tsx', 'utf8'))
    // docs/114 L-03: além do envio estar configurado, o código só volta à tela com `ENTRAR_COM_CODIGO`.
    expect(pagina).toMatch(/numeroDisponivel=\{ENTRAR_COM_CODIGO && loginPorNumeroDisponivel\(\)\}/)
    const jeitos = semComentarios(readFileSync('src/app/(auth)/entrar/jeitos-de-entrar.tsx', 'utf8'))
    expect(jeitos, 'sem envio, o formulário de número não pode aparecer').toMatch(
      /if \(!numeroDisponivel\) return <FormularioEntrar \/>/,
    )
  })
})

describe('lançamento sem a Meta (docs/114 L-03)', () => {
  it('o código pelo WhatsApp está fora da tela: entra com número e senha', () => {
    expect(ENTRAR_COM_CODIGO).toBe(false)
  })
})
