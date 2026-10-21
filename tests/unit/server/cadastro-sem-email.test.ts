import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { EsquemaCadastro, EsquemaLogin } from '@/server/auth/schemas'

import { semComentarios } from '../../helpers/fonte'

/**
 * docs/114 L-03, decisão do Vitor em 21/10: "Não vamos usar email nunca, põe só número e senha em
 * tudo [...] pede pro cadastro colocar o nome também". Conta antiga que nasceu com e-mail continua
 * entrando: o campo do WhatsApp aceita o e-mail dela, sem campo de e-mail na tela.
 */
describe('cadastro: nome, WhatsApp e senha', () => {
  it('aceita sem e-mail e devolve o número normalizado', () => {
    expect(EsquemaCadastro.parse({ fullName: ' Bia Lima ', phone: '(11) 98765-4321', password: 'uma-senha-boa' })).toEqual({
      fullName: 'Bia Lima',
      phone: '+5511987654321',
      password: 'uma-senha-boa',
    })
  })

  it('o nome é obrigatório', () => {
    expect(EsquemaCadastro.safeParse({ phone: '11987654321', password: 'uma-senha-boa' }).success).toBe(false)
  })

  it('o esquema não tem campo de e-mail', () => {
    expect(Object.keys(EsquemaCadastro.shape)).not.toContain('email')
  })
})

describe('entrar: o campo do WhatsApp aceita número ou o e-mail de conta antiga', () => {
  it('número, do jeito que a pessoa digita', () => {
    expect(EsquemaLogin.parse({ identificador: '(11) 98765-4321', password: 'x' }).identificador).toEqual({ phone: '+5511987654321' })
    expect(EsquemaLogin.parse({ identificador: '+55 11 98765 4321', password: 'x' }).identificador).toEqual({ phone: '+5511987654321' })
  })

  it('e-mail de conta antiga, em minúsculas', () => {
    expect(EsquemaLogin.parse({ identificador: ' Ana@Salao.com ', password: 'x' }).identificador).toEqual({ email: 'ana@salao.com' })
  })

  it('o que não é número nem e-mail volta com o erro do WhatsApp', () => {
    const r = EsquemaLogin.safeParse({ identificador: 'ana', password: 'x' })
    expect(r.success).toBe(false)
    expect(r.error?.issues[0]?.message).toMatch(/WhatsApp com DDD/)
  })
})

describe('as telas de cadastro e de entrar não pedem e-mail', () => {
  it.each(['src/app/(auth)/cadastro/formulario.tsx', 'src/app/(auth)/entrar/formulario.tsx'])('%s', (arquivo) => {
    const fonte = semComentarios(readFileSync(arquivo, 'utf8'))
    expect(fonte).not.toMatch(/name="email"|type="email"|rotulo="E-mail"/)
    // Controle positivo: os campos que ficam estão lá.
    expect(fonte).toMatch(/name="password"/)
    expect(fonte).toMatch(/name="(phone|identificador)"/)
  })

  it('o convite da equipe é pelo WhatsApp, sem campo de e-mail', () => {
    const fonte = semComentarios(readFileSync('src/app/admin/config/profissionais/lista.tsx', 'utf8'))
    expect(fonte).not.toMatch(/name="email"|type="email"/)
    expect(fonte).toMatch(/name="telefone"\s+required/)
  })

  it('a página de marcar horário não pede e-mail da cliente', () => {
    const fonte = semComentarios(readFileSync('src/app/(public)/[slug]/agendar/agendar.tsx', 'utf8'))
    expect(fonte).not.toMatch(/type="email"|rotulo="E-mail/)
    expect(fonte).toMatch(/phone: telefone/)
  })

  it('o cadastro pede o nome', () => {
    expect(semComentarios(readFileSync('src/app/(auth)/cadastro/formulario.tsx', 'utf8'))).toMatch(/name="fullName"/)
  })
})
