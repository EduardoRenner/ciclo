import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Mesmo mecanismo do `confirmacao-token.ts` (TICKET-030), generalizado: HMAC
 * assinado com `CRON_SECRET` para qualquer link que precise funcionar sem
 * login e sem tabela de token dedicada. `escopo` entra na assinatura para um
 * token de lista de espera nunca ser aceito onde um token de confirmação de
 * agendamento era esperado, mesmo que o id por trás seja parecido.
 *
 * O segredo é parâmetro opcional, não só `process.env` lido direto: testes
 * de arquivos diferentes rodam em threads que compartilham `process.env` no
 * Vitest, então um teste que troca `CRON_SECRET` temporariamente vazava para
 * outro arquivo de teste rodando em paralelo e dependendo do segredo real
 * (foi assim que a suíte inteira pegou isso — passava isolado, falhava
 * junto). Sobrescrever aqui, por injeção, em vez de mutar env global.
 */
function chave(segredo?: string): string {
  const valor = segredo ?? process.env.CRON_SECRET
  if (!valor) throw new Error('CRON_SECRET ausente — sem ele não dá para assinar link sem login.')
  return valor
}

export function gerarTokenAssinado(escopo: string, id: string, validadeHoras: number, segredo?: string): string {
  const exp = Date.now() + validadeHoras * 3_600_000
  const payload = `${escopo}.${id}.${exp}`
  const assinatura = createHmac('sha256', chave(segredo)).update(payload, 'utf8').digest('hex')
  return Buffer.from(`${payload}.${assinatura}`, 'utf8').toString('base64url')
}

export function verificarTokenAssinado(escopo: string, token: string, segredo?: string): string | null {
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

  const esperada = createHmac('sha256', chave(segredo)).update(`${escopoRecebido}.${id}.${expTexto}`, 'utf8').digest('hex')
  const a = Buffer.from(assinaturaRecebida!)
  const b = Buffer.from(esperada)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null

  return id!
}
