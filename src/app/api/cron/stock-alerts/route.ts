import { dataLocalDe, dentroDaJanela, horaLocalDe } from '@/core/cron/janela'
import { withNovoTenant } from '@/server/db/with-tenant'
import { AppError } from '@/server/http/errors'
import { compararSegredo } from '@/server/http/segredo'
import { rota } from '@/server/http/handler'
import { listarAlertasDeEstoque } from '@/server/services/alertas-estoque'

/**
 * §7: `stock_alerts` roda às 07:00 diário por fuso. A tela Hoje já calcula o mesmo alerta ao
 * vivo a cada carregamento (`resumoDeHoje`) — este job não é a fonte da verdade, é só o registro
 * estruturado (log) que existe pro dono acompanhar por fora do app e para o histórico de
 * auditoria mencionado em §5.6 (bloqueio de validade "com override registrado em auditoria").
 *
 * Hora em JANELA e não em igualdade, pelo mesmo motivo de `src/core/cron/janela.ts`: esta rota
 * hoje só existe no `workflow_dispatch`, e a igualdade exata é justamente o defeito que fica
 * escondido até alguém pôr a rota no `schedule` — aí ela devolve 200 com zero processados e o job
 * fica verde. Repetir a passada no mesmo dia custa uma linha de log a mais e nada além disso.
 */
export const GET = rota(async (req) => {
  const esperado = process.env.CRON_SECRET
  const recebido = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!compararSegredo(recebido, esperado)) throw new AppError('UNAUTHENTICATED')

  return withNovoTenant(async (svc) => {
    const { data: tenants, error } = await svc.from('tenants').select('id, timezone').is('deleted_at', null)
    if (error) throw new AppError('INTERNAL', { cause: error })

    // Um `agora` só para a rodada inteira — ver o mesmo comentário em `campaigns/route.ts`.
    const agora = new Date()
    let tenantsProcessados = 0
    let totalAlertas = 0
    for (const tenant of tenants ?? []) {
      if (!dentroDaJanela(horaLocalDe(tenant.timezone, agora), 7)) continue

      const hojeLocal = dataLocalDe(tenant.timezone, agora)
      const alertas = await listarAlertasDeEstoque(svc, tenant.id, hojeLocal)
      if (alertas.length > 0) {
        console.log(JSON.stringify({ level: 'info', event: 'stock_alerts', tenantId: tenant.id, count: alertas.length }))
      }
      totalAlertas += alertas.length
      tenantsProcessados++
    }

    return { tenantsProcessados, totalAlertas }
  })
})
