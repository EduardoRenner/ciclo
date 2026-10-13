/**
 * E6 da esteira (`docs/97` §5): cada valor no formato do CICLO, e toda correção DITA. Nada é trocado
 * calado: e-mail com domínio errado vira sugestão, nono dígito inserido e DDD do salão aplicado voltam
 * marcados, data no futuro vai para a quarentena (defeito D13), dois telefones na célula viram dois
 * (defeito D2).
 *
 * Puro: roda no Web Worker e no servidor. A hora "de agora" entra como parâmetro (o core não lê relógio).
 */
import type { OrdemDeData } from '@/core/ingestao/perfil'

// ── Telefone ───────────────────────────────────────────────────────────────────────────────────────

/** DDDs atribuídos pela Anatel (a mesma lista de `server/services/telefone.ts`, que revalida no servidor). */
export const DDD_VALIDOS: ReadonlySet<number> = new Set([
  11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 24, 27, 28, 31, 32, 33, 34, 35, 37, 38, 41, 42, 43, 44,
  45, 46, 47, 48, 49, 51, 53, 54, 55, 61, 62, 63, 64, 65, 66, 67, 68, 69, 71, 73, 74, 75, 77, 79, 81,
  82, 83, 84, 85, 86, 87, 88, 89, 91, 92, 93, 94, 95, 96, 97, 98, 99,
])

export type CorrecaoDeTelefone = 'ddd_do_salao' | 'nono_digito'

export type TelefoneNormalizado =
  | { ok: true; e164: string; tipo: 'celular' | 'fixo'; correcoes: CorrecaoDeTelefone[] }
  | { ok: false; motivo: 'vazio' | 'sem_ddd' | 'ddd_inexistente' | 'tamanho' | 'nao_e_celular_nem_fixo' }

function digitosNacionais(bruto: string): string {
  let d = bruto.replace(/\D/g, '')
  if (d.startsWith('55') && (bruto.trim().startsWith('+') || d.length >= 12)) d = d.slice(2)
  if (d.startsWith('0')) {
    d = d.replace(/^0+/, '')
    if (d.length === 12 || d.length === 13) d = d.slice(2) // código de operadora: "0 15 11 …"
  }
  return d
}

/**
 * Celular: 11 dígitos, o terceiro é 9. Fixo: 10 dígitos, o terceiro de 2 a 5. Celular antigo de 10
 * dígitos (terceiro de 6 a 9) ganha o nono dígito, MARCADO — pode ser fixo antigo, e a prévia mostra.
 */
export function normalizarTelefone(bruto: string, dddPadrao?: number): TelefoneNormalizado {
  if (bruto.trim() === '') return { ok: false, motivo: 'vazio' }
  let n = digitosNacionais(bruto)
  const correcoes: CorrecaoDeTelefone[] = []
  if (n.length === 8 || n.length === 9) {
    if (dddPadrao === undefined || !DDD_VALIDOS.has(dddPadrao)) return { ok: false, motivo: 'sem_ddd' }
    n = `${dddPadrao}${n}`
    correcoes.push('ddd_do_salao')
  }
  if (n.length !== 10 && n.length !== 11) return { ok: false, motivo: 'tamanho' }
  if (!DDD_VALIDOS.has(Number(n.slice(0, 2)))) return { ok: false, motivo: 'ddd_inexistente' }
  const terceiro = Number(n[2])
  if (n.length === 10 && terceiro >= 6) {
    n = `${n.slice(0, 2)}9${n.slice(2)}`
    correcoes.push('nono_digito')
  }
  if (n.length === 11) {
    if (n[2] !== '9') return { ok: false, motivo: 'nao_e_celular_nem_fixo' }
    return { ok: true, e164: `+55${n}`, tipo: 'celular', correcoes }
  }
  if (terceiro < 2 || terceiro > 5) return { ok: false, motivo: 'nao_e_celular_nem_fixo' }
  return { ok: true, e164: `+55${n}`, tipo: 'fixo', correcoes }
}

