import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Confere a assinatura que o Supabase Auth põe nos hooks HTTP (padrão Standard Webhooks):
 * `webhook-signature: v1,<base64 do HMAC-SHA256 de "id.timestamp.corpo">`, com a chave vinda de
 * `v1,whsec_<base64>`.
 *
 * O hook de envio do código manda mensagem paga em nome do CICLO para o número que vier no corpo.
 * Sem esta conferência, qualquer um que achasse a URL mandaria WhatsApp para quem quisesse, por
 * nossa conta.
 *
 * `agora` e a tolerância existem para recusar reenvio de uma chamada antiga capturada: 5 minutos,
 * o mesmo da biblioteca de referência do padrão.
 */
export function assinaturaDoHookConfere(entrada: {
  segredo: string | undefined
  id: string | null
  timestamp: string | null
  assinatura: string | null
  corpo: string
  agora?: number
}): boolean {
  const { segredo, id, timestamp, assinatura, corpo } = entrada
  if (!segredo || !id || !timestamp || !assinatura) return false

  const chaveBase64 = segredo.replace(/^v1,/, '').replace(/^whsec_/, '')
  const chave = Buffer.from(chaveBase64, 'base64')
  if (chave.length === 0) return false

  const segundos = Number(timestamp)
  const agora = Math.floor((entrada.agora ?? Date.now()) / 1000)
  if (!Number.isFinite(segundos) || Math.abs(agora - segundos) > 300) return false

  const esperada = createHmac('sha256', chave).update(`${id}.${timestamp}.${corpo}`).digest()

  // O cabeçalho pode trazer várias assinaturas separadas por espaço (troca de chave em curso).
  return assinatura.split(' ').some((parte) => {
    const [versao, valor] = parte.split(',')
    if (versao !== 'v1' || !valor) return false
    const recebida = Buffer.from(valor, 'base64')
    return recebida.length === esperada.length && timingSafeEqual(recebida, esperada)
  })
}
