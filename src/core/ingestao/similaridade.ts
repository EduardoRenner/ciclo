/**
 * Similaridade de texto para a esteira: casar cabeçalho com o dicionário (E5) e nome com nome (E7).
 * Implementado aqui porque os pacotes de Jaro-Winkler estão parados (`docs/103-conversor/00-pesquisa.md`
 * P8) e o core não importa biblioteca.
 */

/** Minúsculas, sem acento, sem pontuação, espaços únicos: "Últ. Visita!" → "ult visita". */
export function normalizarTexto(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** Jaro-Winkler entre 0 e 1 (1 = iguais). Prefixo comum de até 4 caracteres ganha bônus (p = 0,1). */
export function jaroWinkler(a: string, b: string): number {
  if (a === b) return 1
  const la = a.length
  const lb = b.length
  if (la === 0 || lb === 0) return 0
  const janela = Math.max(0, Math.floor(Math.max(la, lb) / 2) - 1)
  const casouA = new Array<boolean>(la).fill(false)
  const casouB = new Array<boolean>(lb).fill(false)
  let casamentos = 0
  for (let i = 0; i < la; i++) {
    const ini = Math.max(0, i - janela)
    const fim = Math.min(i + janela + 1, lb)
    for (let j = ini; j < fim; j++) {
      if (casouB[j] || a[i] !== b[j]) continue
      casouA[i] = true
      casouB[j] = true
      casamentos++
      break
    }
  }
  if (casamentos === 0) return 0
  let transposicoes = 0
  let k = 0
  for (let i = 0; i < la; i++) {
    if (!casouA[i]) continue
    while (!casouB[k]) k++
    if (a[i] !== b[k]) transposicoes++
    k++
  }
  const m = casamentos
  const jaro = (m / la + m / lb + (m - transposicoes / 2) / m) / 3
  let prefixo = 0
  while (prefixo < Math.min(4, la, lb) && a[prefixo] === b[prefixo]) prefixo++
  return jaro + prefixo * 0.1 * (1 - jaro)
}
