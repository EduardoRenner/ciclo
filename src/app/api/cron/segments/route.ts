import { withNovoTenant } from '@/server/db/with-tenant'
import { AppError } from '@/server/http/errors'
import { compararSegredo } from '@/server/http/segredo'
import { rota } from '@/server/http/handler'
import { recalcularSegmentosDoTenant } from '@/server/services/segmentos'

/**
 * TICKET-040. 4h local — depois do `recompute-cycles` (3h, TICKET-036) e antes da `campaigns`
 * (10h, TICKET-038), sem disputar o mesmo minuto. Mesmo padrão dos outros crons: dispara a cada
 * 15min, cada tenant só processa quando bate a hora certa no próprio fuso.
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
      const horaLocal = Number(
        new Intl.DateTimeFormat('en-US', { timeZone: tenant.timezone, hour: 'numeric', hourCycle: 'h23' }).format(new Date()),
      )
      if (horaLocal !== 4) continue

      await recalcularSegmentosDoTenant(svc, tenant.id)
      processados++
    }

    return { tenantsProcessados: processados }
  })
})
