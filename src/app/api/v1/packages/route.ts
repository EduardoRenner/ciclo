import { exigirPermissao } from '@/server/auth/rbac'
import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { EsquemaVenderPacote, listarPacotesDoCliente, venderPacote } from '@/server/services/pacotes'
import { lerCorpo } from '@/server/http/body'
import { AppError } from '@/server/http/errors'
import { rota } from '@/server/http/handler'
import { comIdempotencia } from '@/server/http/idempotency'

export const GET = rota(async (req) => {
  const ctx = await contextoAtual(req)
  exigirPermissao(ctx.papel, 'comanda:own')

  const clientId = new URL(req.url).searchParams.get('clientId')
  if (!clientId) throw AppError.validacao({ clientId: 'Informe a cliente.' })

  const db = await criarClienteDoUsuario()
  return listarPacotesDoCliente(db, ctx.tenantId, clientId)
})

export const POST = rota(async (req) => {
  const ctx = await contextoAtual(req)
  exigirPermissao(ctx.papel, 'comanda:own')

  const entrada = await lerCorpo(req, EsquemaVenderPacote)
  const db = await criarClienteDoUsuario()

  return comIdempotencia(req, { tenantId: ctx.tenantId, endpoint: '/api/v1/packages' }, () => venderPacote(db, ctx.tenantId, entrada))
})
