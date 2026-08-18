/**
 * G100: hCaptcha invisível no booking público. Sem `HCAPTCHA_SECRET`
 * provisionado (site key/secret vêm de uma conta hCaptcha real, que este
 * projeto ainda não tem), a verificação **deixa passar e registra** — mesmo
 * padrão do HIBP indisponível no TICKET-009: bloquear cadastro de verdade
 * porque um serviço de terceiro não está configurado é pior do que aceitar
 * sem essa camada por enquanto. O honeypot e o rate limit continuam ativos
 * de qualquer forma — não dependem de credencial nenhuma.
 */
export async function verificarCaptcha(token: string | undefined): Promise<boolean> {
  const secret = process.env.HCAPTCHA_SECRET
  if (!secret) {
    console.warn(JSON.stringify({ level: 'warn', event: 'hcaptcha_nao_configurado' }))
    return true
  }

  if (!token) return false

  try {
    const r = await fetch('https://hcaptcha.com/siteverify', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret, response: token }),
      signal: AbortSignal.timeout(3000),
    })
    const { success } = (await r.json()) as { success: boolean }
    return success
  } catch {
    // Indisponibilidade da hCaptcha não pode travar o booking público —
    // as outras camadas (honeypot, rate limit) seguram sozinhas por um tempo.
    return true
  }
}
