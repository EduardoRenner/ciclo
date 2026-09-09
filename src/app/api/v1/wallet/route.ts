import { exigirPermissao } from '@/server/auth/rbac'
import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { saldoCarteira } from '@/server/services/pacotes'
import { AppError } from '@/server/http/errors'
import { rota } from '@/server/http/handler'

export const GET = rota(async (req) => {
  const ctx = await contextoAtual(req)
  exigirPermissao(ctx.papel, 'comanda:own')

  const clientId = new URL(req.url).searchParams.get('clientId')
  if (!clientId) throw AppError.validacao({ clientId: 'Informe a ficha.' })

  const db = await criarClienteDoUsuario()
  return { balanceCents: await saldoCarteira(db, ctx.tenantId, clientId) }
})
