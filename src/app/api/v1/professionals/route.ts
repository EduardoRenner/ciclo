import { writeAudit } from '@/server/audit/write'
import { exigirPermissao } from '@/server/auth/rbac'
import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { lerCorpo } from '@/server/http/body'
import { rota } from '@/server/http/handler'
import { comIdempotencia } from '@/server/http/idempotency'
import { criarProfissional, EsquemaProfissional, listarProfissionais } from '@/server/services/profissionais'

export const GET = rota(async (req) => {
  const ctx = await contextoAtual(req)
  exigirPermissao(ctx.papel, 'professional:read')

  const db = await criarClienteDoUsuario()
  const incluirInativos = new URL(req.url).searchParams.get('inativos') === 'true'

  return { professionals: await listarProfissionais(db, ctx.tenantId, incluirInativos) }
})

export const POST = rota(async (req, _ctx, requestId) => {
  const ctx = await contextoAtual(req)
  exigirPermissao(ctx.papel, 'professional:create')

  const entrada = await lerCorpo(req, EsquemaProfissional)
  const db = await criarClienteDoUsuario()

  const profissional = await comIdempotencia(req, { tenantId: ctx.tenantId, endpoint: '/api/v1/professionals' }, () =>
    criarProfissional(db, ctx.tenantId, entrada),
  )

  await writeAudit(
    {
      tenantId: ctx.tenantId,
      actorId: ctx.sessao.userId,
      actorRole: ctx.papel,
      action: 'professional.create',
      entity: 'professionals',
      entityId: profissional.id,
      after: profissional,
      requestId,
    },
    req,
  )

  return profissional
})
