import { dataLocalDe, dentroDaJanela, horaLocalDe } from '@/core/cron/janela'
import { withNovoTenant } from '@/server/db/with-tenant'
import { AppError } from '@/server/http/errors'
import { compararSegredo } from '@/server/http/segredo'
import { rota } from '@/server/http/handler'
import { recomputarCiclosDoTenant } from '@/server/services/ciclo'

/**
 * §5.3: "03:00 no fuso de cada tenant". A cada disparo, checa QUAIS tenants estão passando pela
 * madrugada no próprio fuso agora. Rodar `recomputarCiclosDoTenant` de novo pelo mesmo tenant no
 * mesmo dia é inofensivo (upsert por PK, TICKET-036) — a checagem de hora só existe para não
 * gastar processamento à toa, não para garantir corretude.
 *
 * É exatamente por isso que aqui é uma JANELA e não uma igualdade: o agendador atrasa, e trocar
 * exatidão por folga custa só processamento. Em 25/08 a igualdade exata custou o dia inteiro do
 * Motor de Ciclo por 56 minutos de atraso do GitHub. Ver `src/core/cron/janela.ts` e `docs/23` §2.
 */
export const GET = rota(async (req) => {
  const esperado = process.env.CRON_SECRET
  const recebido = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!compararSegredo(recebido, esperado)) throw new AppError('UNAUTHENTICATED')

  return withNovoTenant(async (svc) => {
    const { data: tenants, error } = await svc.from('tenants').select('id, timezone').is('deleted_at', null)
    if (error) throw new AppError('INTERNAL', { cause: error })

    // Um instante só para todos os tenants: com `new Date()` dentro do laço, um tenant avaliado
    // na virada da hora usaria um relógio diferente do vizinho.
    const agora = new Date()

    let processados = 0
    for (const tenant of tenants ?? []) {
      if (!dentroDaJanela(horaLocalDe(tenant.timezone, agora), 3)) continue

      await recomputarCiclosDoTenant(svc, tenant.id, tenant.timezone, dataLocalDe(tenant.timezone, agora))
      processados++
    }

    return { tenantsProcessados: processados }
  })
})
