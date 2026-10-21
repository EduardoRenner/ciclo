import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { portaDeEntrada } from '@/core/auth/porta-de-entrada'

import { semComentarios } from '../../helpers/fonte'

/**
 * docs/114 L-02: a primeira tela do app (`/entrar`, que é onde o app da loja abre) pergunta "Sou
 * profissional / Sou cliente". Quem chega de um link do painel ou de um e-mail já disse quem é e
 * não passa pela pergunta.
 */
describe('portaDeEntrada', () => {
  it('sem nada na URL, pergunta', () => {
    expect(portaDeEntrada({})).toBe('escolher')
    expect(portaDeEntrada({ porta: '', erro: '', proximo: '' })).toBe('escolher')
  })

  it('a escolha feita fica na URL', () => {
    expect(portaDeEntrada({ porta: 'cliente' })).toBe('cliente')
    expect(portaDeEntrada({ porta: 'profissional' })).toBe('profissional')
  })

  it('quem vem do painel (?proximo=) ou de um e-mail (?erro=) é profissional', () => {
    expect(portaDeEntrada({ proximo: '/admin/hoje' })).toBe('profissional')
    expect(portaDeEntrada({ erro: 'link_expirado' })).toBe('profissional')
  })

  it('porta desconhecida volta para a pergunta', () => {
    expect(portaDeEntrada({ porta: 'admin' })).toBe('escolher')
  })
})

describe('a tela /entrar usa as duas portas', () => {
  const pagina = semComentarios(readFileSync('src/app/(auth)/entrar/page.tsx', 'utf8'))

  it('decide pela função e oferece as duas', () => {
    expect(pagina).toMatch(/portaDeEntrada\(/)
    expect(pagina).toContain('/entrar?porta=profissional')
    expect(pagina).toContain('/entrar?porta=cliente')
    expect(pagina).toContain('Sou profissional')
    expect(pagina).toContain('Sou cliente')
  })

  /*
    A área da cliente (docs/110 L4) ainda não existe. A porta da cliente explica como marcar e não
    promete conta, app, lembrete ou "meus horários", nem leva ao formulário de entrar, que criaria
    uma conta de NEGÓCIO para ela.
  */
  it('a porta da cliente não promete o que ainda não existe', () => {
    const inicio = pagina.indexOf("porta === 'cliente'")
    expect(inicio, 'não achei o ramo da cliente: a guarda ficou cega').toBeGreaterThan(-1)
    const ramo = pagina.slice(inicio, pagina.indexOf('</TelaPublica>', inicio))
    expect(ramo).toContain('link')
    expect(ramo).not.toMatch(/lembrete|baixe|instal|meus horários|minha conta|JeitosDeEntrar|LoginSocial/i)
  })
})
