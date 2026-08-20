import { createHmac, timingSafeEqual } from 'node:crypto'

import { ErroDeEnvio, type EnvioTemplate, type EnvioTexto, type EventoWebhook, type MessagingProvider } from './types'

const VERSAO_GRAPH = 'v20.0'
// Sem isso, uma conexão que trava (não um erro — o servidor simplesmente não responde)
// prende `enviarComFallback` (chamado direto, sem `void`, pelos crons de lembrete/lista
// de espera/recuperação) até o timeout da própria função serverless, travando o resto do
// lote atrás dela. `mensageria.ts` já trata qualquer erro lançado aqui como transitório
// e cai para push/e-mail — só faltava o fetch desistir sozinho.
const TIMEOUT_MS = 10_000

type ConfigWhatsApp = {
  phoneNumberId: string
  accessToken: string
  appSecret: string
}

function config(): ConfigWhatsApp {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN
  const appSecret = process.env.WHATSAPP_APP_SECRET
  if (!phoneNumberId || !accessToken || !appSecret) {
    throw new Error('WhatsApp Cloud API não configurado — falta WHATSAPP_PHONE_NUMBER_ID/ACCESS_TOKEN/APP_SECRET.')
  }
  return { phoneNumberId, accessToken, appSecret }
}

/**
 * Implementação real da Cloud API da Meta. Sem credencial (`WHATSAPP_ACCESS_
 * TOKEN` etc. vazios neste projeto — precisam de um WhatsApp Business
 * verificado), toda chamada estoura no `config()` acima, e é isso que empurra
 * `enviarComFallback()` para o e-mail. O código está correto para quando a
 * conta existir; não dá para testar "template enviado em sandbox" sem ela.
 */
export class WhatsAppCloudProvider implements MessagingProvider {
  async sendTemplate({ to, template, params, buttons }: EnvioTemplate): Promise<{ providerId: string }> {
    const { phoneNumberId, accessToken } = config()

    const parametros = Object.values(params).map((valor) => ({ type: 'text', text: valor }))
    const components: Record<string, unknown>[] = parametros.length > 0 ? [{ type: 'body', parameters: parametros }] : []
    if (buttons) {
      buttons.forEach((b, i) => {
        components.push({ type: 'button', sub_type: 'quick_reply', index: String(i), parameters: [{ type: 'payload', payload: b.id }] })
      })
    }

    const r = await fetch(`https://graph.facebook.com/${VERSAO_GRAPH}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: { name: template, language: { code: 'pt_BR' }, components },
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })

    const json = (await r.json()) as { messages?: { id: string }[]; error?: { message: string; code: number } }
    if (!r.ok || !json.messages?.[0]) {
      // Códigos 131047/132000-ish da Meta são "template não existe/reprovado";
      // qualquer outra coisa (rede, 5xx) é transitória. Sem a lista oficial à
      // mão, a distinção fica pelo texto — falha de leitura aqui só faz o
      // fallback disparar cedo demais, nunca tarde demais.
      const rejeitado = /template/i.test(json.error?.message ?? '')
      throw new ErroDeEnvio(json.error?.message ?? 'Falha ao enviar template.', rejeitado ? 'template_rejeitado' : 'falha_transitoria')
    }

    return { providerId: json.messages[0].id }
  }

  async sendText({ to, body }: EnvioTexto): Promise<{ providerId: string }> {
    const { phoneNumberId, accessToken } = config()

    const r = await fetch(`https://graph.facebook.com/${VERSAO_GRAPH}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body } }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })

    const json = (await r.json()) as { messages?: { id: string }[]; error?: { message: string } }
    if (!r.ok || !json.messages?.[0]) {
      throw new ErroDeEnvio(json.error?.message ?? 'Falha ao enviar texto.', 'falha_transitoria')
    }
    return { providerId: json.messages[0].id }
  }

  parseWebhook(raw: string, signature: string): EventoWebhook {
    const { appSecret } = config()

    const esperado = `sha256=${createHmac('sha256', appSecret).update(raw, 'utf8').digest('hex')}`
    const a = Buffer.from(signature)
    const b = Buffer.from(esperado)
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new Error('Assinatura do webhook do WhatsApp inválida.')
    }

    const payload = JSON.parse(raw) as {
      entry?: {
        changes?: {
          value?: {
            messages?: { from: string; text?: { body: string }; timestamp: string }[]
            statuses?: { id: string; status: string; errors?: { message: string }[] }[]
          }
        }[]
      }[]
    }

    const valor = payload.entry?.[0]?.changes?.[0]?.value
    const mensagem = valor?.messages?.[0]
    if (mensagem) {
      return {
        kind: 'inbound',
        from: mensagem.from,
        body: mensagem.text?.body ?? '',
        receivedAt: new Date(Number(mensagem.timestamp) * 1000).toISOString(),
      }
    }

    const status = valor?.statuses?.[0]
    if (status) {
      return {
        kind: 'status',
        providerId: status.id,
        status: (['sent', 'delivered', 'read', 'failed'] as const).includes(status.status as never)
          ? (status.status as 'sent' | 'delivered' | 'read' | 'failed')
          : 'failed',
        error: status.errors?.[0]?.message,
      }
    }

    throw new Error('Webhook do WhatsApp sem mensagem nem status reconhecido.')
  }
}
