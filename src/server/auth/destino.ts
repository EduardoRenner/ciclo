/**
 * Para onde `/auth/callback` pode mandar alguém depois de trocar o código do
 * e-mail por sessão.
 *
 * É uma lista fechada, e não uma validação de caminho, porque validar é fácil
 * de errar: `/\evil.com` começa com `/`, não começa com `//`, passa por
 * qualquer checagem ingênua — e `new URL()` resolve a barra invertida como se
 * fosse barra, devolvendo `https://evil.com/`. O `next` deste fluxo chega por
 * link de e-mail, que é exatamente o canal de quem quer usar o domínio do CICLO
 * como trampolim. Como só existe um destino de verdade, a lista custa nada.
 */
const DESTINOS = new Set(['/nova-senha', '/onboarding', '/admin/hoje'])

export const DESTINO_PADRAO = '/onboarding'

export function destinoSeguro(next: string | null | undefined): string {
  return next && DESTINOS.has(next) ? next : DESTINO_PADRAO
}
