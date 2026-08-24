import { writeAudit } from '@/server/audit/write'
import { exigirPermissao } from '@/server/auth/rbac'
import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { lerCorpo } from '@/server/http/body'
import { rota } from '@/server/http/handler'
import { comIdempotencia } from '@/server/http/idempotency'
import { definirModulo, EsquemaModulo, listarModulos } from '@/server/services/modulos'

/**
 * docs/18-MONETIZACAO-PLANO.md §L.2. Ligar e desligar módulo é configuração do negócio, então
 * usa a mesma permissão de `tenant:update` — que, na tabela de PERMISSIONS, só o dono tem.
 */
export const GET = rota(async (req) => {
  const ctx = await contextoAtual(req)
  exigirPermissao(ctx.papel, 'tenant:update')

  const db = await criarClienteDoUsuario()
  return { modules: await listarModulos(db, ctx.tenantId) }
})

export const PATCH = rota(async (req, _ctx, requestId) => {
  const ctx = await contextoAtual(req)
  exigirPermissao(ctx.papel, 'tenant:update')

  const entrada = await lerCorpo(req, EsquemaModulo)
  const db = await criarClienteDoUsuario()

  const modules = await comIdempotencia(
    req,
    { tenantId: ctx.tenantId, endpoint: '/api/v1/tenant/modules' },
    () => definirModulo(db, ctx.tenantId, entrada),
  )

  await writeAudit(
    {
      tenantId: ctx.tenantId,
      actorId: ctx.sessao.userId,
      actorRole: ctx.papel,
      action: 'tenant.module.update',
      entity: 'tenant_modules',
      entityId: entrada.modulo,
      after: entrada,
      requestId,
    },
    req,
  )

  return { modules }
})
