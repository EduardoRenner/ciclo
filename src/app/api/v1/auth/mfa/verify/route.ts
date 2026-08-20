import { exigirSessao } from '@/server/auth/session'
import { EsquemaVerificarMfa } from '@/server/auth/schemas'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { lerCorpo } from '@/server/http/body'
import { AppError } from '@/server/http/errors'
import { rota } from '@/server/http/handler'

/**
 * Mesma rota serve os dois momentos em que alguém digita o código de 6 dígitos: terminar de
 * cadastrar o fator (depois do QR code) e o desafio de cada login novo — `challengeAndVerify`
 * do Supabase faz as duas coisas (challenge + verify) numa chamada só, e o resultado é o
 * mesmo nos dois casos: a sessão sobe de `aal1` para `aal2`.
 */
export const POST = rota(async (req) => {
  await exigirSessao()
  const { factorId, code } = await lerCorpo(req, EsquemaVerificarMfa)

  const db = await criarClienteDoUsuario()
  const { error } = await db.auth.mfa.challengeAndVerify({ factorId, code })
  if (error) throw AppError.validacao({ code: 'Código incorreto ou expirado. Confira no app e tente de novo.' })

  return { ok: true }
})
