import { dentroDaJanela, horaLocalDe } from '@/core/cron/janela'
import { withNovoTenant } from '@/server/db/with-tenant'
import { AppError } from '@/server/http/errors'
import { compararSegredo } from '@/server/http/segredo'
import { rota } from '@/server/http/handler'
import { recalcularSegmentosDoTenant } from '@/server/services/segmentos'

/**
 * TICKET-040. 4h local — depois do `recompute-cycles` (3h, TICKET-036) e antes da `campaigns`
 * (10h, TICKET-038). Cada tenant só processa quando o próprio fuso entra na janela.
 *
 * Janela em vez de igualdade pelo motivo de `src/core/cron/janela.ts`: o agendador atrasa. A
 * folga faz as duas janelas se sobreporem em parte, e isso é seguro porque o recálculo de
 * segmento não lê `client_cycles` — as duas rotas não disputam o mesmo dado.
 */
export const GET = rota(async (req) => {
  const esperado = process.env.CRON_SECRET
  const recebido = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!compararSegredo(recebido, esperado)) throw new AppError('UNAUTHENTICATED')

  return withNovoTenant(async (svc) => {
    const { data: tenants, error } = await svc.from('tenants').select('id, timezone').is('deleted_at', null)
    if (error) throw new AppError('INTERNAL', { cause: error })

    const agora = new Date()

    let processados = 0
    for (const tenant of tenants ?? []) {
      if (!dentroDaJanela(horaLocalDe(tenant.timezone, agora), 4)) continue

      await recalcularSegmentosDoTenant(svc, tenant.id)
      processados++
    }

    return { tenantsProcessados: processados }
  })
})
