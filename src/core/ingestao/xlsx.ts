/**
 * CNV-013 · Planilha do Excel (`.xlsx`) → grades, uma por aba, sem biblioteca (decisão em DECISOES,
 * 2026-10-13): o `.xlsx` é um zip de XML documentado (ECMA-376), e ler VALORES é pouco código. O
 * SheetJS só existe atualizado fora do npm (o do npm tem CVE sem conserto, `00-pesquisa.md` P1).
 *
 * O que se lê, e como:
 *   · abas pelo `workbook.xml` + `_rels` (nome e arquivo de cada uma, na ordem);
 *   · texto compartilhado (`sharedStrings.xml`), inclusive texto rico em pedaços;
 *   · célula pelo ENDEREÇO (`r="C7"`): célula vazia no meio não desloca a linha;
 *   · fórmula: só o valor já calculado que o Excel guardou (`<v>`) — fórmula nunca é avaliada (E0);
 *   · data: número com estilo de data (ids 14–22, 27–36, 45–47, 50–58 ou formato próprio com d/m/a)
 *     vira AAAA-MM-DD, no calendário 1900 ou 1904 (`date1904`);
 *   · booleano vira "sim"/"não"; erro (`#N/A`) vira vazio.
 */

const ENTIDADES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }
const decodificar = (s: string) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (inteira, e: string) =>
    e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : (ENTIDADES[e] ?? inteira),
  )

/** Texto de um nó com `<t>` (simples ou em vários `<r><t>` de texto rico). */
const textoDosT = (xml: string) =>
  decodificar(
    (xml.match(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g) ?? [])
      .map((t) => t.replace(/<t(?:\s[^>]*)?>|<\/t>/g, ''))
      .join(''),
  )

export function textosCompartilhados(sharedStringsXml: string): string[] {
  return (sharedStringsXml.match(/<si>[\s\S]*?<\/si>/g) ?? []).map((si) => textoDosT(si.replace(/<rPh[\s\S]*?<\/rPh>/g, '')))
}

/** Índices de estilo (posição em `cellXfs`) cujo formato de número é DATA. */
export function estilosDeData(stylesXml: string): Set<number> {
  const proprios = new Map<number, string>()
  for (const m of stylesXml.matchAll(/<numFmt\s+numFmtId="(\d+)"\s+formatCode="([^"]*)"/g)) proprios.set(Number(m[1]), decodificar(m[2]!))
  const ehData = (id: number) => {
    if ((id >= 14 && id <= 22) || (id >= 27 && id <= 36) || (id >= 45 && id <= 47) || (id >= 50 && id <= 58)) return true
    const codigo = proprios.get(id)
    if (!codigo) return false
    // Tira o que está entre aspas e colchetes ("[$R$]", "\"dias\"") antes de procurar d/m/a.
    const limpo = codigo.replace(/"[^"]*"|\[[^\]]*\]|\\./g, '')
    return /[dy]/i.test(limpo) || /(^|[^h:])m+([^s]|$)/i.test(limpo) && /[dy]/i.test(limpo)
  }
  const bloco = /<cellXfs[^>]*>([\s\S]*?)<\/cellXfs>/.exec(stylesXml)?.[1] ?? ''
  const datas = new Set<number>()
  ;(bloco.match(/<xf\b[^>]*>/g) ?? []).forEach((xf, i) => {
    if (ehData(Number(/numFmtId="(\d+)"/.exec(xf)?.[1] ?? 0))) datas.add(i)
  })
  return datas
}

export type AbaDoXlsx = { nome: string; caminho: string }

