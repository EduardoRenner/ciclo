/**
 * Codigo-fonte sem os comentarios, para guarda de varredura casar com o que EXECUTA.
 *
 * Existe porque a armadilha aconteceu tres vezes em 31/08, sempre igual: a guarda reprova casando
 * com a palavra proibida dentro do COMENTARIO que explica por que ela e proibida. "R$ 49" no
 * comentario do `llms.txt`, `visits_count` no comentario do `fidelidade.ts`, "gastou" no comentario
 * JSX da tela de campanhas. E a armadilha nº1 da tabela do CLAUDE.md — casar com algo que o arquivo
 * contem por outro motivo.
 *
 * Mora aqui porque havia CINCO copias disso espalhadas pelos testes, com implementacoes
 * diferentes. As tres antigas estavam certas por acidente feliz: remover `/* ... *\/` tambem apaga
 * o miolo de `{/* ... *\/}`. As duas escritas hoje filtravam por PREFIXO DE LINHA e por isso eram
 * cegas a comentario JSX, cujas linhas internas nao comecam com `*`. Cinco copias divergentes de
 * uma regra e a mesma armadilha de "duas fontes da mesma verdade" que este projeto persegue no
 * produto — aplicada a ferramenta que faz a perseguicao.
 *
 * A ordem importa: `{/* ... *\/}` sai primeiro, inteiro (chaves incluidas), para nao deixar `{` e
 * `}` orfaos no meio de JSX.
 */
export function semComentarios(fonte: string): string {
  return fonte
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ')
}

/**
 * O mesmo para SQL, onde o comentario e `--` e nao `//`.
 *
 * Nao da para reusar o de cima, e a diferenca que importa nao e o traco: e a QUEBRA DE LINHA. As
 * migrations estao em CRLF no disco, `\r` e terminador de linha em JavaScript, `.` nao casa com ele
 * e `$` sem `/m` so casa no fim absoluto da string. Uma versao escrita como
 * `linha.replace(/--.*$/, '')` depois de `split('\n')` nao corta comentario NENHUM em CRLF — e
 * passa verde, porque nao ha caso que exercite a prosa. Medido em 2026-09-06, ao mutar a guarda da
 * 0069: ela reprovou acusando o comentario que explicava o defeito.
 *
 * Duas copias divergentes disso ja existiam quando esta funcao nasceu (a guarda de pack e a de
 * cobertura LGPD). Mora aqui pelo mesmo motivo que a de cima: cinco copias de uma regra e a
 * armadilha de duas fontes da mesma verdade, aplicada a ferramenta que persegue essa armadilha.
 */
export function sqlSemComentarios(sql: string): string {
  return sql
    .split(/\r?\n/)
    .map((linha) => linha.replace(/--[^\r\n]*$/, ''))
    .join('\n')
}
