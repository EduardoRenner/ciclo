import { writeAudit } from '@/server/audit/write'
import { exigirPermissao } from '@/server/auth/rbac'
import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { EsquemaChamadaManual, registrarChamadaManual } from '@/server/services/recuperar-receita'
import { lerCorpo } from '@/server/http/body'
import { rota } from '@/server/http/handler'
import { comIdempotencia } from '@/server/http/idempotency'

/**
 * `docs/82` §7 — registra o "Chamar" pelo WhatsApp do próprio dono. Mesma permissão do envio
 * (`/cycle/recover/send`): quem pode avisar pelo sistema pode avisar pelo próprio telefone. Não
 * passa por `envio_em_lote` — é uma pessoa por vez, que é o que o Grátis sempre permitiu.
 */
export const POST = rota(async (req, _ctx, requestId) => {
  const ctx = await contextoAtual(req)
  exigirPermissao(ctx.papel, 'client:read')

  const entrada = await lerCorpo(req, EsquemaChamadaManual)
  const db = await criarClienteDoUsuario()

  const resultado = await comIdempotencia(req, { tenantId: ctx.tenantId, endpoint: '/api/v1/cycle/recover/manual' }, () =>
    registrarChamadaManual(db, ctx.tenantId, entrada),
  )

  await writeAudit(
    {
      tenantId: ctx.tenantId,
      actorId: ctx.sessao.userId,
      actorRole: ctx.papel,
      action: 'cycle.recover.manual',
      entity: 'client_cycles',
      after: { ...entrada, ...resultado },
      requestId,
    },
    req,
  )

  return resultado
})
