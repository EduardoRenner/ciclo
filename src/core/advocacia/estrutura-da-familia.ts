import { participacaoEfetiva, totaisPorEmpresa, validarEstrutura, type ArestaDeParticipacao, type ProblemaNaEstrutura } from './participacao'

/**
 * A Estrutura da família (docs/101 T3.2/T3.3, anexo 04 §4.5) como a tela precisa: quem tem quanto de
 * cada empresa, o que está inconsistente, e a participação EFETIVA de cada pessoa (direta + via
 * holdings) com a conta à mostra. Pura; o percentual vem de `participacao.ts` (portado do LUBI).
 *
 * O simulador "e se" só devolve arestas novas e a comparação: nunca grava, e a tela sempre diz que não
 * tem efeito jurídico nem tributário (frase 38).
 */

export type Pessoa = { id: string; nome: string; vinculo: string }
export type Empresa = { id: string; nome: string; tipo: string }

export type DonoNaTela = { chave: string; nome: string; percent: number; usufruto: string | null }

export type EmpresaNaTela = {
  id: string
  nome: string
  tipo: string
  total: number
  donos: DonoNaTela[]
  problema: 'acima-de-100' | 'abaixo-de-100' | null
}

export type EfetivaDaPessoa = {
  pessoaId: string
  nome: string
  porEmpresa: { empresaId: string; empresa: string; direta: number; indireta: number; total: number; conta: string }[]
}

const arredonda = (n: number) => Math.round(n * 1e4) / 1e4
const pct = (n: number) => `${arredonda(n).toLocaleString('pt-BR', { maximumFractionDigits: 4 })}%`

export function montarEstrutura(
  pessoas: readonly Pessoa[],
  empresas: readonly Empresa[],
  arestas: readonly ArestaDeParticipacao[],
): { empresas: EmpresaNaTela[]; efetivas: EfetivaDaPessoa[]; problemas: ProblemaNaEstrutura[] } {
  const nomeDe = new Map<string, string>([
    ...pessoas.map((p) => [`person:${p.id}`, p.nome] as const),
    ...empresas.map((e) => [`entity:${e.id}`, e.nome] as const),
  ])
  const pessoaNome = new Map(pessoas.map((p) => [p.id, p.nome]))
  const problemas = validarEstrutura(arestas)
  const totais = totaisPorEmpresa(arestas)

  const naTela: EmpresaNaTela[] = empresas.map((e) => {
    const p = problemas.find((x) => (x.kind === 'acima-de-100' || x.kind === 'abaixo-de-100') && x.entityId === e.id)
    return {
      id: e.id,
      nome: e.nome,
      tipo: e.tipo,
      total: arredonda(totais.get(e.id) ?? 0),
      donos: arestas
        .filter((a) => a.entityId === e.id)
        .map((a) => ({
          chave: `${a.owner.kind}:${a.owner.id}`,
          nome: nomeDe.get(`${a.owner.kind}:${a.owner.id}`) ?? 'Sem nome',
          percent: arredonda(a.percent),
          usufruto: a.usufructPersonId ? (pessoaNome.get(a.usufructPersonId) ?? 'Sem nome') : null,
        }))
        .sort((x, y) => y.percent - x.percent),
      // Empresa sem nenhum sócio lançado não aparece em `validarEstrutura` (ela soma só o que tem aresta):
      // é estrutura que ninguém lançou ainda, e não "abaixo de 100". O teste fixa esse comportamento.
      problema: p ? (p.kind as 'acima-de-100' | 'abaixo-de-100') : null,
    }
  })

  // Com ciclo a efetiva não existe: a tela mostra o problema e não inventa número.
  if (problemas.some((x) => x.kind === 'ciclo')) return { empresas: naTela, efetivas: [], problemas }

  const efetiva = participacaoEfetiva(arestas)
  const diretas = new Map<string, number>()
  for (const a of arestas) if (a.owner.kind === 'person') diretas.set(`${a.owner.id}|${a.entityId}`, (diretas.get(`${a.owner.id}|${a.entityId}`) ?? 0) + a.percent)

  const efetivas: EfetivaDaPessoa[] = pessoas
    .map((p) => {
      const mapa = efetiva.get(`person:${p.id}`) ?? new Map<string, number>()
      const porEmpresa = empresas
        .filter((e) => (mapa.get(e.id) ?? 0) > 0)
        .map((e) => {
          const total = arredonda(mapa.get(e.id) ?? 0)
          const direta = arredonda(diretas.get(`${p.id}|${e.id}`) ?? 0)
          const indireta = arredonda(total - direta)
          return { empresaId: e.id, empresa: e.nome, direta, indireta, total, conta: contaDaEfetiva(p.id, e.id, arestas, nomeDe) }
        })
      return { pessoaId: p.id, nome: p.nome, porEmpresa }
    })
    .filter((x) => x.porEmpresa.length > 0)

  return { empresas: naTela, efetivas, problemas }
}

