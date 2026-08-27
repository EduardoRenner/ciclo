import { cache } from 'react'

import { criarClienteDoUsuario } from '@/server/db/server-client'
import { AppError } from '@/server/http/errors'

export type Sessao = {
  userId: string
  email: string
  /** `aal1` = só senha; `aal2` = com o segundo fator. Ações sensíveis exigem aal2. */
  aal: string
}

/**
 * Sessão validada, ou `null`.
 *
 * Usa `getUser()`, e não `getSession()`, de propósito: `getSession()` lê o JWT do
 * cookie e acredita nele, enquanto `getUser()` manda o token para o servidor de
 * auth conferir a assinatura. Cookie é coisa que o cliente escreve.
 */
/**
 * `cache()` do React, e não memo global: o escopo é **uma requisição**, então dois trechos do
 * mesmo request (o guard da rota e o `contextoAtual` logo depois; a página e o serviço que ela
 * chama) param de pagar duas idas de rede para perguntar a mesma coisa. Entre requisições nada
 * é compartilhado — a sessão de um usuário nunca alcança a de outro.
 *
 * Era 2 idas por chamada de API e 2 por render de tela, todas em série no caminho do clique
 * (`docs/28-LATENCIA-DE-CLIQUE-PLANO.md` §1).
 */
export const sessaoAtual = cache(async function sessaoAtual(): Promise<Sessao | null> {
  const db = await criarClienteDoUsuario()

  const { data, error } = await db.auth.getUser()
  if (error || !data.user) return null

  const { data: nivel } = await db.auth.mfa.getAuthenticatorAssuranceLevel()

  return {
    userId: data.user.id,
    email: data.user.email ?? '',
    aal: nivel?.currentLevel ?? 'aal1',
  }
})

/** Guard das rotas autenticadas: sem sessão válida, `401 UNAUTHENTICATED`. */
export async function exigirSessao(): Promise<Sessao> {
  const sessao = await sessaoAtual()
  if (!sessao) throw new AppError('UNAUTHENTICATED')
  return sessao
}

/** Guard das ações sensíveis de `01-ESPEC-TECNICA §3.2`: exige o segundo fator agora. */
export async function exigirAal2(): Promise<Sessao> {
  const sessao = await exigirSessao()
  if (sessao.aal !== 'aal2') throw new AppError('MFA_REQUIRED')
  return sessao
}
