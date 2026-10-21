/**
 * E1 para JSON e NDJSON (`docs/97` §5): lista de objetos → grade. Aceita o que sistemas costumam
 * exportar: `[{…}, {…}]`, uma linha por objeto (NDJSON), ou um envelope `{ "clientes": [ … ] }`
 * (pega a primeira lista de objetos que achar). Objeto aninhado vira coluna com ponto
 * (`endereco.cidade`); lista de valores vira texto separado por vírgula.
 */

type Objeto = Record<string, unknown>

const ehObjeto = (v: unknown): v is Objeto => typeof v === 'object' && v !== null && !Array.isArray(v)

function achatar(o: Objeto, prefixo = '', saida: Record<string, string> = {}, profundidade = 0): Record<string, string> {
  for (const [k, v] of Object.entries(o)) {
    const chave = prefixo ? `${prefixo}.${k}` : k
    if (ehObjeto(v) && profundidade < 3) achatar(v, chave, saida, profundidade + 1)
    else if (Array.isArray(v)) saida[chave] = v.map((x) => (ehObjeto(x) ? JSON.stringify(x) : String(x ?? ''))).join(', ')
    else saida[chave] = v === null || v === undefined ? '' : String(v)
  }
  return saida
}

function primeiraListaDeObjetos(v: unknown, profundidade = 0): Objeto[] | null {
  if (Array.isArray(v)) return v.some(ehObjeto) ? v.filter(ehObjeto) : null
  if (!ehObjeto(v) || profundidade > 3) return null
  for (const filho of Object.values(v)) {
    const achada = primeiraListaDeObjetos(filho, profundidade + 1)
    if (achada) return achada
  }
  return null
}

export type GradeDeJson = { ok: true; grade: string[][] } | { ok: false; motivo: 'json_invalido' | 'sem_lista' }

export function gradeDeJson(texto: string): GradeDeJson {
  let objetos: Objeto[] | null = null
  try {
    objetos = primeiraListaDeObjetos(JSON.parse(texto))
  } catch {
    // NDJSON: um objeto por linha.
    const linhas = texto.split(/\r?\n/).filter((l) => l.trim() !== '')
    try {
      const lidos = linhas.map((l) => JSON.parse(l) as unknown)
      if (lidos.every(ehObjeto)) objetos = lidos as Objeto[]
    } catch {
      return { ok: false, motivo: 'json_invalido' }
    }
  }
  if (!objetos || objetos.length === 0) return { ok: false, motivo: 'sem_lista' }
  const planos = objetos.map((o) => achatar(o))
  const colunas: string[] = []
  for (const p of planos) for (const k of Object.keys(p)) if (!colunas.includes(k)) colunas.push(k)
  return { ok: true, grade: [colunas, ...planos.map((p) => colunas.map((c) => p[c] ?? ''))] }
}
