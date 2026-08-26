import { dentroDaJanela, horaLocalDe } from '@/core/cron/janela'
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
 * Decisão em `docs/DECISOES.md`.
 *
 * A frase "dispara a cada 15min, cada tenant processa quando bate 10h no próprio fuso" estava
 * aqui e descrevia um mundo que não existe mais: o agendador virou GitHub Actions, com UM disparo
 * por horário e atraso medido de 36 a 56 minutos (`docs/24` §6.5). Igualdade exata de hora nesse
 * mundo é o defeito que zerou o Motor de Ciclo por dois dias — e ele continuava intacto aqui,
 * esperando o dia em que alguém ligasse o `schedule` desta rota. Agora é janela
 * (`src/core/cron/janela.ts`), como as outras duas.
 *
 * Reprocessar o mesmo tenant duas vezes na janela é inofensivo: `enviarParaRecuperar` só manda
 * para quem está fora do `DIAS_ENTRE_CAMPANHAS` desde o `last_campaign_at`, então a segunda
 * passada do dia devolve `rate_limited` para todo mundo que a primeira já pegou.
 */
export const GET = rota(async (req) => {
  const esperado = process.env.CRON_SECRET
  const recebido = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!compararSegredo(recebido, esperado)) throw new AppError('UNAUTHENTICATED')

  return withNovoTenant(async (svc) => {
    const { data: tenants, error } = await svc.from('tenants').select('id, timezone, slug, settings').is('deleted_at', null)
    if (error) throw new AppError('INTERNAL', { cause: error })

    // Um `agora` só para a rodada inteira: com `new Date()` dentro do laço, um lote grande pode
    // atravessar a virada de hora e tratar dois tenants do mesmo fuso de formas diferentes.
    const agora = new Date()
    let tenantsProcessados = 0
    let totalEnviadas = 0
    for (const tenant of tenants ?? []) {
      // Tenant de demonstração não tem cliente de verdade do outro lado do telefone.
      if (ehDemonstracao(tenant.slug)) continue
      // Interruptor manual do dono (F0, docs/25-ESTRATEGIA-E-EXECUCAO.md).
      if (lerMensageria(tenant.settings).paused) continue

      if (!dentroDaJanela(horaLocalDe(tenant.timezone, agora), 10)) continue

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
