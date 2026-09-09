import type { Rule } from 'eslint'

/**
 * As regras próprias moram em `.mjs` porque o ESLint carrega o plugin antes de qualquer
 * transpilação. Esta declaração existe para o TESTE delas poder importá-las com tipo — sem ela,
 * `tsc --noEmit` reprova com TS7016 e a alternativa seria um `@ts-expect-error`, que calaria
 * qualquer outro erro daquela linha junto.
 *
 * A chave é nomeada em vez de `Record<string, …>` de propósito: com índice genérico o
 * `noUncheckedIndexedAccess` devolve `| undefined`, e o teste precisaria de uma checagem em tempo
 * de execução para algo que o compilador já sabe. Nomeando, renomear a regra e esquecer o teste
 * vira erro de typecheck — piso melhor que um `throw`.
 */
declare const plugin: { rules: { 'service-client-confinado': Rule.RuleModule } }

export default plugin
