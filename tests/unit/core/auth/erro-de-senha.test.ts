import { describe, expect, it } from 'vitest'

import { traduzirErroDeSenha } from '@/core/auth/erro-de-senha'

describe('erro de senha do Supabase vira instrução (APR-217)', () => {
  it('senha curta diz que é curta, não "algo deu errado do nosso lado"', () => {
    expect(traduzirErroDeSenha('Password should be at least 8 characters.')).toMatch(/curta demais/)
    expect(traduzirErroDeSenha('New password should be different from the old password.')).toMatch(/igual à anterior/)
  })
  it('o que não se reconhece volta null', () => {
    expect(traduzirErroDeSenha('Database error')).toBeNull()
    expect(traduzirErroDeSenha(undefined)).toBeNull()
  })
})
