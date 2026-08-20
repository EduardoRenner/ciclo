import { ErroDeEnvio } from './types'

/**
 * O e-mail do fallback (H108/§4: "cair para push e, se não houver, e-mail").
 * Não implementa `MessagingProvider` inteiro — não faz sentido mandar
 * "template" ou receber webhook do WhatsApp por e-mail; só o envio mesmo,
 * chamado depois que o WhatsApp já falhou 3 vezes.
 */
export async function enviarEmailDeFallback(i: { to: string; subject: string; body: string }): Promise<{ providerId: string }> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM
  if (!apiKey || !from) {
    throw new Error('Fallback de e-mail não configurado — falta RESEND_API_KEY/EMAIL_FROM.')
  }

  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from, to: i.to, subject: i.subject, text: i.body }),
    // Este é o último elo da corrente de fallback — se travar sem prazo, "nunca deixar
    // o lembrete sumir em silêncio" (§4) vira "trava em silêncio", pior que uma falha.
    signal: AbortSignal.timeout(10_000),
  })

  const json = (await r.json()) as { id?: string; message?: string }
  if (!r.ok || !json.id) throw new ErroDeEnvio(json.message ?? 'Falha ao enviar e-mail.', 'falha_transitoria')
  return { providerId: json.id }
}
