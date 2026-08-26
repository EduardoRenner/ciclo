import { ehDemonstracao } from '@/core/tenants/demonstracao'
import { withNovoTenant } from '@/server/db/with-tenant'
import { AppError } from '@/server/http/errors'
import { compararSegredo } from '@/server/http/segredo'
import { rota } from '@/server/http/handler'
import { executarCampanhaDiaria } from '@/server/services/campanhas'
import { registrarHeartbeat } from '@/server/services/health'
import { lerMensageria } from '@/server/services/site'

/**
 * TICKET-038. Sem hora fixa na especificação — 10h local escolhida por ficar bem dentro da
 * janela permitida (8h-21h, H109) com folga de sobra para qualquer atraso do cron em si.
 * Decisão em `docs/DECISOES.md`. Mesmo padrão do `recompute-cycles` (TICKET-036): dispara a
 * cada 15min, cada tenant só processa quando bate 10h no PRÓPRIO fuso.
 */
export const GET = rota(async (req) => {
  const esperado = process.env.CRON_SECRET
  const recebido = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!compararSegredo(recebido, esperado)) throw new AppError('UNAUTHENTICATED')

  return withNovoTenant(async (svc) => {
    const { data: tenants, error } = await svc.from('tenants').select('id, timezone, slug, settings').is('deleted_at', null)
    if (error) throw new AppError('INTERNAL', { cause: error })

    let tenantsProcessados = 0
    let totalEnviadas = 0
    for (const tenant of tenants ?? []) {
      // Tenant de demonstração não tem cliente de verdade do outro lado do telefone.
      if (ehDemonstracao(tenant.slug)) continue
      // Interruptor manual do dono (F0, docs/25-ESTRATEGIA-E-EXECUCAO.md).
      if (lerMensageria(tenant.settings).paused) continue

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

    // Incondicional — tick sem nenhum tenant na hora certa ainda conta como "rodou" (mesmo
    // padrão de `reminders/route.ts`), senão o heartbeat vira falso-negativo em dia sem tenant.
    await registrarHeartbeat(svc, 'send_campaigns')

    return { tenantsProcessados, totalEnviadas }
  })
})
