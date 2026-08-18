import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Mesmo mecanismo do `confirmacao-token.ts` (TICKET-030), generalizado: HMAC
 * assinado com `CRON_SECRET` para qualquer link que precise funcionar sem
 * login e sem tabela de token dedicada. `escopo` entra na assinatura para um
 * token de lista de espera nunca ser aceito onde um token de confirmação de
 * agendamento era esperado, mesmo que o id por trás seja parecido.
 */
function chave(): string {
  const segredo = process.env.CRON_SECRET
  if (!segredo) throw new Error('CRON_SECRET ausente — sem ele não dá para assinar link sem login.')
  return segredo
}

export function gerarTokenAssinado(escopo: string, id: string, validadeHoras: number): string {
  const exp = Date.now() + validadeHoras * 3_600_000
  const payload = `${escopo}.${id}.${exp}`
  const assinatura = createHmac('sha256', chave()).update(payload, 'utf8').digest('hex')
  return Buffer.from(`${payload}.${assinatura}`, 'utf8').toString('base64url')
}

export function verificarTokenAssinado(escopo: string, token: string): string | null {
  let payload: string
  try {
    payload = Buffer.from(token, 'base64url').toString('utf8')
  } catch {
    return null
  }

  const partes = payload.split('.')
  if (partes.length !== 4) return null
  const [escopoRecebido, id, expTexto, assinaturaRecebida] = partes
  if (escopoRecebido !== escopo) return null

  const exp = Number(expTexto)
  if (!Number.isFinite(exp) || exp < Date.now()) return null

  const esperada = createHmac('sha256', chave()).update(`${escopoRecebido}.${id}.${expTexto}`, 'utf8').digest('hex')
  const a = Buffer.from(assinaturaRecebida!)
  const b = Buffer.from(esperada)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null

  return id!
}
