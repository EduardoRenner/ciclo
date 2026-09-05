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
  } catch (erro) {
    /*
     * Indisponibilidade da hCaptcha não pode travar o booking público — as outras camadas
     * (honeypot, rate limit) seguram sozinhas por um tempo. A decisão de deixar passar está certa;
     * o que estava errado era o SILÊNCIO.
     *
     * Este `catch` engolia timeout, DNS, 5xx e segredo inválido sem deixar rastro. O ramo de cima
     * (`!secret`) registra `hcaptcha_nao_configurado`; este não registrava nada — então uma
     * indisponibilidade prolongada, ou um segredo trocado por engano, viraria "captcha aprovando
     * 100% das tentativas" sem nenhum sinal em lugar nenhum. E "por um tempo", que é a condição
     * que o comentário acima assume, é justamente o que ninguém tinha como medir.
     *
     * É a regra do `CLAUDE.md` aplicada a ela mesma: o `catch` descarta alguma coisa, então tem
     * que contar e avisar.
     */
    console.warn(JSON.stringify({
      level: 'warn',
      event: 'hcaptcha_indisponivel',
      erro: erro instanceof Error ? erro.name : 'desconhecido',
    }))
    return true
  }
}
