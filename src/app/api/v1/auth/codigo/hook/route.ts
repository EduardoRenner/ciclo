import { assinaturaDoHookConfere } from '@/server/auth/assinatura-do-hook'
import { rota } from '@/server/http/handler'
import { WhatsAppCloudProvider } from '@/server/providers/messaging/whatsapp'

/**
 * Hook "Send SMS" do Supabase Auth (docs/110 §2.3). Quem gera, guarda e confere o código é o Auth;
 * esta rota só ENTREGA, pelo WhatsApp oficial, no lugar de um provedor de SMS.
 *
 * O Auth lê só o status: 200 é "entregue"; qualquer outro vira erro para quem pediu o código, e a
 * rota de pedir devolve "não consegui mandar". Nunca 200 sem ter mandado, senão a pessoa espera um
 * código que não vem.
 *
 * Sem credencial do WhatsApp, fora de produção o código vai para o log do servidor, para dar para
 * testar o fluxo inteiro no banco local. Em produção, sem credencial, falha: a regra da casa é a
 * função não fingir que funcionou.
 */
export const POST = rota(async (req) => {
  const corpo = await req.text()

  const confere = assinaturaDoHookConfere({
    segredo: process.env.SEND_SMS_HOOK_SECRET,
    id: req.headers.get('webhook-id'),
    timestamp: req.headers.get('webhook-timestamp'),
    assinatura: req.headers.get('webhook-signature'),
    corpo,
  })
  if (!confere) return erroParaOAuth(401, 'Assinatura do hook não confere.')

  let telefone: string | undefined
  let codigo: string | undefined
  try {
    const payload = JSON.parse(corpo) as { user?: { phone?: string }; sms?: { otp?: string } }
    telefone = payload.user?.phone
    codigo = payload.sms?.otp
  } catch {
    return erroParaOAuth(400, 'Corpo do hook inválido.')
  }
  if (!telefone || !codigo) return erroParaOAuth(400, 'Faltou telefone ou código no hook.')

  const configurado = Boolean(
    process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_APP_SECRET,
  )
  if (!configurado) {
    if (process.env.NODE_ENV === 'production') return erroParaOAuth(503, 'WhatsApp não configurado.')
    console.info(JSON.stringify({ level: 'info', event: 'codigo_de_acesso_so_no_log', final: telefone.slice(-4), codigo }))
    return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } })
  }

  try {
    await new WhatsAppCloudProvider().enviarCodigoDeAcesso({ to: telefone, codigo })
  } catch (erro) {
    console.error(JSON.stringify({ level: 'error', event: 'codigo_de_acesso_nao_enviado', final: telefone.slice(-4) }), erro)
    return erroParaOAuth(502, 'Não consegui mandar o código pelo WhatsApp.')
  }
  return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } })
})

/** O formato de erro que o Auth repassa a quem pediu o código. */
function erroParaOAuth(status: number, mensagem: string): Response {
  return new Response(JSON.stringify({ error: { http_code: status, message: mensagem } }), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}
