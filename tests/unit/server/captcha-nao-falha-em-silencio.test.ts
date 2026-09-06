import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { verificarCaptcha } from '@/server/services/captcha'

/**
 * O captcha **falha aberto de propósito**, e essa decisão está certa: derrubar o agendamento
 * público de todo salão porque a hCaptcha teve um soluço é pior que aceitar sem essa camada por um
 * tempo — o honeypot e o rate limit não dependem de credencial nenhuma e continuam de pé.
 *
 * O que estava errado era o silêncio. O `catch` engolia timeout, DNS, 5xx e segredo inválido sem
 * deixar rastro, enquanto o ramo de cima (`!secret`) registrava `hcaptcha_nao_configurado`. Ou
 * seja: a única forma de falha que alguém conseguia ver era a que não é falha. Uma indisponibilidade
 * prolongada — ou um segredo trocado por engano — viraria "captcha aprovando 100% das tentativas"
 * sem sinal em lugar nenhum.
 *
 * E "por um tempo", que é a condição que o próprio comentário assume, era exatamente o que ninguém
 * tinha como medir.
 */
describe('verificarCaptcha deixa passar quando não dá para verificar — mas conta', () => {
  const secretOriginal = process.env.HCAPTCHA_SECRET
  let avisos: string[]

  beforeEach(() => {
    avisos = []
    vi.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
      avisos.push(args.map(String).join(' '))
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    if (secretOriginal === undefined) delete process.env.HCAPTCHA_SECRET
    else process.env.HCAPTCHA_SECRET = secretOriginal
  })

  it('sem segredo: passa e diz que não está configurado', async () => {
    delete process.env.HCAPTCHA_SECRET
    expect(await verificarCaptcha('qualquer')).toBe(true)
    expect(avisos.join(' ')).toContain('hcaptcha_nao_configurado')
  })

  it('provedor fora do ar: passa E deixa rastro — era aqui que ninguém via nada', async () => {
    process.env.HCAPTCHA_SECRET = 'segredo-de-teste'
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new DOMException('tempo esgotado', 'TimeoutError'))

    expect(await verificarCaptcha('token-qualquer'), 'a decisão de falhar aberto continua').toBe(true)
    expect(
      avisos.join(' '),
      'o `catch` voltou a engolir a falha: indisponibilidade prolongada vira "aprovando 100%" sem sinal nenhum',
    ).toContain('hcaptcha_indisponivel')
  })

  /*
   * O contrapeso: falhar aberto é só para quem não CONSEGUIU verificar. Token que o provedor
   * respondeu e REPROVOU tem que ser recusado — se este caso virasse `true`, a camada deixaria de
   * existir mesmo com tudo funcionando, e nenhum log denunciaria, porque não houve exceção.
   */
  it('provedor respondeu e reprovou: recusa, e sem aviso nenhum', async () => {
    process.env.HCAPTCHA_SECRET = 'segredo-de-teste'
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ success: false })))

    expect(await verificarCaptcha('token-ruim')).toBe(false)
    expect(avisos, 'reprovação normal não é incidente — logar aqui viraria ruído diário').toEqual([])
  })

  it('token ausente com segredo configurado: recusa sem nem perguntar ao provedor', async () => {
    process.env.HCAPTCHA_SECRET = 'segredo-de-teste'
    const chamou = vi.spyOn(globalThis, 'fetch')
    expect(await verificarCaptcha(undefined)).toBe(false)
    expect(chamou).not.toHaveBeenCalled()
  })
})
