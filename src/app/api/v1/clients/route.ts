import { writeAudit } from '@/server/audit/write'
import { exigirPermissao } from '@/server/auth/rbac'
import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { criarCliente, EsquemaCliente, listarClientes } from '@/server/services/clientes'
import { listarClientesPorSegmento, type Segmento } from '@/server/services/segmentos'
import { lerCorpo } from '@/server/http/body'
import { rota } from '@/server/http/handler'
import { comIdempotencia } from '@/server/http/idempotency'

const SEGMENTOS_VALIDOS = new Set<Segmento>(['aniversariante', 'primeira_visita_sem_retorno', 'ticket_alto'])

export const GET = rota(async (req) => {
  const ctx = await contextoAtual(req)
  exigirPermissao(ctx.papel, 'client:read')

  const params = new URL(req.url).searchParams
  const db = await criarClienteDoUsuario()
  const cursor = params.get('cursor') ?? undefined
  const limite = params.get('limit') ? Number(params.get('limit')) : undefined

  const segmentoBruto = params.get('segment')
  // Segmento e busca por nome/telefone não combinam nesta versão — a profissional escolhe um
  // filtro por vez, o `q` é ignorado quando `segment` está presente.
  const clientes =
    segmentoBruto && SEGMENTOS_VALIDOS.has(segmentoBruto as Segmento)
      ? await listarClientesPorSegmento(db, ctx.tenantId, segmentoBruto as Segmento, { cursor, limite })
      : await listarClientes(db, ctx.tenantId, { busca: params.get('q') ?? undefined, tag: params.get('tag') ?? undefined, cursor, limite })

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
