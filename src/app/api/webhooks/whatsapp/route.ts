import { WhatsAppCloudProvider } from '@/server/providers/messaging/whatsapp'
import { withNovoTenant } from '@/server/db/with-tenant'
import { rota } from '@/server/http/handler'
import { processarMensagemRecebida, processarStatusDeEntrega } from '@/server/services/whatsapp-inbound'

/**
 * Webhook de entrada do WhatsApp (docs/60, T-01) — "CONFIRMAR"/"CANCELAR" fecham o loop de
 * lembrete sem custar nada (a resposta cai na janela de 24h grátis da Meta).
 *
 * **Fica inerte sem credencial**, mesmo desenho do Mercado Pago e do `pg_cron`: sem
 * `WHATSAPP_APP_SECRET`/`WHATSAPP_VERIFY_TOKEN` configurados, o `GET` nunca completa o aperto de
 * mão que a Meta exige pra ativar a assinatura, e o `POST` nunca é chamado por ninguém.
 */
const provider = new WhatsAppCloudProvider()

/**
 * A Meta bate aqui UMA VEZ, ao configurar a assinatura do webhook no painel dela, pra provar que
 * quem está do outro lado é dono do endereço. `hub.challenge` tem que voltar em texto puro — a
 * Meta não aceita JSON aqui, por isso o bypass do envelope (`rota()` deixa passar `Response` direto).
 */
export const GET = rota(async (req) => {
  const url = new URL(req.url)
  const modo = url.searchParams.get('hub.mode')
  const token = url.searchParams.get('hub.verify_token')
  const challenge = url.searchParams.get('hub.challenge')

  const esperado = process.env.WHATSAPP_VERIFY_TOKEN
  if (modo === 'subscribe' && esperado && token === esperado && challenge) {
    return new Response(challenge, { status: 200, headers: { 'content-type': 'text/plain' } })
  }

  return new Response('Forbidden', { status: 403 })
})

/**
 * O corpo tem que ser lido como TEXTO CRU antes de qualquer `JSON.parse` — a assinatura HMAC que
 * `parseWebhook` confere é sobre os bytes exatos que a Meta mandou, não sobre um objeto
 * reserializado (reserializar pode mudar espaçamento e invalidar a assinatura mesmo com o
 * conteúdo idêntico).
 *
 * Sempre responde 200 pra Meta, mesmo quando não reconhece a palavra ou não acha o agendamento —
 * webhook que devolve erro pra payload que só não bateu com nada vira reenvio automático da Meta,
 * em loop. Assinatura inválida é a ÚNICA coisa que rejeita de verdade (indica forjado, não payload
 * legítimo que não deu em nada).
 */
export const POST = rota(async (req) => {
  const raw = await req.text()
  const assinatura = req.headers.get('x-hub-signature-256') ?? ''

  let evento
  try {
    evento = provider.parseWebhook(raw, assinatura)
  } catch {
    return new Response('Invalid signature', { status: 401 })
  }

  await withNovoTenant(async (svc) => {
    if (evento.kind === 'inbound') {
      const resultado = await processarMensagemRecebida(svc, evento)
      if (resultado.resultado === 'ambiguo' || resultado.resultado === 'sem_correlacao' || resultado.resultado === 'nao_reconhecido') {
        // Não é erro — é o caminho seguro de "não adivinhar". Fica no log pra alguém humano ver,
        // já que hoje não existe caixa de entrada nenhuma pra mensagem de cliente no produto.
        console.warn(JSON.stringify({ level: 'warn', event: 'whatsapp_inbound_sem_acao', resultado: resultado.resultado }))
      }
    } else {
      await processarStatusDeEntrega(svc, evento)
    }
  })

  return new Response('OK', { status: 200 })
})
