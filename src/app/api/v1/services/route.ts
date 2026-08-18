import { writeAudit } from '@/server/audit/write'
import { exigirPermissao } from '@/server/auth/rbac'
import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { lerCorpo } from '@/server/http/body'
import { rota } from '@/server/http/handler'
import { comIdempotencia } from '@/server/http/idempotency'
import { criarServico, EsquemaServico, listarServicos } from '@/server/services/servicos'

export const GET = rota(async (req) => {
  const ctx = await contextoAtual(req)
  exigirPermissao(ctx.papel, 'service:read')

  const db = await criarClienteDoUsuario()
  const incluirArquivados = new URL(req.url).searchParams.get('arquivados') === 'true'

  return { services: await listarServicos(db, ctx.tenantId, incluirArquivados) }
})

export const POST = rota(async (req, _ctx, requestId) => {
  const ctx = await contextoAtual(req)
  exigirPermissao(ctx.papel, 'service:create')

  const entrada = await lerCorpo(req, EsquemaServico)
  const db = await criarClienteDoUsuario()

  const servico = await comIdempotencia(req, { tenantId: ctx.tenantId, endpoint: '/api/v1/services' }, () =>
    criarServico(db, ctx.tenantId, entrada),
  )

  await writeAudit(
    {
      tenantId: ctx.tenantId,
      actorId: ctx.sessao.userId,
      actorRole: ctx.papel,
      action: 'service.create',
      entity: 'services',
      entityId: servico.id,
      after: servico,
      requestId,
    },
    req,
  )

  return servico
})
