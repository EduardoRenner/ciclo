import { describe, expect, it } from 'vitest'

import { avaliarSenhaLocal, exigirSenhaForte, SENHA_MINIMA } from '@/server/auth/password'
import { AppError } from '@/server/http/errors'

describe('política local de senha', () => {
  it('reprova senha mais curta que o mínimo', () => {
    expect(avaliarSenhaLocal('a'.repeat(SENHA_MINIMA - 1))).toBe('curta')
    expect(avaliarSenhaLocal('')).toBe('curta')
  })

  it('reprova sequência de dígitos, que passa no tamanho', () => {
    expect(avaliarSenhaLocal('1234567890')).toBe('comum')
    expect(avaliarSenhaLocal('0987654321')).toBe('comum')
    expect(avaliarSenhaLocal('0000000000')).toBe('comum')
  })

  it('reprova raiz comum mesmo com número e símbolo colados', () => {
    // É exatamente o que a pessoa faz quando o sistema exige "um número".
    for (const senha of ['senha123456', 'Flamengo2024!', 'qwertyuiop12', 'DeusEFiel00']) {
      expect(avaliarSenhaLocal(senha), senha).toBe('comum')
    }
  })

  it('enxerga a raiz comum através do acento', () => {
    expect(avaliarSenhaLocal('sênha123456')).toBe('comum')
  })

  it('aprova frase longa sem símbolo — a FAQ C38 não exige símbolo', () => {
    expect(avaliarSenhaLocal('cabelo roxo na terca feira')).toBeNull()
    expect(avaliarSenhaLocal('MinhaGataSubiuNoTelhado')).toBeNull()
  })
})

describe('exigirSenhaForte', () => {
  it('lança VALIDATION_ERROR no campo password quando a senha é fraca', () => {
    const erro = (() => {
      try {
        exigirSenhaForte('senha123456')
        return null
      } catch (e) {
        return e
      }
    })()

    expect(erro).toBeInstanceOf(AppError)
    expect((erro as AppError).code).toBe('VALIDATION_ERROR')
    expect((erro as AppError).status).toBe(422)
    expect((erro as AppError).details).toMatchObject({ fields: { password: expect.any(String) as unknown as string } })
  })

  it('aprova senha forte', () => {
    expect(() => exigirSenhaForte('cabelo roxo na terca feira')).not.toThrow()
  })
})
