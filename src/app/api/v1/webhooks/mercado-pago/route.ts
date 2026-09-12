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
 * Responde 200 quando o evento é válido mas não há o que fazer (sem preapproval associado,
 * assinatura não registrada, valor não confere) — devolver erro pro MP por um evento que só não
 * bateu com nada vira reenvio em loop, mesmo padrão do webhook do WhatsApp. Assinatura inválida é a
 * única rejeição por CONTEÚDO (401). Uma falha de verdade ao falar com a API do MP (rede, token
 * inválido, resposta inesperada) propaga como erro do `rota()` — isso é o que faz o MP tentar de
 * novo mais tarde, o comportamento certo para uma falha transitória, diferente de um evento que
 * simplesmente não corresponde a nada no nosso lado.
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
