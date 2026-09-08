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

/**
 * Para onde o LOGIN pode mandar alguém depois de autenticar.
 *
 * Achado da auditoria de 2026-09-08: `?proximo=` ia cru para `router.push` em
 * `entrar/formulario.tsx` e `verificar/formulario.tsx`. `router.push` navega para URL externa,
 * então `https://<dominio>/entrar?proximo=https://evil.com/entrar` autenticava a pessoa no
 * domínio de verdade e a jogava num clone logo depois — no instante de maior confiança da sessão,
 * quando ela acabou de digitar a senha e espera ver o painel.
 *
 * **Por que não dá para reusar `destinoSeguro` aqui.** Aquela lista é fechada com três destinos
 * porque o `/auth/callback` só tem esses três. O login é outro caso: o `proximo` nasce em
 * `middleware.ts:240` como `req.nextUrl.pathname`, ou seja, QUALQUER rota do painel que a pessoa
 * tentou abrir antes de ser mandada para o login. Passar isso pela lista fechada mandaria quem
 * clicou em `/admin/clientes` para `/onboarding` — conserto que quebra o produto não é conserto.
 *
 * **Por que resolver com `new URL` e comparar a origem, em vez de checar o prefixo.** É a mesma
 * armadilha que o comentário de `DESTINOS` descreve, e ela morde aqui igual: `/\evil.com` começa
 * com `/`, não começa com `//`, e passa por qualquer checagem ingênua de prefixo — mas o
 * navegador resolve a barra invertida como barra e sai em `https://evil.com/`. Comparar a origem
 * depois de resolver é a única leitura que enxerga isso, porque usa a mesma normalização que o
 * navegador vai usar na hora de navegar.
 *
 * Devolve caminho + query e descarta o resto: âncora e credencial embutida não têm o que fazer
 * num destino de redirecionamento.
 */
const BASE_INTERNA = 'https://interno.invalid'

export function caminhoInternoSeguro(proximo: string | null | undefined, padrao = '/admin/hoje'): string {
  if (!proximo || !proximo.startsWith('/')) return padrao

  try {
    const url = new URL(proximo, BASE_INTERNA)
    // Se a resolução saiu da origem interna, o candidato apontava para fora — mesmo tendo
    // começado com `/`.
    if (url.origin !== BASE_INTERNA) return padrao
    return `${url.pathname}${url.search}`
  } catch {
    return padrao
  }
}
