import { describe, expect, it } from 'vitest'

import { JANELA_DE_LOGIN_RECENTE_MS, confirmacaoParaExcluir } from '@/core/auth/confirmar-exclusao'

const AGORA = Date.UTC(2026, 9, 15, 20, 0)
const base = { aal: 'aal1', temSegundoFator: false, temSenha: true, autenticadoEmMs: AGORA - 60 * 60 * 1000, agoraMs: AGORA }

/** docs/98-aprimoramento/11 LOJA-27. */
describe('o que confirma a exclusão da própria conta', () => {
  it('com o segundo fator já verificado, está pronta', () => {
    expect(confirmacaoParaExcluir({ ...base, aal: 'aal2', temSegundoFator: true })).toBe('pronta')
  })

  it('com o segundo fator cadastrado e não verificado, só ele serve (nem login recente, nem senha)', () => {
    expect(confirmacaoParaExcluir({ ...base, temSegundoFator: true, autenticadoEmMs: AGORA - 1000 })).toBe('segundo_fator')
  })

  it('sem segundo fator e com login de agora há pouco, está pronta: não manda ligar a verificação', () => {
    expect(confirmacaoParaExcluir({ ...base, autenticadoEmMs: AGORA - 2 * 60 * 1000 })).toBe('pronta')
    expect(confirmacaoParaExcluir({ ...base, autenticadoEmMs: AGORA - JANELA_DE_LOGIN_RECENTE_MS })).toBe('pronta')
  })

  it('sem segundo fator e com login antigo, pede a senha', () => {
    expect(confirmacaoParaExcluir(base)).toBe('senha')
    expect(confirmacaoParaExcluir({ ...base, autenticadoEmMs: AGORA - JANELA_DE_LOGIN_RECENTE_MS - 1 })).toBe('senha')
  })

  it('quem só entra por Google ou Apple e entrou há muito tempo precisa entrar de novo', () => {
    expect(confirmacaoParaExcluir({ ...base, temSenha: false })).toBe('entrar_de_novo')
  })

  it('sem data de login, ou com data no futuro, não conta como recente', () => {
    expect(confirmacaoParaExcluir({ ...base, autenticadoEmMs: null })).toBe('senha')
    expect(confirmacaoParaExcluir({ ...base, autenticadoEmMs: AGORA + 60 * 1000 })).toBe('senha')
  })
})
