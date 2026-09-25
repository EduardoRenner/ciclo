import { describe, expect, it } from 'vitest'

import { caixaDeEntrada } from '@/core/auth/caixa-de-entrada'

describe('caixaDeEntrada (docs/82 §7)', () => {
  it.each([
    ['dono@gmail.com', 'Gmail'],
    ['Dono@GMAIL.COM', 'Gmail'],
    ['dono@hotmail.com', 'Outlook'],
    ['dono@outlook.com.br', 'Outlook'],
    ['dono@yahoo.com.br', 'Yahoo Mail'],
    ['dono@icloud.com', 'iCloud Mail'],
    ['dono@uol.com.br', 'UOL Mail'],
  ])('%s abre o %s', (email, nome) => {
    expect(caixaDeEntrada(email)?.nome).toBe(nome)
    expect(caixaDeEntrada(email)?.url).toMatch(/^https:\/\//)
  })

  it.each(['dono@barbeariadoze.com.br', 'dono@gmail.com.evil.com', 'sem-arroba', '@gmail.com', ''])(
    'provedor desconhecido ou e-mail estranho (%s) não ganha botão — melhor nenhum que o errado',
    (email) => {
      expect(caixaDeEntrada(email)).toBeNull()
    },
  )
})
