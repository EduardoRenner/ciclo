import { writeAudit } from '@/server/audit/write'
import { exigirPermissao } from '@/server/auth/rbac'
import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { criarCliente, EsquemaCliente, listarClientes } from '@/server/services/clientes'
import { lerCorpo } from '@/server/http/body'
import { rota } from '@/server/http/handler'
import { comIdempotencia } from '@/server/http/idempotency'

export const GET = rota(async (req) => {
  const ctx = await contextoAtual(req)
  exigirPermissao(ctx.papel, 'client:read')

  const params = new URL(req.url).searchParams
  const db = await criarClienteDoUsuario()

  const clientes = await listarClientes(db, ctx.tenantId, {
    busca: params.get('q') ?? undefined,
    tag: params.get('tag') ?? undefined,
    cursor: params.get('cursor') ?? undefined,
    limite: params.get('limit') ? Number(params.get('limit')) : undefined,
  })

  return { clients: clientes, nextCursor: clientes.at(-1)?.id }
})

export const POST = rota(async (req, _ctx, requestId) => {
  const ctx = await contextoAtual(req)
  exigirPermissao(ctx.papel, 'client:create')

  const entrada = await lerCorpo(req, EsquemaCliente)
  const db = await criarClienteDoUsuario()

  const cliente = await comIdempotencia(req, { tenantId: ctx.tenantId, endpoint: '/api/v1/clients' }, () =>
    criarCliente(db, ctx.tenantId, entrada),
  )

  await writeAudit(
    {
      tenantId: ctx.tenantId,
      actorId: ctx.sessao.userId,
      actorRole: ctx.papel,
      action: 'client.create',
      entity: 'clients',
      entityId: cliente.id,
      after: cliente,
      requestId,
    },
    req,
  )

  return cliente
})
