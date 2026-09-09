import { lerNotificacaoMP } from '@/core/billing/mercado-pago'
import { verificarAssinaturaWebhook } from '@/server/billing/mercado-pago'
import { withNovoTenant } from '@/server/db/with-tenant'
import { AppError } from '@/server/http/errors'
import { rota } from '@/server/http/handler'
import { aplicarEventoDeAssinatura } from '@/server/services/assinatura'

/**
 * `docs/57` PR 1.2. O Mercado Pago bate aqui a cada mudança de assinatura/pagamento.
 *
 * **Pública** (sem sessão — como `/api/cron/*`). A defesa é a assinatura `x-signature`, verificada
 * antes de tocar em qualquer coisa. `rota()` já não checa `Origin` quando o header falta, que é o
 * caso de todo webhook servidor-a-servidor.
 *
 * **Sempre responde 200 quando a assinatura é válida** — mesmo para evento que não interessa. Um
 * 4xx faz o MP retentar o MESMO evento por dias; o único 4xx aqui é assinatura inválida (401).
 *
 * O `data.id` pode vir na query (`?data.id=`) ou no corpo (`data.id`) — o manifesto da assinatura
 * usa o mesmo valor, então os dois têm que sair da mesma fonte. Preferimos a query (é o que o MP
 * assina) e caímos no corpo.
 */
export const POST = rota(async (req) => {
  const url = new URL(req.url)
  const dataIdQuery = url.searchParams.get('data.id') ?? url.searchParams.get('id')

  const corpo: unknown = await req.json().catch(() => null)
  const dataIdCorpo =
    corpo && typeof corpo === 'object' && typeof (corpo as { data?: { id?: unknown } }).data?.id === 'string'
      ? (corpo as { data: { id: string } }).data.id
      : null
  const dataId = dataIdQuery ?? dataIdCorpo

  const assinaturaOk = verificarAssinaturaWebhook({
    xSignature: req.headers.get('x-signature'),
    xRequestId: req.headers.get('x-request-id'),
    dataId,
  })
  if (!assinaturaOk) throw new AppError('UNAUTHENTICATED', { message: 'Assinatura do webhook inválida.' })

  const evento = lerNotificacaoMP(corpo)
  if (!evento) return { recebido: true, aplicado: false, motivo: 'evento não reconhecido' }

  const r = await withNovoTenant((svc) => aplicarEventoDeAssinatura(svc, evento))
  return { recebido: true, aplicado: r.resultado === 'aplicado', motivo: r.motivo }
})
