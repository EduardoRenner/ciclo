import { writeAudit } from '@/server/audit/write'
import { exigirPermissao } from '@/server/auth/rbac'
import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { lerCorpo } from '@/server/http/body'
import { AppError } from '@/server/http/errors'
import { rota } from '@/server/http/handler'
import { comIdempotencia } from '@/server/http/idempotency'
import { atualizarProfissional, desativarProfissional, EsquemaProfissionalParcial } from '@/server/services/profissionais'

type Ctx = { params: Promise<{ id: string }> }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

async function idValidado(ctx: unknown): Promise<string> {
  const { id } = await (ctx as Ctx).params
  if (!UUID.test(id)) throw new AppError('NOT_FOUND', { message: 'Esse profissional não está mais no seu time.' })
  return id
}

export const PATCH = rota(async (req, params, requestId) => {
  const ctx = await contextoAtual(req)
  exigirPermissao(ctx.papel, 'professional:update')

  const id = await idValidado(params)
  const entrada = await lerCorpo(req, EsquemaProfissionalParcial)
  const db = await criarClienteDoUsuario()

  const profissional = await comIdempotencia(
    req,
    { tenantId: ctx.tenantId, endpoint: `/api/v1/professionals/${id}` },
    () => atualizarProfissional(db, ctx.tenantId, id, entrada),
  )

  await writeAudit(
    {
      tenantId: ctx.tenantId,
      actorId: ctx.sessao.userId,
      actorRole: ctx.papel,
      action: 'professional.update',
      entity: 'professionals',
      entityId: id,
      after: profissional,
      requestId,
    },
    req,
  )

  return profissional
})

export const DELETE = rota(async (req, params, requestId) => {
  const ctx = await contextoAtual(req)
  exigirPermissao(ctx.papel, 'professional:delete')

  const id = await idValidado(params)
  const db = await criarClienteDoUsuario()

  const resultado = await comIdempotencia(
    req,
    { tenantId: ctx.tenantId, endpoint: `/api/v1/professionals/${id}` },
    () => desativarProfissional(db, ctx.tenantId, id),
  )

  await writeAudit(
    {
      tenantId: ctx.tenantId,
      actorId: ctx.sessao.userId,
      actorRole: ctx.papel,
      action: 'professional.deactivate',
      entity: 'professionals',
      entityId: id,
      after: resultado,
      requestId,
    },
    req,
  )

  return resultado
})
