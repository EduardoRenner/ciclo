import { writeAudit } from '@/server/audit/write'
import { exigirPermissao } from '@/server/auth/rbac'
import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { lerCorpo } from '@/server/http/body'
import { rota } from '@/server/http/handler'
import { comIdempotencia } from '@/server/http/idempotency'
import { criarExperimento, EsquemaCriarExperimento, listarExperimentos } from '@/server/services/experimentos'

/**
 * `docs/84` Aposta C — os testes que o dono liga. Ler é número de dinheiro atendido: a mesma
 * permissão dos relatórios. Criar e cancelar é decisão do negócio: a mesma de mudar a configuração.
 */
export const GET = rota(async (req) => {
  const ctx = await contextoAtual(req)
  exigirPermissao(ctx.papel, 'report:read')

  const db = await criarClienteDoUsuario()
  return { experiments: await listarExperimentos(db, ctx.tenantId, ctx.tenant.timezone) }
})

export const POST = rota(async (req, _params, requestId) => {
  const ctx = await contextoAtual(req)
  exigirPermissao(ctx.papel, 'tenant:update')

  const entrada = await lerCorpo(req, EsquemaCriarExperimento)
  const db = await criarClienteDoUsuario()

  // BL-42: writeAudit dentro do fechamento — ver o comentário em wallet/credit/route.ts.
  return comIdempotencia(req, { tenantId: ctx.tenantId, endpoint: '/api/v1/experiments' }, async () => {
    const criado = await criarExperimento(db, ctx.tenantId, ctx.tenant.timezone, ctx.sessao.userId, entrada)
    await writeAudit(
      {
        tenantId: ctx.tenantId,
        actorId: ctx.sessao.userId,
        actorRole: ctx.papel,
        action: 'experiment.create',
        entity: 'experiments',
        entityId: criado.id,
        after: { ...entrada },
        requestId,
      },
      req,
    )
    return criado
  })
})
