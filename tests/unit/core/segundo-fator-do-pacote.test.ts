import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { PACOTES } from '@/core/pacotes'
import { exigeSegundoFator, ROTA_DO_SEGUNDO_FATOR } from '@/core/pacotes/segundo-fator'

import { semComentarios } from '../../helpers/fonte'

/** docs/101 T0.4: a porta de segundo fator do painel, por pacote. */

describe('quem precisa de segundo fator', () => {
  it('beleza (base) nunca: o painel de hoje não muda', () => {
    for (const aal of ['aal1', 'aal2', '', 'desconhecido']) expect(exigeSegundoFator('base', aal)).toBe(false)
  })

  it('advocacia com sessão só de senha: exige', () => {
    expect(exigeSegundoFator('advocacia', 'aal1')).toBe(true)
  })

  it('advocacia com segundo fator: não exige', () => {
    expect(exigeSegundoFator('advocacia', 'aal2')).toBe(false)
  })

  it('nível que não reconheço exige (errar para o lado de pedir o fator)', () => {
    for (const aal of ['', 'AAL2', 'aal3', 'null']) expect(exigeSegundoFator('advocacia', aal)).toBe(true)
  })

  it('só a advocacia liga a porta hoje', () => {
    expect(Object.values(PACOTES).filter((p) => p.exigeSegundoFator).map((p) => p.slug)).toEqual(['advocacia'])
  })
})

describe('a costura no servidor', () => {
  const TENANT = semComentarios(readFileSync('src/server/auth/tenant.ts', 'utf8'))
  const SEGURANCA = semComentarios(readFileSync('src/app/admin/config/seguranca/page.tsx', 'utf8'))

  it('contextoDoPainel chama a porta e redireciona', () => {
    // A CHAMADA com os dois argumentos do contexto, não o nome solto que o import já traria.
    expect(/if \(exigeSegundoFator\(ctx\.tenant\.pacote, ctx\.sessao\.aal\)\) redirect\(ROTA_DO_SEGUNDO_FATOR\)/.test(TENANT)).toBe(true)
  })

  it('o destino é a tela de Segurança com o motivo, e ela não passa pela porta (senão vira laço)', () => {
    expect(ROTA_DO_SEGUNDO_FATOR).toBe('/admin/config/seguranca?motivo=pacote')
    expect(/contextoDoPainel\(|contextoAtual\(/.test(SEGURANCA), 'a tela de Segurança passou pela porta: laço').toBe(false)
  })

  it('a tela de Segurança explica o motivo, nos dois casos (sem fator e com fator em sessão antiga)', () => {
    expect(SEGURANCA).toContain("motivo === 'pacote'")
    expect(SEGURANCA).toContain('Este escritório exige segundo fator. Ative para continuar.')
    expect(SEGURANCA).toContain('Saia e entre de novo')
  })
})
