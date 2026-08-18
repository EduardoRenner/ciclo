import { withNovoTenant } from '@/server/db/with-tenant'
import { AppError } from '@/server/http/errors'
import { rota } from '@/server/http/handler'
import { executarCampanhaDiaria } from '@/server/services/campanhas'

/**
 * TICKET-038. Sem hora fixa na especificação — 10h local escolhida por ficar bem dentro da
 * janela permitida (8h-21h, H109) com folga de sobra para qualquer atraso do cron em si.
 * Decisão em `docs/DECISOES.md`. Mesmo padrão do `recompute-cycles` (TICKET-036): dispara a
 * cada 15min, cada tenant só processa quando bate 10h no PRÓPRIO fuso.
 */
export const GET = rota(async (req) => {
  const esperado = process.env.CRON_SECRET
  const recebido = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!esperado || recebido !== esperado) throw new AppError('UNAUTHENTICATED')

  return withNovoTenant(async (svc) => {
    const { data: tenants, error } = await svc.from('tenants').select('id, timezone').is('deleted_at', null)
    if (error) throw new AppError('INTERNAL', { cause: error })

    let tenantsProcessados = 0
    let totalEnviadas = 0
    for (const tenant of tenants ?? []) {
      const horaLocal = Number(
        new Intl.DateTimeFormat('en-US', { timeZone: tenant.timezone, hour: 'numeric', hourCycle: 'h23' }).format(new Date()),
      )
      if (horaLocal !== 10) continue

      // Um tenant com erro (ex.: WhatsApp fora do ar) não pode derrubar a rodada inteira dos
      // outros — cada tenant é isolado, o erro só entra no log estruturado do `rota()`.
      try {
        const resultado = await executarCampanhaDiaria(svc, tenant.id, tenant.timezone)
        totalEnviadas += resultado.queued
      } catch (erro) {
        console.error(JSON.stringify({ level: 'error', event: 'campanha_diaria_falhou', tenantId: tenant.id }), erro)
      }
      tenantsProcessados++
    }

    return { tenantsProcessados, totalEnviadas }
  })
})
