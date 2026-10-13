/**
 * CNV-014 · Contatos do celular (`.vcf`) → grade (`docs/103-conversor/00-pesquisa.md` P5). Parser
 * próprio porque as bibliotecas cobrem só o vCard 4.0 ou pararam (o Android ainda exporta 2.1 com
 * quoted-printable quando o nome tem acento — e é aí que os importadores quebram).
 *
 * Cobre: linha dobrada (quebra + espaço/tab), quebra mole do quoted-printable (`=` no fim), `CHARSET`,
 * `ENCODING=QUOTED-PRINTABLE` (ou o `QUOTED-PRINTABLE` solto do 2.1), escapes `\, \; \n` do 3.0/4.0,
 * e os campos que interessam: FN, N, TEL (celular primeiro), EMAIL, BDAY, NOTE, CATEGORIES. PHOTO
 * (base64 enorme) é ignorada sem ser lida.
 */

type Propriedade = { nome: string; params: string[]; valor: string }

/** Desdobra as linhas: continuação (começa com espaço/tab) e quebra mole do quoted-printable. */
function linhasLogicas(texto: string): string[] {
  const fisicas = texto.split(/\r\n|\r|\n/)
  const logicas: string[] = []
  for (const linha of fisicas) {
    const anterior = logicas.length - 1
    if (anterior >= 0 && /^[ \t]/.test(linha)) {
      logicas[anterior] += linha.slice(1)
    } else if (anterior >= 0 && /ENCODING=QUOTED-PRINTABLE|;QUOTED-PRINTABLE/i.test(logicas[anterior]!.split(':')[0]!) && logicas[anterior]!.endsWith('=')) {
      logicas[anterior] = logicas[anterior]!.slice(0, -1) + linha
    } else {
      logicas.push(linha)
    }
  }
  return logicas.filter((l) => l.trim() !== '')
}

function decodificarQuotedPrintable(valor: string, charset: string): string {
  const bytes: number[] = []
  for (let i = 0; i < valor.length; i++) {
    const c = valor[i]!
    if (c === '=' && /^[0-9A-Fa-f]{2}$/.test(valor.slice(i + 1, i + 3))) {
      bytes.push(parseInt(valor.slice(i + 1, i + 3), 16))
      i += 2
    } else bytes.push(c.charCodeAt(0) & 0xff)
  }
  const rotulo = /^(utf-?8)$/i.test(charset) ? 'utf-8' : /1252|latin|8859/i.test(charset) ? 'windows-1252' : 'utf-8'
  try {
    return new TextDecoder(rotulo, { fatal: rotulo === 'utf-8' }).decode(Uint8Array.from(bytes))
  } catch {
    return new TextDecoder('windows-1252').decode(Uint8Array.from(bytes))
  }
}

const desescapar = (v: string) => v.replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1')

function lerPropriedade(linha: string): Propriedade | null {
  const doisPontos = linha.indexOf(':')
  if (doisPontos < 0) return null
  const [nomeComGrupo, ...params] = linha.slice(0, doisPontos).split(';')
  const nome = nomeComGrupo!.replace(/^[^.]*\./, '').toUpperCase() // "item1.TEL" → "TEL"
  let valor = linha.slice(doisPontos + 1)
  const qp = params.some((p) => /^(ENCODING=)?QUOTED-PRINTABLE$/i.test(p))
  const charset = params.find((p) => /^CHARSET=/i.test(p))?.split('=')[1] ?? 'utf-8'
  if (qp) valor = decodificarQuotedPrintable(valor, charset)
  return { nome, params: params.map((p) => p.toUpperCase()), valor }
}

function aniversario(v: string): string {
  const s = v.trim()
  const iso = /^(\d{4})-?(\d{2})-?(\d{2})/.exec(s)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  return '' // "--0815" (sem ano) não vira data: o CICLO guarda data completa
}

export const CABECALHO_DO_VCARD = ['Nome', 'Celular', 'Telefone 2', 'E-mail', 'Aniversário', 'Observação', 'Etiquetas']

/** Texto de um `.vcf` (um ou vários cartões) → grade com cabeçalho conhecido da esteira. */
export function gradeDeVcard(texto: string): string[][] {
  const linhas: string[][] = [CABECALHO_DO_VCARD]
  let cartao: Propriedade[] | null = null
  for (const bruta of linhasLogicas(texto)) {
    if (/^BEGIN:VCARD/i.test(bruta)) {
      cartao = []
      continue
    }
    if (/^END:VCARD/i.test(bruta)) {
      if (cartao) linhas.push(linhaDoCartao(cartao))
      cartao = null
      continue
    }
    if (!cartao || /^PHOTO[;:]/i.test(bruta)) continue
    const p = lerPropriedade(bruta)
    if (p) cartao.push(p)
  }
  return linhas
}

function linhaDoCartao(props: Propriedade[]): string[] {
  const um = (nome: string) => props.find((p) => p.nome === nome)?.valor ?? ''
  let nome = desescapar(um('FN')).trim()
  if (!nome) {
    const [sobrenome = '', primeiro = '', meio = ''] = um('N').split(';').map((x) => desescapar(x).trim())
    nome = [primeiro, meio, sobrenome].filter(Boolean).join(' ')
  }
  // Celular primeiro: TYPE=CELL (3.0/4.0), CELL solto (2.1) ou o que tiver 9 depois do DDD.
  const tels = props
    .filter((p) => p.nome === 'TEL')
    .map((p) => ({ valor: p.valor.replace(/^tel:/i, '').trim(), celular: p.params.some((x) => /CELL/.test(x)) }))
    .sort((a, b) => Number(b.celular) - Number(a.celular))
  const email = props.find((p) => p.nome === 'EMAIL')?.valor.trim() ?? ''
  return [nome, tels[0]?.valor ?? '', tels[1]?.valor ?? '', email, aniversario(um('BDAY')), desescapar(um('NOTE')).trim(), desescapar(um('CATEGORIES')).trim()]
}
