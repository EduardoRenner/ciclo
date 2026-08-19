import { writeAudit } from '@/server/audit/write'
import { exigirPermissao } from '@/server/auth/rbac'
import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { lerCorpo } from '@/server/http/body'
import { rota } from '@/server/http/handler'
import { comIdempotencia } from '@/server/http/idempotency'
import { criarModelo, EsquemaModelo, listarModelos } from '@/server/services/mensagens-prontas'

/**
 * Modelo de mensagem é ferramenta de conversa com a cliente, então segue a permissão de
 * cliente (`client:*`, que o gerente já tem) em vez de virar recurso novo na tabela do RBAC.
 */
export const GET = rota(async (req) => {
  const ctx = await contextoAtual(req)
  exigirPermissao(ctx.papel, 'client:read')

  const db = await criarClienteDoUsuario()
  return { templates: await listarModelos(db, ctx.tenantId) }
})

export const POST = rota(async (req, _params, requestId) => {
  const ctx = await contextoAtual(req)
  exigirPermissao(ctx.papel, 'client:update')

  const entrada = await lerCorpo(req, EsquemaModelo)
  const db = await criarClienteDoUsuario()

  const modelo = await comIdempotencia(req, { tenantId: ctx.tenantId, endpoint: '/api/v1/message-templates' }, () =>
    criarModelo(db, ctx.tenantId, entrada),
  )

  await writeAudit(
    {
      tenantId: ctx.tenantId,
      actorId: ctx.sessao.userId,
      actorRole: ctx.papel,
      action: 'message_template.create',
      entity: 'message_templates',
      entityId: modelo.id,
      after: modelo,
      requestId,
    },
    req,
  )

  return modelo
})
