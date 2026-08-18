import { withNovoTenant } from '@/server/db/with-tenant'
import { AppError } from '@/server/http/errors'
import { rota } from '@/server/http/handler'
import { listarAlertasDeEstoque } from '@/server/services/alertas-estoque'

/**
 * §7: `stock_alerts` roda às 07:00 diário por fuso. A tela Hoje já calcula o mesmo alerta ao
 * vivo a cada carregamento (`resumoDeHoje`) — este job não é a fonte da verdade, é só o registro
 * estruturado (log) que existe pro dono acompanhar por fora do app e para o histórico de
 * auditoria mencionado em §5.6 (bloqueio de validade "com override registrado em auditoria").
 */
export const GET = rota(async (req) => {
  const esperado = process.env.CRON_SECRET
  const recebido = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!esperado || recebido !== esperado) throw new AppError('UNAUTHENTICATED')

  return withNovoTenant(async (svc) => {
    const { data: tenants, error } = await svc.from('tenants').select('id, timezone').is('deleted_at', null)
    if (error) throw new AppError('INTERNAL', { cause: error })

    let tenantsProcessados = 0
    let totalAlertas = 0
    for (const tenant of tenants ?? []) {
      const horaLocal = Number(
        new Intl.DateTimeFormat('en-US', { timeZone: tenant.timezone, hour: 'numeric', hourCycle: 'h23' }).format(new Date()),
      )
      if (horaLocal !== 7) continue

      const hojeLocal = new Intl.DateTimeFormat('en-CA', { timeZone: tenant.timezone }).format(new Date())
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
