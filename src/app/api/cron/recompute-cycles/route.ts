import { withNovoTenant } from '@/server/db/with-tenant'
import { AppError } from '@/server/http/errors'
import { compararSegredo } from '@/server/http/segredo'
import { rota } from '@/server/http/handler'
import { recomputarCiclosDoTenant } from '@/server/services/ciclo'

/**
 * §5.3: "03:00 no fuso de cada tenant". O cron do Vercel só sabe rodar em
 * UTC — dispara a cada 15min (vercel.json) e, a cada disparo, checa QUAL
 * tenant está passando pelas 3h da madrugada no próprio fuso agora. Rodar
 * `recomputarCiclosDoTenant` de novo pelo mesmo tenant no mesmo dia é
 * inofensivo (upsert por PK, TICKET-036) — a checagem de hora só existe para
 * não gastar processamento à toa, não para garantir corretude.
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
      if (horaLocal !== 3) continue

      const hojeLocal = new Intl.DateTimeFormat('en-CA', { timeZone: tenant.timezone }).format(new Date()) // en-CA = YYYY-MM-DD
      await recomputarCiclosDoTenant(svc, tenant.id, tenant.timezone, hojeLocal)
      processados++
    }

    return { tenantsProcessados: processados }
  })
})
