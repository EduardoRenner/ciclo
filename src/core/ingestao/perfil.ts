/**
 * E4 da esteira (`docs/97` §5): medir o CONTEÚDO de cada coluna antes de dar nome a ela. O nome do
 * cabeçalho mente ("Contato" pode ser telefone ou nome; "Data" pode ser nascimento ou atendimento); o
 * conteúdo não.
 */
import { tipoDaCelula } from '@/core/ingestao/tabela'

export type OrdemDeData = 'dmy' | 'mdy' | 'ymd' | 'ambigua'

export type PerfilDeColuna = {
  indice: number
  preenchidas: number
  vazias: number
  distintos: number
  /** Fração das preenchidas que parece cada tipo. */
  fracao: {
    telefone: number
    email: number
    data: number
    dinheiro: number
    numero: number
    /** Número com casa decimal ("45,50", "80.00"): candidato a dinheiro; inteiro pequeno é contagem. */
    decimal: number
    /** Das datas, a fração com ano antes de 2010: nascimento, não visita. */
    dataAntiga: number
    /** Número que pode ser data do Excel (10000 a 60000 = 1927 a 2064). Só vale com cabeçalho de data. */
    serialDeData: number
    nomeDePessoa: number
    documento: number
    textoLongo: number
    genero: number
  }
  /** Ordem dia/mês detectada nas datas, pela distribuição; `null` sem datas. */
  ordemDeData: OrdemDeData | null
  /** Média de caracteres das preenchidas. */
  tamanhoMedio: number
  /** Poucos valores que se repetem muito (serviço, profissional, situação). */
  categorica: boolean
}

const GENERO = new Set(['m', 'f', 'masculino', 'feminino', 'masc', 'fem', 'homem', 'mulher', 'outro', 'nao binario', 'n', 'x', 'male', 'female'])

/** "000.000.000-00", 11 dígitos de CPF ou 14 de CNPJ — reconhecido para ser DESCARTADO (minimização). */
function pareceDocumento(v: string): boolean {
  if (/^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(v) || /^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/.test(v)) return true
  return false
}

/** Duas a cinco palavras de letras, a maioria começando com maiúscula ou tudo em caixa única. */
function pareceNomeDePessoa(v: string): boolean {
  if (/\d/.test(v) || v.length > 60) return false
  const palavras = v.trim().split(/\s+/)
  if (palavras.length < 1 || palavras.length > 6) return false
  if (!palavras.every((p) => /^[\p{L}'.-]+$/u.test(p))) return false
  return palavras.length >= 2 || /^\p{Lu}\p{Ll}+$/u.test(v.trim())
}

const ehGenero = (v: string) =>
  GENERO.has(
    v
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .trim(),
  )

function ordemDasDatas(valores: string[]): OrdemDeData | null {
  let viuDia = false
  let viuMesPrimeiro = false
  let viuIso = false
  let alguma = false
  for (const v of valores) {
    const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(v)
    if (iso) {
      viuIso = true
      alguma = true
      continue
    }
    const br = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/.exec(v)
    if (!br) continue
    alguma = true
    const a = Number(br[1])
    const b = Number(br[2])
    if (a > 12 && b <= 12) viuDia = true
    if (b > 12 && a <= 12) viuMesPrimeiro = true
  }
  if (!alguma) return null
  if (viuIso && !viuDia && !viuMesPrimeiro) return 'ymd'
  if (viuDia && !viuMesPrimeiro) return 'dmy'
  if (viuMesPrimeiro && !viuDia) return 'mdy'
  return 'ambigua'
}

/** Ano de uma data dd/mm/aa(aa) ou aaaa-mm-dd; ano de 2 dígitos acima de 30 é 19xx. */
function anoDe(v: string): number | null {
  if (/^\d{5}(\.\d+)?$/.test(v)) return 1900 + Math.floor(Number(v) / 365.25)
  const iso = /^(\d{4})-\d{2}-\d{2}/.exec(v)
  if (iso) return Number(iso[1])
  const br = /^\d{1,2}[/.-]\d{1,2}[/.-](\d{2,4})/.exec(v)
  if (!br) return null
  const a = Number(br[1])
  return br[1]!.length === 2 ? (a > 30 ? 1900 + a : 2000 + a) : a
}

function fracaoDeDatasAntigas(valores: string[]): number {
  const anos = valores.map(anoDe).filter((a): a is number => a !== null)
  if (anos.length === 0) return 0
  return anos.filter((a) => a < 2010).length / anos.length
}

export function perfilarColuna(indice: number, valoresBrutos: readonly string[]): PerfilDeColuna {
  const valores = valoresBrutos.map((v) => (v ?? '').trim())
  const cheias = valores.filter((v) => v !== '')
  const n = cheias.length || 1
  const conta = (f: (v: string) => boolean) => cheias.filter(f).length / n
  const tipos = cheias.map(tipoDaCelula)
  const fracaoTipo = (t: string) => tipos.filter((x) => x === t).length / n
  const distintos = new Set(cheias.map((v) => v.toLowerCase())).size
  const tamanhoMedio = cheias.reduce((s, v) => s + v.length, 0) / n
  return {
    indice,
    preenchidas: cheias.length,
    vazias: valores.length - cheias.length,
    distintos,
    fracao: {
      telefone: fracaoTipo('telefone'),
      email: fracaoTipo('email'),
      data: fracaoTipo('data'),
      dinheiro: fracaoTipo('dinheiro'),
      numero: fracaoTipo('numero'),
      decimal: conta((v) => /^-?\d+[.,]\d{1,2}$/.test(v)),
      dataAntiga: fracaoDeDatasAntigas(cheias),
      serialDeData: conta((v) => /^\d{5}(\.\d+)?$/.test(v) && Number(v) >= 10_000 && Number(v) <= 60_000),
      nomeDePessoa: conta(pareceNomeDePessoa),
      documento: conta(pareceDocumento),
      textoLongo: conta((v) => v.length > 40 || v.split(/\s+/).length > 6),
      genero: conta(ehGenero),
    },
    ordemDeData: ordemDasDatas(cheias),
    tamanhoMedio,
    categorica: cheias.length >= 4 && distintos <= Math.max(3, Math.ceil(cheias.length * 0.3)),
  }
}

export function perfilarColunas(linhas: readonly (readonly string[])[], largura: number): PerfilDeColuna[] {
  return Array.from({ length: largura }, (_, c) =>
    perfilarColuna(
      c,
      linhas.map((l) => l[c] ?? ''),
    ),
  )
}
