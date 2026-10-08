import { writeAudit } from '@/server/audit/write'
import { exigirPermissao } from '@/server/auth/rbac'
import { exigirAal2 } from '@/server/auth/session'
import { contextoAtual } from '@/server/auth/tenant'
import { EsquemaConfigAdvocacia, salvarConfigAdvocacia } from '@/server/advocacia/configuracao'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { lerCorpo } from '@/server/http/body'
import { AppError } from '@/server/http/errors'
import { rota } from '@/server/http/handler'
import { comIdempotencia } from '@/server/http/idempotency'
import { exigirModulo } from '@/server/services/planos'

/**
 * docs/101 T4.6: regras de contagem confirmadas pela direção e OAB/papel de cada pessoa da equipe.
 * `tenant:update` é só do dono (como a política de `tenants`); segundo fator e pacote como toda rota
 * do pacote. A trilha guarda QUAIS regras ficaram confirmadas: é a prova de quem autorizou a data a
 * vir preenchida.
 */
export const PATCH = rota(async (req, _ctx, requestId) => {
  await exigirAal2()
  const ctx = await contextoAtual(req)
  if (ctx.tenant.pacote !== 'advocacia') throw new AppError('NOT_FOUND')
  exigirPermissao(ctx.papel, 'tenant:update')

  const entrada = await lerCorpo(req, EsquemaConfigAdvocacia)
  const db = await criarClienteDoUsuario()
  await exigirModulo(db, ctx.tenantId, 'legal_deadlines')

  return comIdempotencia(req, { tenantId: ctx.tenantId, endpoint: '/api/v1/tenant/advocacia' }, async () => {
    const r = await salvarConfigAdvocacia(db, ctx.tenantId, entrada)
    await writeAudit(
      {
        tenantId: ctx.tenantId,
        actorId: ctx.sessao.userId,
        actorRole: ctx.papel,
        action: 'legal_config.update',
        entity: entrada.equipe ? 'professionals' : 'tenants',
        entityId: entrada.equipe ? entrada.equipe.professionalId : ctx.tenantId,
        after: { ...(r.regras ? { regras_confirmadas: r.regras } : {}), ...(entrada.equipe ? { papel: entrada.equipe.papel, tem_oab: entrada.equipe.oabNumero !== null } : {}) },
        requestId,
      },
      req,
    )
    return r
  })
})
