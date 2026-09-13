import { withNovoTenant } from '@/server/db/with-tenant'
import { AppError } from '@/server/http/errors'
import { compararSegredo } from '@/server/http/segredo'
import { rota } from '@/server/http/handler'
import { expirarGracaVencida } from '@/server/services/assinatura-mp'

/**
 * `GET /api/cron/expirar-graca` — só `workflow_dispatch`, nunca `on.schedule`: entra em
 * `ROTAS_AGENDADAS` (`src/core/cron/agendadas.ts`) somente quando o Mercado Pago estiver ligado
 * de verdade. Até lá, um heartbeat que nunca bate deixaria `/api/health` vermelho para sempre —
 * a mesma armadilha que `agendadas.ts` documenta para `reminders`/`campaigns`.
 *
 * Sem janela de hora do dia: `expirarGracaVencida` decide por DATA (`graca_ate`), não por hora
 * local do tenant, então rodar de novo no mesmo dia é só reprocessar quem já foi processado —
 * barato, e mais seguro que arriscar não rodar no dia certo.
 *
 * Reconciliação de `docs/63-AUDITORIA-PENDENCIAS-2026-09-13.md`: esta rota (PR #94) tinha sido
 * escrita e ficou presa no mesmo branch órfão do checkout (`docs/63` §0).
 */
export const GET = rota(async (req) => {
  const esperado = process.env.CRON_SECRET
  const recebido = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!compararSegredo(recebido, esperado)) throw new AppError('UNAUTHENTICATED')

  return withNovoTenant(async (svc) => {
    const derrubados = await expirarGracaVencida(svc)
    return { derrubados }
  })
})
