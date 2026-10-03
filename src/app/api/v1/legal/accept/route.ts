import { writeAudit } from '@/server/audit/write'
import { exigirPermissao } from '@/server/auth/rbac'
import { contextoAtual } from '@/server/auth/tenant'
import { withTenant } from '@/server/db/with-tenant'
import { rota } from '@/server/http/handler'
import { comIdempotencia } from '@/server/http/idempotency'
import { registrarReaceite } from '@/server/services/aceite-legal'
import { VERSOES_LEGAIS } from '@/core/legal/versoes'

/**
 * `POST /api/v1/legal/accept`: o dono aceita a versão em vigor dos termos e da política (docs/86 J8).
 *
 * `tenant:update` e não `client:read`: quem aceita é quem responde pelo negócio, e uma recepcionista
 * não pode aceitar contrato em nome do dono. Sem corpo: a rota aceita sempre a versão EM VIGOR do que
 * falta, nunca uma versão dita pelo navegador (que seria um jeito de gravar aceite de texto que
 * ninguém viu).
 */
export const POST = rota(async (req, _params, requestId) => {
  const ctx = await contextoAtual(req)
  exigirPermissao(ctx.papel, 'tenant:update')

  // BL-42: writeAudit dentro do fechamento — ver o comentário em wallet/credit/route.ts.
  return comIdempotencia(req, { tenantId: ctx.tenantId, endpoint: '/api/v1/legal/accept' }, async () => {
    const resultado = await withTenant(ctx.tenantId, (svc) => registrarReaceite(svc, ctx.tenantId, ctx.sessao.userId))
    if (resultado.aceitos.length > 0) {
      await writeAudit(
        {
          tenantId: ctx.tenantId,
          actorId: ctx.sessao.userId,
          actorRole: ctx.papel,
          action: 'legal.reaceite',
          entity: 'terms_acceptances',
          after: { documentos: resultado.aceitos, versoes: VERSOES_LEGAIS },
          requestId,
        },
        req,
      )
    }
    return resultado
  })
})
