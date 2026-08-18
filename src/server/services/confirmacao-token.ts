import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * TICKET-030: "botão confirma sem login". O link do lembrete precisa
 * funcionar sem sessão — igual a `criarConvite` (TICKET-017), mas mais leve:
 * confirmar um agendamento não precisa de revogação (o link perde a validade
 * sozinho quando o agendamento sai de `pending`, checado no momento do uso,
 * não no token), então não abre tabela nova — é HMAC assinado com
 * `CRON_SECRET`, que já existe e já é "segredo só do servidor".
 */
function chave(): string {
  const segredo = process.env.CRON_SECRET
  if (!segredo) throw new Error('CRON_SECRET ausente — sem ele não dá para assinar link de confirmação.')
  return segredo
}

const VALIDADE_HORAS = 72 // cobre folga de sobra além do D-0 T-3h mais tardio

export function gerarTokenConfirmacao(appointmentId: string): string {
  const exp = Date.now() + VALIDADE_HORAS * 3_600_000
  const payload = `${appointmentId}.${exp}`
  const assinatura = createHmac('sha256', chave()).update(payload, 'utf8').digest('hex')
  return Buffer.from(`${payload}.${assinatura}`, 'utf8').toString('base64url')
}

export function verificarTokenConfirmacao(token: string): string | null {
  let payload: string
  try {
    payload = Buffer.from(token, 'base64url').toString('utf8')
  } catch {
    return null
  }

  const partes = payload.split('.')
  if (partes.length !== 3) return null
  const [appointmentId, expTexto, assinaturaRecebida] = partes

  const exp = Number(expTexto)
  if (!Number.isFinite(exp) || exp < Date.now()) return null

  const esperada = createHmac('sha256', chave()).update(`${appointmentId}.${expTexto}`, 'utf8').digest('hex')
  const a = Buffer.from(assinaturaRecebida!)
  const b = Buffer.from(esperada)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null

  return appointmentId!
}
