import { writeAudit } from '@/server/audit/write'
import { exigirPermissao } from '@/server/auth/rbac'
import { exigirAal2 } from '@/server/auth/session'
import { contextoAtual } from '@/server/auth/tenant'
import { EsquemaLembrete, registrarLembrete } from '@/server/advocacia/pendencias'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { lerCorpo } from '@/server/http/body'
import { AppError } from '@/server/http/errors'
import { rota } from '@/server/http/handler'
import { comIdempotencia } from '@/server/http/idempotency'
import { exigirModulo } from '@/server/services/planos'

/**
 * docs/101 T2.8: "cobrei" (ou "liguei") para um cliente. Não envia nada: a mensagem já saiu pelo WhatsApp
 * da própria pessoa. Só marca o marco da escada, para a fila não pedir o mesmo lembrete de novo.
 */
export const POST = rota(async (req, _ctx, requestId) => {
  await exigirAal2()
  const ctx = await contextoAtual(req)
  if (ctx.tenant.pacote !== 'advocacia') throw new AppError('NOT_FOUND')
  exigirPermissao(ctx.papel, 'legal:update')

  const entrada = await lerCorpo(req, EsquemaLembrete)
  const db = await criarClienteDoUsuario()
  await exigirModulo(db, ctx.tenantId, 'legal_checklists')

  return comIdempotencia(req, { tenantId: ctx.tenantId, endpoint: '/api/v1/legal/checklist/lembrete' }, async () => {
    const r = await registrarLembrete(db, ctx.tenantId, entrada)
    await writeAudit(
      {
        tenantId: ctx.tenantId,
        actorId: ctx.sessao.userId,
        actorRole: ctx.papel,
        action: entrada.marco === 'ligar' ? 'legal_checklist.ligar' : 'legal_checklist.cobrar',
        entity: 'legal_checklist_items',
        entityId: entrada.itens[0]!,
        after: { marco: entrada.marco, itens: entrada.itens.length, marcados: r.marcados },
        requestId,
      },
      req,
    )
    return r
  })
})
