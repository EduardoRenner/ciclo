import { writeAudit } from '@/server/audit/write'
import { exigirPermissao } from '@/server/auth/rbac'
import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { lerCorpo } from '@/server/http/body'
import { AppError } from '@/server/http/errors'
import { rota } from '@/server/http/handler'
import { comIdempotencia } from '@/server/http/idempotency'
import { assinar, assinaturaAtiva, cancelarAssinatura, EsquemaAssinatura } from '@/server/services/fidelidade'
import { exigirModulo } from '@/server/services/planos'
import { UUID } from '@/core/text/uuid'

type Ctx = { params: Promise<{ id: string }> }

async function idValidado(ctx: unknown): Promise<string> {
  const { id } = await (ctx as Ctx).params
  if (!UUID.test(id)) throw new AppError('NOT_FOUND', { message: 'Essa ficha não está mais na sua lista.' })
  return id
}

export const POST = rota(async (req, params, requestId) => {
  const ctx = await contextoAtual(req)
  exigirPermissao(ctx.papel, 'client:update')

  const id = await idValidado(params)
  const entrada = await lerCorpo(req, EsquemaAssinatura)
  const db = await criarClienteDoUsuario()

  // §D.2, regra 5.1: cair de plano trava CRIAR, nunca esconde o que já existe — por isso a
  // trava fica só aqui (assinar), nunca no DELETE (cancelar) logo abaixo.
  await exigirModulo(db, ctx.tenantId, 'club')

  const assinatura = await comIdempotencia(
    req,
    { tenantId: ctx.tenantId, endpoint: `/api/v1/clients/${id}/subscription` },
    () => assinar(db, ctx.tenantId, id, entrada, ctx.tenant.timezone),
  )

  await writeAudit(
    {
      tenantId: ctx.tenantId,
      actorId: ctx.sessao.userId,
      actorRole: ctx.papel,
      action: 'subscription.start',
      entity: 'client_subscriptions',
      entityId: assinatura.id,
      requestId,
    },
    req,
  )

  return assinatura
})

/** Cancelar não apaga: muda o estado e data, para o histórico de receita continuar explicável. */
export const DELETE = rota(async (req, params, requestId) => {
  const ctx = await contextoAtual(req)
  exigirPermissao(ctx.papel, 'client:update')

  const id = await idValidado(params)
  const db = await criarClienteDoUsuario()

  const atual = await assinaturaAtiva(db, ctx.tenantId, id)
  if (!atual) throw new AppError('NOT_FOUND', { message: 'Esse cliente não tem assinatura ativa.' })

  const resultado = await comIdempotencia(
    req,
    { tenantId: ctx.tenantId, endpoint: `/api/v1/clients/${id}/subscription` },
    () => cancelarAssinatura(db, ctx.tenantId, atual.id),
  )

  await writeAudit(
    {
      tenantId: ctx.tenantId,
      actorId: ctx.sessao.userId,
      actorRole: ctx.papel,
      action: 'subscription.cancel',
      entity: 'client_subscriptions',
      entityId: atual.id,
      requestId,
    },
    req,
  )

  return resultado
})
