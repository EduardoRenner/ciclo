/**
 * E1 para texto delimitado (`docs/97` §5): CSV, TSV, `;` do Excel brasileiro, `|` de relatório.
 *
 * O separador é o que se REPETE com a mesma contagem em mais linhas — não o primeiro que aparece.
 * "Silva, Maria; 11 99999-0000" tem uma vírgula e um ponto e vírgula; o que define é a constância
 * entre as linhas. Aspas seguem a RFC 4180: campo entre aspas pode ter separador, quebra de linha e
 * `""` (aspas escapadas).
 *
 * Puro e sem dependência: o `core/` não importa biblioteca de terceiros (guarda
 * `core-nao-conhece-o-mundo`), e um leitor de CSV correto cabe aqui.
 */

export type Separador = ',' | ';' | '\t' | '|'
const CANDIDATOS: Separador[] = [';', ',', '\t', '|']

/** Divide o texto em registros respeitando aspas, para qualquer separador. */
export function lerDelimitado(texto: string, separador: Separador): string[][] {
  const linhas: string[][] = []
  let campo = ''
  let linha: string[] = []
  let entreAspas = false
  let i = 0
  const n = texto.length
  while (i < n) {
    const c = texto[i]!
    if (entreAspas) {
      if (c === '"') {
        if (texto[i + 1] === '"') {
          campo += '"'
          i += 2
          continue
        }
        entreAspas = false
        i++
        continue
      }
      campo += c
      i++
      continue
    }
    if (c === '"' && campo.trim() === '') {
      entreAspas = true
      campo = ''
      i++
      continue
    }
    if (c === separador) {
      linha.push(campo)
      campo = ''
      i++
      continue
    }
    if (c === '\r' || c === '\n') {
      linha.push(campo)
      linhas.push(linha)
      linha = []
      campo = ''
      i += c === '\r' && texto[i + 1] === '\n' ? 2 : 1
      continue
    }
    campo += c
    i++
  }
  if (campo !== '' || linha.length > 0) {
    linha.push(campo)
    linhas.push(linha)
  }
  return linhas
}

/**
 * Pontua cada candidato pelas primeiras linhas não vazias: quantas têm mais de uma coluna, e quão
 * constante é a contagem (a moda). Empate fica com a ordem de `CANDIDATOS` (`;` primeiro: é o do
 * Excel em português, e vírgula decimal aparece dentro de valor).
 */
export function detectarSeparador(texto: string): Separador | null {
  const amostra = texto.slice(0, 64 * 1024)
  let melhor: { sep: Separador; pontos: number } | null = null
  for (const sep of CANDIDATOS) {
    const linhas = lerDelimitado(amostra, sep)
      .slice(0, 60)
      .filter((l) => l.some((c) => c.trim() !== ''))
    if (linhas.length === 0) continue
    const contagem = new Map<number, number>()
    for (const l of linhas) if (l.length > 1) contagem.set(l.length, (contagem.get(l.length) ?? 0) + 1)
    if (contagem.size === 0) continue
    const [largura, vezes] = [...contagem].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0]!
    // Constância (fração de linhas com a largura da moda) pesa mais que a largura.
    const pontos = (vezes / linhas.length) * 100 + Math.min(largura, 30)
    if (!melhor || pontos > melhor.pontos) melhor = { sep, pontos }
  }
  return melhor?.sep ?? null
}

/**
 * Texto → grade. Sem separador que se repita, cada linha vira uma célula só (lista colada: a esteira
 * trata como texto livre, uma pessoa por linha).
 */
export function gradeDeTexto(texto: string): { grade: string[][]; separador: Separador | null } {
  const separador = detectarSeparador(texto)
  if (!separador) return { grade: texto.split(/\r\n|\r|\n/).map((l) => [l]), separador: null }
  return { grade: lerDelimitado(texto, separador), separador }
}
