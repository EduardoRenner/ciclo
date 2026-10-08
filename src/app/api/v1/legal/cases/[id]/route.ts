import { hojeNoFuso } from '@/core/advocacia/datas'
import { UUID } from '@/core/text/uuid'
import { writeAudit } from '@/server/audit/write'
import { exigirPermissao } from '@/server/auth/rbac'
import { exigirAal2 } from '@/server/auth/session'
import { contextoAtual } from '@/server/auth/tenant'
import { EsquemaMudarCaso, mudarCaso } from '@/server/advocacia/casos'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { lerCorpo } from '@/server/http/body'
import { AppError } from '@/server/http/errors'
import { rota } from '@/server/http/handler'
import { comIdempotencia } from '@/server/http/idempotency'
import { exigirModulo } from '@/server/services/planos'

import type { PapelNoEscritorio } from '@/core/advocacia/casos'

type Ctx = { params: Promise<{ id: string }> }

/**
 * docs/101 T2.6: estado do caso, frase ao cliente e sigilo. A resposta traz a mensagem de andamento
 * pronta (nunca enviada daqui). A trilha guarda o estado e o sigilo, não a frase.
 */
export const PATCH = rota(async (req, params, requestId) => {
  await exigirAal2()
  const ctx = await contextoAtual(req)
  if (ctx.tenant.pacote !== 'advocacia') throw new AppError('NOT_FOUND')
  exigirPermissao(ctx.papel, 'legal:update')

  const { id } = await (params as Ctx).params
  if (!UUID.test(id)) throw new AppError('NOT_FOUND', { message: 'Esse caso não está mais disponível.' })
  const entrada = await lerCorpo(req, EsquemaMudarCaso)
  const db = await criarClienteDoUsuario()
  await exigirModulo(db, ctx.tenantId, 'legal_cases')

  return comIdempotencia(req, { tenantId: ctx.tenantId, endpoint: `/api/v1/legal/cases/${id}` }, async () => {
    const r = await mudarCaso(
      db,
      ctx.tenantId,
      id,
      { papel: ctx.papel as PapelNoEscritorio, escritorio: ctx.tenant.name, hoje: hojeNoFuso(ctx.tenant.timezone, new Date()) },
      entrada,
    )
    await writeAudit(
      {
        tenantId: ctx.tenantId,
        actorId: ctx.sessao.userId,
        actorRole: ctx.papel,
        action: 'legal_case.update',
        entity: 'legal_cases',
        entityId: id,
        after: { estado: r.estado, ...(entrada.sigilo ? { sigilo: entrada.sigilo } : {}), avisou_cliente: entrada.notaParaCliente !== undefined },
        requestId,
      },
      req,
    )
    return r
  })
})
