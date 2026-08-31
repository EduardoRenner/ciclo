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