/** "11 99999-0001 / 11 3333-0001", "cel: …; fixo: …": cada telefone separado, celulares primeiro. */
export function separarTelefones(bruto: string, dddPadrao?: number): TelefoneNormalizado[] {
  const partes = bruto
    .split(/\s*(?:\/|;|\||,|\be\b|\bou\b)\s*/i)
    .map((p) => p.replace(/^[^\d+(]+/, '').trim())
    .filter((p) => p.replace(/\D/g, '').length >= 8)
  const lidos = (partes.length > 0 ? partes : [bruto]).map((p) => normalizarTelefone(p, dddPadrao))
  return lidos.sort((a, b) => Number(b.ok && b.tipo === 'celular') - Number(a.ok && a.tipo === 'celular'))
}

// ── Nome ───────────────────────────────────────────────────────────────────────────────────────────

const PARTICULAS = new Set(['da', 'de', 'do', 'das', 'dos', 'e', 'di', 'du', 'del', 'van', 'von'])

/**
 * Espaços limpos sempre. Caixa só é refeita quando o nome veio TODO maiúsculo ou TODO minúsculo
 * ("MARIA DA SILVA" → "Maria da Silva"); nome com caixa mista é como a pessoa escreveu ("McDonald",
 * "DiCaprio" ficam).
 */
export function normalizarNome(bruto: string): { valor: string; recaixado: boolean } {
  const limpo = bruto.replace(/\s+/g, ' ').trim()
  const letras = limpo.replace(/[^\p{L}]/gu, '')
  const caixaUnica = letras !== '' && (letras === letras.toUpperCase() || letras === letras.toLowerCase())
  if (!caixaUnica) return { valor: limpo, recaixado: false }
  const valor = limpo
    .toLowerCase()
    .split(' ')
    .map((p, i) => {
      if (i > 0 && PARTICULAS.has(p)) return p
      return p.replace(/(^|['-])(\p{L})/gu, (_, sep: string, l: string) => sep + l.toUpperCase())
    })
    .join(' ')
  return { valor, recaixado: valor !== limpo }
}

// ── E-mail ─────────────────────────────────────────────────────────────────────────────────────────

const DOMINIO_TROCADO: Record<string, string> = {
  'gmial.com': 'gmail.com',
  'gmai.com': 'gmail.com',
  'gamil.com': 'gmail.com',
  'gmail.con': 'gmail.com',
  'gmail.co': 'gmail.com',
  'gmail.com.br': 'gmail.com',
  'hotmial.com': 'hotmail.com',
  'hotmail.con': 'hotmail.com',
  'hotmal.com': 'hotmail.com',
  'hotmai.com': 'hotmail.com',
  'outlok.com': 'outlook.com',
  'outlook.con': 'outlook.com',
  'yahoo.com.bt': 'yahoo.com.br',
  'yaho.com.br': 'yahoo.com.br',
  'yahoo.con.br': 'yahoo.com.br',
  'uol.con.br': 'uol.com.br',
  'bol.con.br': 'bol.com.br',
  'icloud.con': 'icloud.com',
}

export type EmailNormalizado = { ok: true; valor: string; sugestao: string | null } | { ok: false; motivo: 'vazio' | 'formato' }

/** Formato conferido (o mesmo que `z.email` aceitaria na prática, D12); domínio errado vira SUGESTÃO. */
export function normalizarEmail(bruto: string): EmailNormalizado {
  const v = bruto.trim().toLowerCase()
  if (v === '') return { ok: false, motivo: 'vazio' }
  if (!/^[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(v) || v.includes('..')) return { ok: false, motivo: 'formato' }
  const [usuario, dominio] = v.split('@') as [string, string]
  const certo = DOMINIO_TROCADO[dominio]
  return { ok: true, valor: v, sugestao: certo ? `${usuario}@${certo}` : null }
}

// ── Data ───────────────────────────────────────────────────────────────────────────────────────────

export type DataNormalizada = { ok: true; iso: string; doExcel: boolean } | { ok: false; motivo: 'vazio' | 'invalida' | 'futuro' | 'ambigua' }

const doisDigitos = (n: number) => String(n).padStart(2, '0')

function dataValida(a: number, m: number, d: number): boolean {
  if (m < 1 || m > 12 || d < 1) return false
  const dias = [31, a % 4 === 0 && (a % 100 !== 0 || a % 400 === 0) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1]!
  return d <= dias
}

/** Número serial do Excel → ISO. Sistema 1900 (com o 29/02/1900 que não existiu) ou 1904 (Mac antigo). */
export function dataDoSerialDoExcel(serial: number, sistema1904 = false): string {
  const base = sistema1904 ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, 30)
  const d = new Date(base + Math.round(serial) * 86_400_000)
  return `${d.getUTCFullYear()}-${doisDigitos(d.getUTCMonth() + 1)}-${doisDigitos(d.getUTCDate())}`
}

/**
 * `hoje` (AAAA-MM-DD, no fuso do salão) decide o "futuro". `ordem` vem do perfil da coluna (E4):
 * ambígua sem decisão da pessoa volta `ambigua`, nunca um chute.
 */
export function normalizarData(bruto: string, ordem: OrdemDeData | null, hoje: string, opcoes: { sistema1904?: boolean } = {}): DataNormalizada {
  const v = bruto.trim()
  if (v === '') return { ok: false, motivo: 'vazio' }
  let iso: string | null = null
  let doExcel = false
  const serial = /^\d{4,5}(\.\d+)?$/.exec(v)
  if (serial) {
    const n = Number(v)
    if (n >= 1 && n < 80_000) {
      iso = dataDoSerialDoExcel(n, opcoes.sistema1904)
      doExcel = true
    }
  }
  if (!iso) {
    const ymd = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(v)
    const br = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/.exec(v)
    let a: number, m: number, d: number
    if (ymd) [a, m, d] = [Number(ymd[1]), Number(ymd[2]), Number(ymd[3])]
    else if (br) {
      const x = Number(br[1])
      const y = Number(br[2])
      a = br[3]!.length === 2 ? (Number(br[3]) > 30 ? 1900 : 2000) + Number(br[3]) : Number(br[3])
      if (ordem === 'mdy') [m, d] = [x, y]
      else if (ordem === 'ambigua' && x <= 12 && y <= 12 && x !== y) return { ok: false, motivo: 'ambigua' }
      else [d, m] = [x, y]
    } else return { ok: false, motivo: 'invalida' }
    if (!dataValida(a, m, d)) return { ok: false, motivo: 'invalida' }
    iso = `${a}-${doisDigitos(m)}-${doisDigitos(d)}`
  }
  if (iso > hoje) return { ok: false, motivo: 'futuro' }
  return { ok: true, iso, doExcel }
}

// ── Dinheiro ───────────────────────────────────────────────────────────────────────────────────────

/**
 * Texto de valor → centavos (regra 3: nunca float guardado). "R$ 1.234,56", "80", "80,5", "45.00",
 * "1,234.56". O separador decimal é o ÚLTIMO de vírgula/ponto quando seguido de 1 ou 2 dígitos.
 */
export function normalizarDinheiro(bruto: string): number | null {
  let v = bruto.replace(/r\$|\s/gi, '').trim()
  if (v === '') return null
  const negativo = /^-|^\(.*\)$/.test(v)
  v = v.replace(/[()-]/g, '')
  if (!/^[\d.,]+$/.test(v)) return null
  const ultimo = Math.max(v.lastIndexOf(','), v.lastIndexOf('.'))
  let inteiro = v
  let centavos = 0
  if (ultimo >= 0 && /^\d{1,2}$/.test(v.slice(ultimo + 1))) {
    inteiro = v.slice(0, ultimo)
    const frac = v.slice(ultimo + 1)
    centavos = Number(frac.length === 1 ? `${frac}0` : frac)
  }
  inteiro = inteiro.replace(/[.,]/g, '')
  if (inteiro === '' && centavos === 0) return null
  const total = Number(inteiro || '0') * 100 + centavos
  return negativo ? -total : total
}
