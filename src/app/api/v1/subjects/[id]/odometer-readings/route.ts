import { writeAudit } from '@/server/audit/write'
import { exigirPermissao } from '@/server/auth/rbac'
import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { AppError } from '@/server/http/errors'
import { lerCorpo } from '@/server/http/body'
import { rota } from '@/server/http/handler'
import { comIdempotencia } from '@/server/http/idempotency'
import { EsquemaLeituraDeKm, exigirVeiculoNoAlcance, listarLeiturasDeKm, registrarLeituraDeKm } from '@/server/services/leituras-de-km'
import { UUID } from '@/core/text/uuid'

type Params = { params: Promise<{ id: string }> }

export const GET = rota<Params>(async (req, { params }) => {
  const ctx = await contextoAtual(req)
  const escopo = exigirPermissao(ctx.papel, 'appointment:read')
  const { id } = await params
  if (!UUID.test(id)) throw new AppError('NOT_FOUND', { message: 'Não achamos esse veículo.' })
  const db = await criarClienteDoUsuario()
  await exigirVeiculoNoAlcance(db, ctx.tenantId, id, escopo)
  return { readings: await listarLeiturasDeKm(db, ctx.tenantId, id) }
})

export const POST = rota<Params>(async (req, { params }, requestId) => {
  const ctx = await contextoAtual(req)
  const escopo = exigirPermissao(ctx.papel, 'appointment:create')
  const { id } = await params
  if (!UUID.test(id)) throw new AppError('NOT_FOUND', { message: 'Não achamos esse veículo.' })
  const entrada = await lerCorpo(req, EsquemaLeituraDeKm)
  const db = await criarClienteDoUsuario()
  await exigirVeiculoNoAlcance(db, ctx.tenantId, id, escopo)

  return comIdempotencia(req, { tenantId: ctx.tenantId, endpoint: `/api/v1/subjects/${id}/odometer-readings` }, async () => {
    const resultado = await registrarLeituraDeKm(db, ctx.tenantId, ctx.sessao.userId, id, entrada)
    if (resultado.gravada) {
      await writeAudit(
        { tenantId: ctx.tenantId, actorId: ctx.sessao.userId, actorRole: ctx.papel, action: 'odometer.create', entity: 'odometer_readings', entityId: resultado.id, requestId },
        req,
      )
    }
    return resultado
  })
})
