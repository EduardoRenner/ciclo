import webpush from 'web-push'

import { ErroDeEnvio } from './types'

export type InscricaoPush = { endpoint: string; p256dh: string; auth: string }
export type PayloadPush = { title: string; body: string; url?: string }

let vapidConfigurado = false

/** Preguiçoso de propósito: só falha (avisando, nunca travando) na hora de mandar, não na hora de importar o módulo. */
function garantirVapid(): boolean {
  if (vapidConfigurado) return true

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT

  if (!publicKey || !privateKey || !subject) {
    console.warn(JSON.stringify({ level: 'warn', event: 'push_vapid_nao_configurado' }))
    return false
  }

  webpush.setVapidDetails(subject, publicKey, privateKey)
  vapidConfigurado = true
  return true
}

/**
 * TICKET-056. O envio de verdade — chamado de dentro de `enviarComFallback`
 * (§4 do briefing: "cair para push e, se não houver, e-mail"). Sem VAPID
 * configurado, lança `falha_transitoria` — o chamador já sabe cair pro
 * próximo canal, é o mesmo comportamento de um provider indisponível.
 */
export async function enviarPush(inscricao: InscricaoPush, payload: PayloadPush): Promise<{ providerId: string }> {
  if (!garantirVapid()) throw new ErroDeEnvio('Push não configurado — falta VAPID_PRIVATE_KEY/NEXT_PUBLIC_VAPID_PUBLIC_KEY.', 'falha_transitoria')

  try {
    const resultado = await webpush.sendNotification(
      { endpoint: inscricao.endpoint, keys: { p256dh: inscricao.p256dh, auth: inscricao.auth } },
      JSON.stringify(payload),
      // Mesmo raciocínio do WhatsApp/e-mail (ver whatsapp.ts): sem prazo, um endpoint que
      // trava em vez de responder prende o lote inteiro de lembretes atrás dele.
      { timeout: 10_000 },
    )
    // O `web-push` não devolve id de mensagem (não é um conceito do protocolo Web Push) —
    // o endpoint em si já identifica o destino, então serve de `providerId` para o registro
    // em `messages.provider_id` (mesmo formato que os outros providers preenchem).
    return { providerId: `push.${resultado.statusCode}.${inscricao.endpoint.slice(-12)}` }
  } catch (erro) {
    const codigo = (erro as { statusCode?: number }).statusCode
    // 404/410 = inscrição morta (navegador desinstalou, permissão revogada). Quem chama
    // decide se apaga a linha — este módulo só sabe que o envio falhou.
    const motivo = codigo === 404 || codigo === 410 ? 'template_rejeitado' : 'falha_transitoria'
    throw new ErroDeEnvio(erro instanceof Error ? erro.message : 'Falha ao enviar push.', motivo)
  }
}