/**
 * A conta escrita ("60% direto + 40% × 100% via MA Participações = 100%"), só um nível de holding por
 * caminho, que é o caso de toda família do MVP. Caminho mais fundo vira "via N empresas".
 */
function contaDaEfetiva(pessoaId: string, empresaId: string, arestas: readonly ArestaDeParticipacao[], nomeDe: Map<string, string>): string {
  const partes: string[] = []
  for (const a of arestas) {
    if (a.owner.kind === 'person' && a.owner.id === pessoaId && a.entityId === empresaId) partes.push(`${pct(a.percent)} direto`)
  }
  for (const h of arestas) {
    if (!(h.owner.kind === 'person' && h.owner.id === pessoaId)) continue
    for (const o of arestas) {
      if (o.owner.kind === 'entity' && o.owner.id === h.entityId && o.entityId === empresaId) {
        partes.push(`${pct(h.percent)} × ${pct(o.percent)} via ${nomeDe.get(`entity:${h.entityId}`) ?? 'holding'}`)
      }
    }
  }
  return partes.join(' + ')
}

// ---------------------------------------------------------------------------------------------
// Simulador "e se"
// ---------------------------------------------------------------------------------------------

export type Movimento = { empresaId: string; de: string; para: string; percent: number }

export type ResultadoDaSimulacao =
  | { ok: true; arestas: ArestaDeParticipacao[] }
  | { ok: false; motivo: string }

/**
 * Move `percent` pontos de uma pessoa (`de`, chave `person:id`) para outra numa empresa. Não grava.
 * Recusa mover mais do que a pessoa tem, porque a tela mostraria percentual negativo.
 */
export function simular(arestas: readonly ArestaDeParticipacao[], m: Movimento): ResultadoDaSimulacao {
  if (!(m.percent > 0)) return { ok: false, motivo: 'Informe quanto mover (mais que zero).' }
  if (m.de === m.para) return { ok: false, motivo: 'Escolha duas pessoas diferentes.' }
  const [kDe, idDe] = m.de.split(':') as ['person' | 'entity', string]
  const [kPara, idPara] = m.para.split(':') as ['person' | 'entity', string]
  const daOrigem = arestas.filter((a) => a.entityId === m.empresaId && a.owner.kind === kDe && a.owner.id === idDe)
  const tem = daOrigem.reduce((s, a) => s + a.percent, 0)
  if (tem + 1e-9 < m.percent) return { ok: false, motivo: `Só há ${pct(tem)} para mover.` }

  const novas = arestas.map((a) => ({ ...a, owner: { ...a.owner } }))
  let falta = m.percent
  for (const a of novas) {
    if (falta <= 0) break
    if (a.entityId === m.empresaId && a.owner.kind === kDe && a.owner.id === idDe) {
      const tira = Math.min(a.percent, falta)
      a.percent = arredonda(a.percent - tira)
      falta = arredonda(falta - tira)
    }
  }
  const destino = novas.find((a) => a.entityId === m.empresaId && a.owner.kind === kPara && a.owner.id === idPara && !a.usufructPersonId)
  if (destino) destino.percent = arredonda(destino.percent + m.percent)
  else novas.push({ owner: { kind: kPara, id: idPara }, entityId: m.empresaId, percent: m.percent })
  return { ok: true, arestas: novas.filter((a) => a.percent > 0) }
}

/** Antes × depois da efetiva de cada pessoa, só onde mudou. */
export function compararEfetivas(antes: readonly EfetivaDaPessoa[], depois: readonly EfetivaDaPessoa[]) {
  type Linha = { nome: string; empresa: string; antes: number; depois: number }
  const linhas = new Map<string, Linha>()
  const juntar = (lado: readonly EfetivaDaPessoa[], campo: 'antes' | 'depois') => {
    for (const p of lado) {
      for (const e of p.porEmpresa) {
        const k = JSON.stringify([p.pessoaId, e.empresaId])
        const l = linhas.get(k) ?? { nome: p.nome, empresa: e.empresa, antes: 0, depois: 0 }
        l[campo] = e.total
        linhas.set(k, l)
      }
    }
  }
  juntar(antes, 'antes')
  juntar(depois, 'depois')
  return [...linhas.values()]
    .filter((l) => Math.abs(l.antes - l.depois) > 1e-6)
    .sort((x, y) => x.nome.localeCompare(y.nome, 'pt-BR') || x.empresa.localeCompare(y.empresa, 'pt-BR'))
}

export const formatarPercentual = pct
