import { exigirSessao } from '@/server/auth/session'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { AppError } from '@/server/http/errors'
import { rota } from '@/server/http/handler'

export const GET = rota(async () => {
  await exigirSessao()
  const db = await criarClienteDoUsuario()

  const { data, error } = await db.auth.mfa.listFactors()
  if (error) throw new AppError('INTERNAL', { cause: error })

  return {
    factors: data.totp.map((f) => ({ id: f.id, status: f.status, createdAt: f.created_at })),
  }
})
