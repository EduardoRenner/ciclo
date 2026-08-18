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
export async function sessaoAtual(): Promise<Sessao | null> {
  const db = await criarClienteDoUsuario()

  const { data, error } = await db.auth.getUser()
  if (error || !data.user) return null

  const { data: nivel } = await db.auth.mfa.getAuthenticatorAssuranceLevel()

  return {
    userId: data.user.id,
    email: data.user.email ?? '',
    aal: nivel?.currentLevel ?? 'aal1',
  }
}

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
