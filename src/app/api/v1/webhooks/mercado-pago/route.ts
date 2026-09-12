import { lerNotificacaoMP } from '@/core/billing/mercado-pago'
import { verificarAssinaturaWebhook } from '@/server/billing/mercado-pago'
import { withNovoTenant } from '@/server/db/with-tenant'
import { rota } from '@/server/http/handler'
import { processarWebhookMP } from '@/server/services/assinatura-mp'

/**
 * Webhook de status do Mercado Pago (docs/60, G-13) — pagamento falhou → o plano cai sozinho, sem
 * ninguém precisar notar. `criarPreapproval`/`consultarPreapproval`/`decidirPlano` já existiam,
 * prontos e sem chamador; este arquivo é a última peça, a cola que os liga.
 *
 * **Sempre responde 200**, mesmo quando não há o que fazer (evento sem preapproval associado,
 * assinatura não registrada) — devolver erro pro MP pra um evento que só não bateu com nada vira
 * reenvio em loop, mesmo padrão do webhook do WhatsApp. Assinatura inválida é a única rejeição real.
 *
 * Fica inerte sem `MERCADOPAGO_ACCESS_TOKEN`/`MERCADOPAGO_WEBHOOK_SECRET` — mesmo desenho do
 * WhatsApp e do `pg_cron`.
 */
export const POST = rota(async (req) => {
  const url = new URL(req.url)
  const raw = await req.text()

  let corpo: unknown
  try {
    corpo = raw ? JSON.parse(raw) : {}
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }

  // `data.id` chega na query OU no corpo, a depender da versão do evento — `lerNotificacaoMP` já
  // sabe ler o corpo; a assinatura precisa do id bruto antes disso, então a query é conferida à parte.
  const dataIdDaQuery = url.searchParams.get('data.id')
  const evento = lerNotificacaoMP(corpo)
  const dataId = dataIdDaQuery ?? evento?.id ?? null

  const assinaturaValida = verificarAssinaturaWebhook({
    xSignature: req.headers.get('x-signature'),
    xRequestId: req.headers.get('x-request-id'),
    dataId,
  })
  if (!assinaturaValida) return new Response('Invalid signature', { status: 401 })

  if (evento) {
    await withNovoTenant(async (svc) => {
      const resultado = await processarWebhookMP(svc, evento)
      if (resultado.resultado !== 'plano_atualizado') {
        console.warn(JSON.stringify({ level: 'warn', event: 'mp_webhook_sem_acao', resultado: resultado.resultado }))
      }
    })
  }

  return new Response('OK', { status: 200 })
})
