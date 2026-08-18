import { writeAudit } from '@/server/audit/write'
import { exigirPermissao } from '@/server/auth/rbac'
import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { EsquemaEnviarRecuperar, enviarParaRecuperar } from '@/server/services/recuperar-receita'
import { lerCorpo } from '@/server/http/body'
import { AppError } from '@/server/http/errors'
import { rota } from '@/server/http/handler'
import { comIdempotencia } from '@/server/http/idempotency'

export const POST = rota(async (req, _ctx, requestId) => {
  const ctx = await contextoAtual(req)
  exigirPermissao(ctx.papel, 'client:read')

  const entrada = await lerCorpo(req, EsquemaEnviarRecuperar)
  const db = await criarClienteDoUsuario()

  const { data: tenant, error } = await db.from('tenants').select('timezone').eq('id', ctx.tenantId).maybeSingle()
  if (error) throw new AppError('INTERNAL', { cause: error })
  const timezone = tenant?.timezone ?? 'America/Sao_Paulo'

  const resultado = await comIdempotencia(req, { tenantId: ctx.tenantId, endpoint: '/api/v1/cycle/recover/send' }, () =>
    enviarParaRecuperar(db, ctx.tenantId, timezone, entrada),
  )

  await writeAudit(
    {
      tenantId: ctx.tenantId,
      actorId: ctx.sessao.userId,
      actorRole: ctx.papel,
      action: 'cycle.recover.send',
      entity: 'client_cycles',
      after: resultado,
      requestId,
    },
    req,
  )

  return resultado
})