/** Abas na ordem do `workbook.xml`, com o caminho do XML de cada uma (pelo `_rels`). */
export function abasDoXlsx(workbookXml: string, relsXml: string): { abas: AbaDoXlsx[]; data1904: boolean } {
  const alvos = new Map<string, string>()
  for (const m of relsXml.matchAll(/<Relationship\b[^>]*>/g)) {
    const id = /Id="([^"]+)"/.exec(m[0])?.[1]
    const alvo = /Target="([^"]+)"/.exec(m[0])?.[1]
    if (id && alvo) alvos.set(id, alvo.startsWith('/') ? alvo.slice(1) : `xl/${alvo.replace(/^\.\//, '')}`)
  }
  const abas: AbaDoXlsx[] = []
  for (const m of workbookXml.matchAll(/<sheet\b[^>]*>/g)) {
    const nome = decodificar(/name="([^"]*)"/.exec(m[0])?.[1] ?? '')
    const rid = /r:id="([^"]+)"/.exec(m[0])?.[1]
    const caminho = rid ? alvos.get(rid) : undefined
    if (caminho) abas.push({ nome, caminho })
  }
  return { abas, data1904: /<workbookPr\b[^>]*date1904="(1|true)"/.test(workbookXml) }
}

function indiceDaColuna(ref: string): number {
  const letras = /^[A-Z]+/.exec(ref)?.[0] ?? 'A'
  let n = 0
  for (const l of letras) n = n * 26 + (l.charCodeAt(0) - 64)
  return n - 1
}

function serialParaIso(serial: number, data1904: boolean): string {
  const base = data1904 ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, 30)
  const d = new Date(base + Math.round(serial * 86_400_000))
  const p = (n: number) => String(n).padStart(2, '0')
  const dia = `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`
  return serial % 1 === 0 ? dia : `${dia} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`
}

/** Uma aba (`xl/worksheets/sheetN.xml`) → grade. Limite de linhas e colunas contra planilha patológica. */
export function gradeDaAba(sheetXml: string, compartilhados: readonly string[], datas: ReadonlySet<number>, data1904: boolean): string[][] {
  const grade: string[][] = []
  const dados = /<sheetData>([\s\S]*?)<\/sheetData>/.exec(sheetXml)?.[1] ?? ''
  let proximaLinha = 0
  for (const linha of dados.match(/<row\b[^>]*\/>|<row\b[^>]*>[\s\S]*?<\/row>/g) ?? []) {
    const r = Number(/\br="(\d+)"/.exec(linha)?.[1] ?? proximaLinha + 1) - 1
    if (r > 200_000) break
    while (grade.length < r) grade.push([])
    const celulas: string[] = []
    let proximaColuna = 0
    for (const c of linha.match(/<c\b[^>]*\/>|<c\b[^>]*>[\s\S]*?<\/c>/g) ?? []) {
      const ref = /\br="([A-Z]+\d+)"/.exec(c)?.[1]
      const col = ref ? indiceDaColuna(ref) : proximaColuna
      proximaColuna = col + 1
      if (col > 500) continue
      const tipo = /\bt="([a-zA-Z]+)"/.exec(c)?.[1] ?? 'n'
      const estilo = Number(/\bs="(\d+)"/.exec(c)?.[1] ?? -1)
      const v = /<v>([\s\S]*?)<\/v>/.exec(c)?.[1]
      let valor = ''
      if (tipo === 's') valor = compartilhados[Number(v)] ?? ''
      else if (tipo === 'inlineStr') valor = textoDosT(/<is>([\s\S]*?)<\/is>/.exec(c)?.[1] ?? '')
      else if (tipo === 'str') valor = decodificar(v ?? '')
      else if (tipo === 'b') valor = v === '1' ? 'sim' : v === '0' ? 'não' : ''
      else if (tipo === 'e') valor = ''
      else if (v !== undefined && v !== '') {
        const n = Number(v)
        // Número com estilo de data vira data; número comum perde só a sujeira de ponto flutuante.
        valor = datas.has(estilo) && Number.isFinite(n) ? serialParaIso(n, data1904) : Number.isFinite(n) ? String(Number(n.toPrecision(15))) : v
      }
      while (celulas.length < col) celulas.push('')
      celulas[col] = valor
    }
    grade[r] = celulas
    proximaLinha = r + 1
  }
  return grade.map((l) => l ?? [])
}
