import { withNovoTenant } from '@/server/db/with-tenant'
import { AppError } from '@/server/http/errors'
import { compararSegredo } from '@/server/http/segredo'
import { rota } from '@/server/http/handler'
import { recalcularSegmentosDoTenant } from '@/server/services/segmentos'

/**
 * TICKET-040. O filtro de hora local (era 4h) **saiu em 2026-08-30 pelo mesmo motivo medido em
 * `recompute-cycles/route.ts`** — leia lá o histórico das três rodadas. Resumo: o atraso real do
 * `schedule` do GitHub nesta base é de 5 a 6,5 horas, e nenhuma janela razoável sobrevive a isso.
 *
 * Segue seguro: recalcular segmento é upsert idempotente, não lê `client_cycles` (as duas rotas
 * não disputam dado), e não fala com ninguém de fora.
 */
export const GET = rota(async (req) => {
  const esperado = process.env.CRON_SECRET
  const recebido = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!compararSegredo(recebido, esperado)) throw new AppError('UNAUTHENTICATED')

  return withNovoTenant(async (svc) => {
    const { data: tenants, error } = await svc.from('tenants').select('id, timezone').is('deleted_at', null)
    if (error) throw new AppError('INTERNAL', { cause: error })

    let processados = 0
    for (const tenant of tenants ?? []) {
      await recalcularSegmentosDoTenant(svc, tenant.id)
      processados++
    }

    return { tenantsProcessados: processados }
  })
})
