import { exigirAal2 } from '@/server/auth/session'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { AppError } from '@/server/http/errors'
import { rota } from '@/server/http/handler'

type Ctx = { params: Promise<{ id: string }> }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * Remover o segundo fator exige `aal2` (não só sessão comum) — mesmo raciocínio de "trocar
 * senha exige a senha atual, mesmo logado": desligar a própria proteção não pode ser mais
 * fácil do que usá-la. Só é possível chegar em `aal2` tendo acabado de provar o fator, então
 * quem remove já demonstrou que é dono dele.
 */
export const DELETE = rota(async (_req, ctx) => {
  await exigirAal2()
  const { id } = await (ctx as Ctx).params
  if (!UUID.test(id)) throw new AppError('NOT_FOUND', { message: 'Fator não encontrado.' })

  const db = await criarClienteDoUsuario()
  const { error } = await db.auth.mfa.unenroll({ factorId: id })
  if (error) throw new AppError('INTERNAL', { cause: error })

  return { ok: true }
})
