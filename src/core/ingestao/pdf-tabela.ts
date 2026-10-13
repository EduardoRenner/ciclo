/**
 * CNV-017 · Palavras com posição (de um PDF com texto, ou do OCR de um print) → grade.
 *
 * O modo "stream" do Camelot (`docs/103-conversor/00c-…` §1), simplificado para relatório de sistema
 * e lista de app:
 *   1. agrupa as palavras em LINHAS pela altura (y parecido, mesma página);
 *   2. dentro da linha, junta palavras próximas em SEGMENTOS (espaço pequeno = mesma célula);
 *   3. as COLUNAS saem das linhas típicas (as que têm o número de segmentos mais comum): o começo
 *      médio de cada segmento vira uma âncora;
 *   4. cada segmento de cada linha cai na âncora mais à direita que começa antes dele.
 * Puro: quem extrai as palavras (pdf.js, OCR) mora fora do core.
 */

export type Palavra = { texto: string; x: number; y: number; largura: number; altura: number; pagina: number }

type Segmento = { x0: number; x1: number; texto: string }

function linhas(palavras: readonly Palavra[]): Palavra[][] {
  const ordenadas = palavras.filter((p) => p.texto.trim() !== '').sort((a, b) => a.pagina - b.pagina || b.y - a.y || a.x - b.x)
  const out: Palavra[][] = []
  for (const p of ordenadas) {
    const atual = out.at(-1)
    const ref = atual?.[0]
    if (atual && ref && ref.pagina === p.pagina && Math.abs(ref.y - p.y) <= Math.max(ref.altura, p.altura, 1) * 0.5) atual.push(p)
    else out.push([p])
  }
  return out.map((l) => l.sort((a, b) => a.x - b.x))
}

function segmentos(linha: Palavra[]): Segmento[] {
  const out: Segmento[] = []
  for (const p of linha) {
    const ultimo = out.at(-1)
    const espaco = ultimo ? p.x - ultimo.x1 : Infinity
    // Espaço menor que ~uma letra larga = mesma célula ("Maria" + "Souza").
    if (ultimo && espaco < Math.max(p.altura, 1) * 0.9) {
      ultimo.texto += (espaco > Math.max(p.altura, 1) * 0.1 ? ' ' : '') + p.texto.trim()
      ultimo.x1 = Math.max(ultimo.x1, p.x + p.largura)
    } else out.push({ x0: p.x, x1: p.x + p.largura, texto: p.texto.trim() })
  }
  return out
}

export function gradeDePalavras(palavras: readonly Palavra[]): string[][] {
  const porLinha = linhas(palavras).map(segmentos)
  if (porLinha.length === 0) return []
  const contagem = new Map<number, number>()
  for (const l of porLinha) contagem.set(l.length, (contagem.get(l.length) ?? 0) + 1)
  // A moda, com empate para o maior: a linha de dados costuma ter mais colunas que título e rodapé.
  const moda = [...contagem].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0]![0]
  const tipicas = porLinha.filter((l) => l.length === moda)
  const ancoras = Array.from({ length: moda }, (_, k) => tipicas.reduce((s, l) => s + l[k]!.x0, 0) / tipicas.length)
  const tolerancia = Math.max(2, Math.min(...ancoras.slice(1).map((a, k) => a - ancoras[k]!), Infinity) * 0.35)

  return porLinha.map((l) => {
    const celulas = new Array<string>(moda).fill('')
    for (const s of l) {
      let coluna = 0
      for (let k = ancoras.length - 1; k >= 0; k--) {
        if (s.x0 + tolerancia >= ancoras[k]!) {
          coluna = k
          break
        }
      }
      celulas[coluna] = celulas[coluna] ? `${celulas[coluna]} ${s.texto}` : s.texto
    }
    return celulas
  })
}
