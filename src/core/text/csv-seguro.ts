/**
 * Neutraliza injeção de fórmula (`=CMD(...)`, `@SUM(...)`) num valor que vai virar célula de CSV.
 *
 * `importacao-clientes.ts` (achado S7, auditoria de 2026-08-23) já apontava o risco e adiava a
 * correção: *"isso continua não sendo explorável hoje — não existe nenhuma exportação em CSV
 * neste projeto (...) quando a primeira nascer, o escape tem que ser na ESCRITA da exportação,
 * não aqui"*. Esta é essa exportação.
 *
 * O vetor é real e não depende de a dona do salão digitar nada: `name` de `clients` aceita texto
 * livre e chega por caminhos que ela não controla — agendamento público, importação de CSV de
 * outro sistema. Uma cliente cadastrada com o nome `=HYPERLINK("http://...","clique")` vira uma
 * fórmula viva assim que o Excel abre o arquivo que a própria dona baixou.
 *
 * A defesa padrão (OWASP): se o valor começa com um caractere que o Excel/Sheets interpreta como
 * início de fórmula, prefixa com aspas simples — o programa passa a ler como texto, não como
 * cálculo. `\t` e `\r` entram porque alguns clientes de planilha também disparam por eles no
 * início de campo.
 */
const GATILHOS_DE_FORMULA = new Set(['=', '+', '-', '@', '\t', '\r'])

export function protegerContraFormula(valor: string): string {
  return GATILHOS_DE_FORMULA.has(valor.charAt(0)) ? `'${valor}` : valor
}
