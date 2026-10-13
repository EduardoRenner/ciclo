/**
 * CNV-008 · Corpus sintético da esteira (`docs/97` §12): a MESMA base escrita de dezenas de jeitos,
 * cada variação com o gabarito. Nenhum dado real; nenhuma amostra de concorrente. Cobre as CLASSES de
 * problema dos exports de verdade (título e filtro no topo, `;` + Windows-1252, UTF-16 do Excel
 * "Unicode", telefone em seis formatos, data em número do Excel, cabeçalho do Google e do Outlook,
 * colunas armadilha, uma linha por atendimento).
 *
 * Semente fixa: o corpus é o mesmo em toda máquina e em todo run da CI.
 */

export type PessoaDoGabarito = {
  nome: string
  telefone: string // E.164
  email: string | null
  nascimento: string | null // ISO
  ultimaVisita: string // ISO
  cpf: string
  alergia: string
  profissional: string
}

export type Estilo = {
  separador: ';' | ',' | '\t' | '|'
  codificacao: 'utf8' | 'utf8bom' | 'cp1252' | 'utf16le'
  titulo: boolean
  filtro: boolean
  total: boolean
  telefone: 0 | 1 | 2 | 3 | 4 | 5
  data: 'dmy' | 'iso' | 'excel'
  cabecalho: 'pt' | 'pt-curto' | 'google' | 'outlook' | 'nenhum'
  armadilhas: boolean
  embaralhar: boolean
  grao: 'cliente' | 'atendimento'
}

export type Variacao = { nome: string; estilo: Estilo; bytes: Uint8Array; gabarito: PessoaDoGabarito[] }

/** mulberry32: PRNG pequeno e determinístico. */
export function aleatorio(semente: number) {
  let a = semente >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const NOMES = ['Maria', 'João', 'Ana', 'Conceição', 'José', 'Antônia', 'Sebastião', 'Luíza', 'Márcio', 'Fátima', 'Benedito', 'Inês', 'Raimundo', 'Lúcia', 'Ândrea', 'Cláudio']
const SOBRENOMES = ['Souza', 'Lima', 'Ávila', 'Conceição', 'Araújo', 'Gonçalves', 'Simões', 'Ribeiro', 'Magalhães', 'Assunção', 'Brandão', 'Falcão']
const DDDS = [11, 21, 31, 41, 51, 61, 71, 81, 85, 92]
const PROFISSIONAIS = ['Bia', 'Carla', 'Duda']
const ALERGIAS = ['acetona', 'amônia, PPD', 'nenhuma conhecida', 'látex']

/** A base: `n` pessoas distintas (nomes, telefones e e-mails únicos). */
export function base(n: number, semente = 2026): PessoaDoGabarito[] {
  const rnd = aleatorio(semente)
  const pessoas: PessoaDoGabarito[] = []
  const usados = new Set<string>()
  while (pessoas.length < n) {
    const nome = `${NOMES[Math.floor(rnd() * NOMES.length)]} ${SOBRENOMES[Math.floor(rnd() * SOBRENOMES.length)]}`
    if (usados.has(nome)) continue
    usados.add(nome)
    const ddd = DDDS[Math.floor(rnd() * DDDS.length)]!
    const assinante = String(90_000_000 + Math.floor(rnd() * 9_999_999)).padStart(8, '0')
    const dia = 13 + Math.floor(rnd() * 15) // > 12: a ordem dia/mês é detectável pela distribuição
    const mes = 1 + Math.floor(rnd() * 9)
    const anoNasc = 1960 + Math.floor(rnd() * 45)
    pessoas.push({
      nome,
      telefone: `+55${ddd}9${assinante}`,
      email: rnd() < 0.7 ? `${nome.split(' ')[0]!.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()}.${pessoas.length}@exemplo.com.br` : null,
      nascimento: rnd() < 0.6 ? `${anoNasc}-${String(1 + Math.floor(rnd() * 12)).padStart(2, '0')}-${String(13 + Math.floor(rnd() * 15)).padStart(2, '0')}` : null,
      ultimaVisita: `2026-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`,
      cpf: `${100 + pessoas.length}.${String(200 + pessoas.length).padStart(3, '0')}.300-0${pessoas.length % 10}`,
      alergia: ALERGIAS[pessoas.length % ALERGIAS.length]!,
      profissional: PROFISSIONAIS[pessoas.length % PROFISSIONAIS.length]!,
    })
  }
  return pessoas
}

function telefoneEscrito(e164: string, formato: Estilo['telefone']): string {
  const ddd = e164.slice(3, 5)
  const n = e164.slice(5)
  switch (formato) {
    case 0:
      return `(${ddd}) ${n.slice(0, 5)}-${n.slice(5)}`
    case 1:
      return `${ddd}${n}`
    case 2:
      return e164
    case 3:
      return `+55 ${ddd} ${n.slice(0, 1)} ${n.slice(1, 5)}-${n.slice(5)}`
    case 4:
      return `0${ddd} ${n.slice(0, 5)} ${n.slice(5)}`
    case 5:
      return `${ddd} ${n.slice(0, 5)}.${n.slice(5)}`
  }
}

function serialDoExcel(iso: string): string {
  return String(Math.round((Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))) - Date.UTC(1899, 11, 30)) / 86_400_000))
}

