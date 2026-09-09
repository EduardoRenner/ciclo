import { withNovoTenant } from '@/server/db/with-tenant'
import { AppError } from '@/server/http/errors'
import { compararSegredo } from '@/server/http/segredo'
import { rota } from '@/server/http/handler'
import { expirarGracaVencida } from '@/server/services/assinatura'

/**
 * `docs/57` Bloco 3.1. Quando o pagamento de uma assinatura falha, o MP marca `paused` e o
 * `aplicarEventoDeAssinatura` grava `settings.assinatura.graca_ate = hoje + 7 dias` — o degrau
 * segue de pé até lá. Este job derruba para `gratis` as assinaturas cuja graça já venceu.
 *
 * Não olha hora do dia (graça vence por DATA, não por horário), e `expirarGracaVencida` já varre
 * todos os tenants de uma vez — a rota só a chama. Roda 1×/dia; o agendador é externo
 * (cron-job.org, um 3º job — ver `docs/runbooks/cron-externo.md`).
 *
 * Sem heartbeat de propósito: enquanto ninguém tiver assinatura, não há o que derrubar, e um
 * heartbeat que nunca bate deixaria o `/api/health` vermelho para sempre (a armadilha de
 * `src/core/cron/agendadas.ts`). Entra em `ROTAS_AGENDADAS` no dia em que o MP estiver ligado.
 */
export const GET = rota(async (req) => {
  const esperado = process.env.CRON_SECRET
  const recebido = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!compararSegredo(recebido, esperado)) throw new AppError('UNAUTHENTICATED')

  const assinaturasDerrubadas = await withNovoTenant((svc) => expirarGracaVencida(svc, new Date()))
  return { assinaturasDerrubadas }
})
