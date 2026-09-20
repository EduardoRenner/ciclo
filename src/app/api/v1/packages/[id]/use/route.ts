import { z } from 'zod'

import { writeAudit } from '@/server/audit/write'
import { exigirPermissao } from '@/server/auth/rbac'
import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { consumirSessao } from '@/server/services/pacotes'
import { lerCorpo } from '@/server/http/body'
import { AppError } from '@/server/http/errors'
import { rota } from '@/server/http/handler'
import { comIdempotencia } from '@/server/http/idempotency'
import { UUID } from '@/core/text/uuid'

type Ctx = { params: Promise<{ id: string }> }

const Esquema = z.object({ appointmentId: z.uuid().nullish() })

export const POST = rota(async (req, params, requestId) => {
  const ctx = await contextoAtual(req)
  exigirPermissao(ctx.papel, 'comanda:own')

  const { id } = await (params as Ctx).params
  if (!UUID.test(id)) throw new AppError('NOT_FOUND', { message: 'Esse pacote não existe mais.' })

  const entrada = await lerCorpo(req, Esquema)
  const db = await criarClienteDoUsuario()

  const resultado = await comIdempotencia(req, { tenantId: ctx.tenantId, endpoint: `/api/v1/packages/${id}/use` }, () =>
    consumirSessao(db, ctx.tenantId, id, entrada.appointmentId ?? null),
  )

  await writeAudit(
    {
      tenantId: ctx.tenantId,
      actorId: ctx.sessao.userId,
      actorRole: ctx.papel,
      action: 'package.use',
      entity: 'packages',
      entityId: id,
      after: resultado,
      requestId,
    },
    req,
  )

  return resultado
})