function dataEscrita(iso: string | null, formato: Estilo['data']): string {
  if (!iso) return ''
  if (formato === 'iso') return iso
  if (formato === 'excel') return serialDoExcel(iso)
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`
}

const CABECALHOS: Record<Exclude<Estilo['cabecalho'], 'nenhum'>, Record<'nome' | 'telefone' | 'email' | 'nascimento' | 'ultimaVisita' | 'data', string>> = {
  pt: { nome: 'Nome', telefone: 'Telefone', email: 'E-mail', nascimento: 'Data de nascimento', ultimaVisita: 'Última visita', data: 'Data' },
  'pt-curto': { nome: 'Cliente', telefone: 'Cel', email: 'Email', nascimento: 'Aniversário', ultimaVisita: 'Últ. visita', data: 'Dia' },
  google: { nome: 'Name', telefone: 'Phone 1 - Value', email: 'E-mail 1 - Value', nascimento: 'Birthday', ultimaVisita: 'Last visit', data: 'Date' },
  outlook: { nome: 'Name', telefone: 'Mobile Phone', email: 'E-mail Address', nascimento: 'Birthday', ultimaVisita: 'Last visit', data: 'Date' },
}

function codificar(texto: string, c: Estilo['codificacao']): Uint8Array {
  if (c === 'utf8') return new TextEncoder().encode(texto)
  if (c === 'utf8bom') return new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode(texto)])
  if (c === 'utf16le') {
    const out = new Uint8Array(2 + texto.length * 2)
    out[0] = 0xff
    out[1] = 0xfe
    for (let i = 0; i < texto.length; i++) {
      const u = texto.charCodeAt(i)
      out[2 + i * 2] = u & 0xff
      out[3 + i * 2] = u >> 8
    }
    return out
  }
  // Windows-1252: os acentos do português ficam no mesmo código do Latin-1.
  return Uint8Array.from(Array.from(texto, (ch) => {
    const u = ch.charCodeAt(0)
    if (u > 0xff) throw new Error(`fora do Windows-1252: ${ch}`)
    return u
  }))
}

export function escrever(pessoas: PessoaDoGabarito[], estilo: Estilo, semente = 7): Uint8Array {
  const rnd = aleatorio(semente)
  const sep = estilo.separador
  const cab = estilo.cabecalho === 'nenhum' ? null : CABECALHOS[estilo.cabecalho]
  type Coluna = { titulo: string; valor: (p: PessoaDoGabarito, visita: string) => string }
  let colunas: Coluna[] = [
    { titulo: cab?.nome ?? '', valor: (p) => p.nome },
    { titulo: cab?.telefone ?? '', valor: (p) => telefoneEscrito(p.telefone, estilo.telefone) },
    { titulo: cab?.email ?? '', valor: (p) => p.email ?? '' },
  ]
  if (estilo.grao === 'cliente') {
    colunas.push({ titulo: cab?.ultimaVisita ?? '', valor: (p) => dataEscrita(p.ultimaVisita, estilo.data) })
    if (estilo.cabecalho !== 'nenhum') colunas.push({ titulo: cab!.nascimento, valor: (p) => dataEscrita(p.nascimento, estilo.data) })
  } else {
    colunas.push({ titulo: cab?.data ?? '', valor: (_, visita) => dataEscrita(visita, estilo.data) })
  }
  if (estilo.armadilhas && estilo.cabecalho !== 'nenhum') {
    colunas.push({ titulo: 'CPF', valor: (p) => p.cpf })
    colunas.push({ titulo: 'Alergias', valor: (p) => p.alergia })
    colunas.push({ titulo: 'Nome do profissional', valor: (p) => p.profissional })
    colunas.push({ titulo: 'Total de atendimentos', valor: (p) => String(1 + (p.nome.length % 9)) })
  }
  if (estilo.embaralhar) colunas = colunas.map((c) => ({ c, k: rnd() })).sort((a, b) => a.k - b.k).map((x) => x.c)

  const campo = (v: string) => (v.includes(sep) || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v)
  const linhas: string[] = []
  if (estilo.titulo) linhas.push('Relatório de Clientes')
  if (estilo.filtro) linhas.push(`Período: 01/01/2026 a 30/09/2026${sep.repeat(colunas.length - 1)}`)
  if (estilo.titulo || estilo.filtro) linhas.push(sep.repeat(colunas.length - 1))
  if (cab) linhas.push(colunas.map((c) => campo(c.titulo)).join(sep))
  for (const p of pessoas) {
    const visitas = estilo.grao === 'atendimento' ? [p.ultimaVisita.replace(/-(\d\d)$/, (_, d: string) => `-${String(Number(d) - 7).padStart(2, '0')}`), p.ultimaVisita] : [p.ultimaVisita]
    for (const v of visitas) linhas.push(colunas.map((c) => campo(c.valor(p, v))).join(sep))
  }
  if (estilo.total) linhas.push(`Total${sep}${pessoas.length}${sep.repeat(Math.max(0, colunas.length - 2))}`)
  return codificar(linhas.join('\r\n'), estilo.codificacao)
}

/** As variações do corpus: combinações deterministicas dos estilos. */
export function corpus(quantas = 48): Variacao[] {
  const rnd = aleatorio(97)
  const escolha = <T>(xs: readonly T[]) => xs[Math.floor(rnd() * xs.length)]!
  const pessoas = base(12)
  const out: Variacao[] = []
  for (let i = 0; i < quantas; i++) {
    const cabecalho = escolha(['pt', 'pt-curto', 'google', 'outlook', 'nenhum'] as const)
    const estilo: Estilo = {
      separador: escolha([';', ',', '\t', '|'] as const),
      codificacao: escolha(['utf8', 'utf8bom', 'cp1252', 'utf16le'] as const),
      titulo: rnd() < 0.5,
      filtro: rnd() < 0.4,
      total: rnd() < 0.4,
      telefone: escolha([0, 1, 2, 3, 4, 5] as const),
      data: cabecalho === 'nenhum' ? escolha(['dmy', 'iso'] as const) : escolha(['dmy', 'iso', 'excel'] as const),
      cabecalho,
      armadilhas: rnd() < 0.5,
      embaralhar: rnd() < 0.5,
      grao: cabecalho !== 'nenhum' && rnd() < 0.25 ? 'atendimento' : 'cliente',
    }
    out.push({ nome: `v${String(i).padStart(2, '0')} ${JSON.stringify(estilo)}`, estilo, bytes: escrever(pessoas, estilo, 100 + i), gabarito: pessoas })
  }
  return out
}
