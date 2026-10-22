import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { loginPorNumeroDisponivel, modoDoCodigo } from '@/server/auth/login-por-numero'

import { semComentarios } from '../../helpers/fonte'

const CHAVES = {
  TWILIO_ACCOUNT_SID: 'ACfalso',
  TWILIO_AUTH_TOKEN: 'falso',
  TWILIO_VERIFY_SERVICE_SID: 'VAfalso',
}

/**
 * docs/112 EXP-J08 e docs/119: a tela de entrar só oferece o código pelo WhatsApp quando ele
 * consegue sair. Em produção, isso é ter as três chaves do Twilio.
 */
describe('o código pelo WhatsApp só é porta de entrada quando consegue sair', () => {
  it('em produção com as três chaves do Twilio, vai pelo Twilio Verify', () => {
    expect(modoDoCodigo({ NODE_ENV: 'production', ...CHAVES })).toBe('twilio')
    expect(loginPorNumeroDisponivel({ NODE_ENV: 'production', ...CHAVES })).toBe(true)
  })

  it.each(Object.keys(CHAVES))('em produção sem %s, some', (falta) => {
    const env = { NODE_ENV: 'production', ...CHAVES, [falta]: '  ' }
    expect(modoDoCodigo(env)).toBe('desligado')
    expect(loginPorNumeroDisponivel(env)).toBe(false)
  })

  it('fora de produção e sem as chaves, cai no modo de teste (Auth local, nada sai)', () => {
    expect(modoDoCodigo({ NODE_ENV: 'development' })).toBe('teste')
    expect(modoDoCodigo({ NODE_ENV: 'test' })).toBe('teste')
    expect(loginPorNumeroDisponivel({ NODE_ENV: 'development' })).toBe(true)
  })

  it('a credencial antiga da Meta não liga mais o código', () => {
    const meta = { NODE_ENV: 'production', WHATSAPP_PHONE_NUMBER_ID: 'id', WHATSAPP_ACCESS_TOKEN: 't', WHATSAPP_APP_SECRET: 's', SEND_SMS_HOOK_SECRET: 'h' }
    expect(modoDoCodigo(meta)).toBe('desligado')
  })

  it('a tela de entrar passa a decisão para o formulário, e o formulário obedece', () => {
    const pagina = semComentarios(readFileSync('src/app/(auth)/entrar/page.tsx', 'utf8'))
    expect(pagina).toMatch(/numeroDisponivel=\{loginPorNumeroDisponivel\(\)\}/)
    const jeitos = semComentarios(readFileSync('src/app/(auth)/entrar/jeitos-de-entrar.tsx', 'utf8'))
    expect(jeitos, 'sem envio, o formulário de código não pode aparecer').toMatch(
      /if \(!numeroDisponivel\) return <FormularioEntrar \/>/,
    )
    // docs/114 L-03: número e senha continuam sendo o jeito principal.
    expect(jeitos).toMatch(/useState<'numero' \| 'senha'>\('senha'\)/)
  })
})
