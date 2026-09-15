/**
 * T1.5 (docs/64-APP-STORE-CAPACITOR-PLANO.md §0.2/§0.7): Apple e Google proíbem qualquer caminho de
 * cobrança dentro do app nativo (guideline 3.1.1) — nenhuma exceção nomeada cobre o CICLO (§0.9,
 * a assinatura desbloqueia módulo DENTRO do app, a definição textual da regra).
 *
 * A única forma confiável de o SERVIDOR distinguir "este pedido veio do app" de "veio do
 * navegador" é um sinal que só o app manda. `capacitor.config.ts` configura o app pra somar
 * `CicloApp` ao final do User-Agent (`appendUserAgent`) — nenhum navegador comum escreve essa
 * string sozinho, e ela nunca aparece numa visita normal ao site.
 *
 * Pura, sem I/O (regra 5 do CLAUDE.md): só recebe a string do header e decide. Quem lê o header de
 * verdade é a rota/página que chama esta função.
 */
export function ehRequisicaoDoAppNativo(userAgent: string | null): boolean {
  if (!userAgent) return false
  return userAgent.includes('CicloApp')
}
