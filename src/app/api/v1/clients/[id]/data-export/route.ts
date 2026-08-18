import { ipDe } from '@/server/audit/write'
import { exigirPermissao } from '@/server/auth/rbac'
import { exigirAal2 } from '@/server/auth/session'
import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { exportarDadosDoCliente } from '@/server/services/lgpd'
import { AppError } from '@/server/http/errors'
import { rota } from '@/server/http/handler'

type Ctx = { params: Promise<{ id: string }> }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** §2.7 `GET .../data-export → JSON (direito de acesso/portabilidade)`. */
export const GET = rota(async (req, params) => {
  const ctx = await contextoAtual(req)
  exigirPermissao(ctx.papel, 'client:read')
  const sessao = await exigirAal2()

  const { id } = await (params as Ctx).params
  if (!UUID.test(id)) throw new AppError('NOT_FOUND', { message: 'Essa cliente não está mais na sua lista.' })

  const db = await criarClienteDoUsuario()
  return exportarDadosDoCliente(db, ctx.tenantId, id, {
    actorId: sessao.userId,
    ip: ipDe(req),
    userAgent: req.headers.get('user-agent')?.slice(0, 400) ?? null,
  })
})
