/**
 * CNV-016 · Tabela dentro de documento → grade, sem biblioteca e sem DOM (`docs/103-conversor/00c-…` §6):
 *
 *   · HTML (tabela colada de uma página ou do Excel/Planilhas Google): `<tr>`/`<td>`/`<th>`, `colspan`;
 *   · Word `.docx` (`word/document.xml`): `w:tbl`/`w:tr`/`w:tc`, texto em `w:t`, `w:gridSpan`;
 *   · LibreOffice `.odt`/`.ods` (`content.xml`): `table:table-row`/`table:table-cell`, e o
 *     `table:number-columns-repeated` que, ignorado, desloca todas as colunas.
 *
 * Só TEXTO sai daqui: nada é injetado em DOM (o HTML de documento enviado é entrada hostil).
 * Cada tabela do documento vira uma grade; a esteira escolhe a com mais linhas.
 */

const ENTIDADES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }

function decodificarEntidades(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (inteira, e: string) => {
    if (e.startsWith('#x') || e.startsWith('#X')) return String.fromCodePoint(parseInt(e.slice(2), 16))
    if (e.startsWith('#')) return String.fromCodePoint(Number(e.slice(1)))
    return ENTIDADES[e.toLowerCase()] ?? inteira
  })
}

const textoSemTags = (html: string) =>
  decodificarEntidades(
    html
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' '),
  ).trim()

/** Tabelas de um HTML. Tabela aninhada é lida como texto da célula de fora. */
export function gradesDeHtml(html: string): string[][][] {
  const semScripts = html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
  const tabelas = semScripts.match(/<table[\s\S]*?<\/table>/gi) ?? []
  return tabelas
    .map((t) =>
      (t.match(/<tr[\s\S]*?<\/tr>/gi) ?? []).map((tr) => {
        const celulas: string[] = []
        for (const m of tr.matchAll(/<t([dh])([^>]*)>([\s\S]*?)<\/t\1>/gi)) {
          celulas.push(textoSemTags(m[3]!))
          const span = Number(/colspan\s*=\s*["']?(\d+)/i.exec(m[2]!)?.[1] ?? 1)
          for (let k = 1; k < Math.min(span, 50); k++) celulas.push('')
        }
        return celulas
      }),
    )
    .filter((g) => g.length > 0)
}

/** Tabelas do `word/document.xml` de um `.docx`. */
export function gradesDeDocx(documentXml: string): string[][][] {
  const tabelas = documentXml.match(/<w:tbl>[\s\S]*?<\/w:tbl>/g) ?? []
  return tabelas.map((tbl) =>
    (tbl.match(/<w:tr[\s>][\s\S]*?<\/w:tr>/g) ?? []).map((tr) => {
      const celulas: string[] = []
      for (const tc of tr.match(/<w:tc[\s>][\s\S]*?<\/w:tc>/g) ?? []) {
        const paragrafos = (tc.match(/<w:p[\s>][\s\S]*?<\/w:p>/g) ?? [tc]).map((p) => decodificarEntidades((p.match(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g) ?? []).map((t) => t.replace(/<[^>]+>/g, '')).join('')))
        celulas.push(paragrafos.filter(Boolean).join(' ').trim())
        const span = Number(/<w:gridSpan w:val="(\d+)"/.exec(tc)?.[1] ?? 1)
        for (let k = 1; k < Math.min(span, 50); k++) celulas.push('')
      }
      return celulas
    }),
  )
}

/** Tabelas do `content.xml` de um `.odt`/`.ods`, respeitando colunas e linhas repetidas. */
export function gradesDeOdf(contentXml: string): string[][][] {
  const tabelas = contentXml.match(/<table:table[\s>][\s\S]*?<\/table:table>/g) ?? []
  return tabelas.map((tbl) => {
    const linhas: string[][] = []
    // Linha vazia que se fecha (`<table:table-row …/>`) OU linha com conteúdo até o fecho dela. Um `/>`
    // solto não serve de fim: `<text:s/>` (espaço) dentro da célula cortava a linha no meio.
    for (const tr of tbl.match(/<table:table-row\b[^>]*\/>|<table:table-row\b[^>]*>[\s\S]*?<\/table:table-row>/g) ?? []) {
      const celulas: string[] = []
      for (const m of tr.matchAll(/<table:(?:covered-)?table-cell([^>]*?)(?:\/>|>([\s\S]*?)<\/table:(?:covered-)?table-cell>)/g)) {
        const texto = decodificarEntidades(
          (m[2] ?? '')
            .replace(/<text:s(?:\s[^>]*)?\/>/g, ' ')
            .replace(/<\/text:p>/g, ' ')
            .replace(/<[^>]+>/g, ''),
        ).trim()
        // "Repetida" no fim da linha é o preenchimento do editor até a coluna 1024: não vira célula.
        const repetida = Math.min(Number(/table:number-columns-repeated="(\d+)"/.exec(m[1]!)?.[1] ?? 1), texto === '' ? 1 : 50)
        for (let k = 0; k < repetida; k++) celulas.push(texto)
      }
      while (celulas.length > 0 && celulas.at(-1) === '') celulas.pop()
      const repeticoesDaLinha = Number(/table:number-rows-repeated="(\d+)"/.exec(tr)?.[1] ?? 1)
      if (celulas.length === 0) {
        if (repeticoesDaLinha < 1000) for (let k = 0; k < repeticoesDaLinha; k++) linhas.push([])
        continue
      }
      for (let k = 0; k < Math.min(repeticoesDaLinha, 1000); k++) linhas.push([...celulas])
    }
    while (linhas.length > 0 && linhas.at(-1)!.length === 0) linhas.pop()
    return linhas
  })
}
