import { Temporal } from '@js-temporal/polyfill'

import { totalDoOrcamento } from '../orcamento/calcular'

import { ITENS, type ChaveDoItem } from './itens'
import { motivoDoItem } from './mensagem'
import type { Intervalo } from './perfis'
import type { ItemDoPlano } from './plano'
import type { VencimentoDoItem } from './vencimento'
import { agruparEmVisitas } from './visitas'

/**
 * O plano do carro, o orçamento montado por ele e o próximo passo da entrega
 * (`docs/106-automotivo` §2.2 passos 2, 3 e 5; AUT-402/403/405, parte pura; `docs/105-ciclo/C-019`).
 *
 * "Confiança é o produto": cada linha do orçamento diz DE ONDE vem a regra (manual do modelo, plano da
 * oficina, genérico) e QUAL relógio venceu ("faltam ~300 km", "27 meses desde a última troca"). O que
 * ainda não venceu NÃO entra no orçamento: vai para "pode esperar", com a data aproximada. Item sem
 * registro também não entra: vai para "conferir", porque cobrar o que não se sabe se precisa é
 * exatamente "empurrar peça".
 */

export type Medicao = { valor: number; unidade: '%' | 'mm' | 'V'; temFoto?: boolean }
export type PrecoDoItem = { pecaCents: number; maoDeObraCents: number }

const NOME_DA_ORIGEM: Record<ItemDoPlano['origem'], string> = {
  oficina: 'pelo plano da oficina',
  modelo: 'pelo manual do modelo',
  familia: 'pelo plano da família do motor',
  generico: 'pelo plano genérico',
}

const KM = (n: number) => n.toLocaleString('pt-BR')
const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
export const mesAno = (d: Temporal.PlainDate) => `${MESES_CURTOS[d.month - 1]}/${d.year}`

/** "a cada 10.000 km ou 12 meses" — a frase da regra, sem misturar camadas. */
export function fraseDoIntervalo(i: Intervalo): string {
  const partes = [i.km ? `${KM(i.km)} km` : null, i.meses ? `${i.meses} ${i.meses === 1 ? 'mês' : 'meses'}` : null].filter(Boolean)
  return `a cada ${partes.join(' ou ')}`
}

// ── AUT-402: o plano do carro, em grupos ─────────────────────────────────────────────────────────

export type PlanoDoCarro = {
  vencidos: VencimentoDoItem[]
  nestaVisita: VencimentoDoItem[]
  /** A próxima visita sugerida (itens em dia que vencem juntos), com a data aproximada. */
  proxima: { quando: Temporal.PlainDate; itens: VencimentoDoItem[] } | null
  /** Quantos itens em dia ficam fora da próxima visita. */
  emDiaDepois: number
  conferir: VencimentoDoItem[]
}

export function planoDoCarro(vencimentos: readonly VencimentoDoItem[], hoje: Temporal.PlainDate): PlanoDoCarro {
  const porData = (a: VencimentoDoItem, b: VencimentoDoItem) => Temporal.PlainDate.compare(a.venceEm!, b.venceEm!)
  const emDia = vencimentos.filter((v) => v.estado === 'em_dia' && v.venceEm).sort(porData)
  const [primeira] = agruparEmVisitas(
    emDia.map((v) => ({ item: v.item, venceEm: v.venceEm! })),
    hoje,
  )
  const naProxima = new Set<ChaveDoItem>(primeira?.itens ?? [])
  return {
    vencidos: vencimentos.filter((v) => v.estado === 'vencido'),
    nestaVisita: vencimentos.filter((v) => v.estado === 'nesta_visita'),
    proxima: primeira ? { quando: primeira.data, itens: emDia.filter((v) => naProxima.has(v.item)) } : null,
    emDiaDepois: emDia.filter((v) => !naProxima.has(v.item)).length,
    conferir: vencimentos.filter((v) => v.estado === 'perguntar'),
  }
}

// ── AUT-403: o orçamento montado pelo plano ──────────────────────────────────────────────────────

export type LinhaDoOrcamento = {
  item: ChaveDoItem
  nome: string
  /** "pelo manual do modelo (a cada 10.000 km ou 12 meses): pela quilometragem, faltam ~300 km" */
  motivo: string
  medicao: string | null
  pecaCents: number
  maoDeObraCents: number
  totalCents: number
}

export type OrcamentoDoPlano = {
  linhas: LinhaDoOrcamento[]
  /** Item que vence agora, mas a oficina não tem preço cadastrado: aparece, sem valor inventado. */
  semPreco: { item: ChaveDoItem; nome: string; motivo: string }[]
  podeEsperar: { item: ChaveDoItem; nome: string; quando: string }[]
  conferir: { item: ChaveDoItem; nome: string }[]
  totalCents: number
}

export function orcamentoDoPlano(e: {
  vencimentos: readonly VencimentoDoItem[]
  plano: readonly ItemDoPlano[]
  precos: Partial<Record<ChaveDoItem, PrecoDoItem>>
  medicoes?: Partial<Record<ChaveDoItem, Medicao>>
  kmAtual: number | null
  hoje: Temporal.PlainDate
}): OrcamentoDoPlano {
  const regra = new Map(e.plano.map((p) => [p.item, p]))
  const agora = e.vencimentos.filter((v) => v.estado === 'vencido' || v.estado === 'nesta_visita')
  // Crítico vencido primeiro: é o que o motorista não pode recusar sem saber.
  const peso = (v: VencimentoDoItem) => (v.estado === 'vencido' ? 0 : 2) - (ITENS[v.item].critico ? 1 : 0)
  agora.sort((a, b) => peso(a) - peso(b))

  const linhas: LinhaDoOrcamento[] = []
  const semPreco: OrcamentoDoPlano['semPreco'] = []
  for (const v of agora) {
    const p = regra.get(v.item)
    const daRegra = p ? `${NOME_DA_ORIGEM[p.origem]} (${fraseDoIntervalo(p.intervalo)})` : 'pelo plano'
    const relogio = motivoDoItem(v, e.kmAtual, e.hoje).replace(/^[^:]*:\s*/, '')
    const motivo = `${daRegra}: ${relogio}`
    const nome = ITENS[v.item].nome
    const preco = e.precos[v.item]
    if (!preco) {
      semPreco.push({ item: v.item, nome, motivo })
      continue
    }
    const m = e.medicoes?.[v.item]
    linhas.push({
      item: v.item,
      nome,
      motivo,
      medicao: m ? `medido: ${m.valor}${m.unidade === '%' ? '%' : ` ${m.unidade}`}${m.temFoto ? ' (com foto)' : ''}` : null,
      pecaCents: preco.pecaCents,
      maoDeObraCents: preco.maoDeObraCents,
      totalCents: preco.pecaCents + preco.maoDeObraCents,
    })
  }

  const podeEsperar = e.vencimentos
    .filter((v) => v.estado === 'em_dia' && v.venceEm)
    .sort((a, b) => Temporal.PlainDate.compare(a.venceEm!, b.venceEm!))
    .map((v) => ({ item: v.item, nome: ITENS[v.item].nome, quando: `por volta de ${mesAno(v.venceEm!)}` }))
  const conferir = e.vencimentos.filter((v) => v.estado === 'perguntar').map((v) => ({ item: v.item, nome: ITENS[v.item].nome }))
  const totalCents = totalDoOrcamento(linhas.map((l) => ({ qty: 1, unitPriceCents: l.totalCents })))
  return { linhas, semPreco, podeEsperar, conferir, totalCents }
}

// ── AUT-405: o próximo passo no comprovante ──────────────────────────────────────────────────────

/**
 * "Próxima troca: ~51.300 km, por volta de mar/2027." O km vem da regra; a data é o que vencer
 * primeiro entre o km ao ritmo do carro e o limite de tempo. Sem ritmo medido, a data só sai pelo tempo.
 */
export function proximoPasso(e: {
  item: ChaveDoItem
  intervalo: Intervalo
  feitoEm: { date: Temporal.PlainDate; km: number }
  ritmoMedidoKmPorDia: number | null
}): string {
  const nome = ITENS[e.item].nome.toLowerCase()
  const km = e.intervalo.km ? e.feitoEm.km + e.intervalo.km : null
  const porUso = km && e.ritmoMedidoKmPorDia && e.ritmoMedidoKmPorDia > 0 ? e.feitoEm.date.add({ days: Math.round(e.intervalo.km! / e.ritmoMedidoKmPorDia) }) : null
  const porTempo = e.intervalo.meses ? e.feitoEm.date.add({ months: e.intervalo.meses }) : null
  const datas = [porUso, porTempo].filter((d): d is Temporal.PlainDate => d !== null).sort(Temporal.PlainDate.compare)
  const quando = datas[0] ? `por volta de ${mesAno(datas[0])}` : null
  const partes = [km ? `~${KM(Math.round(km / 100) * 100)} km` : null, quando].filter(Boolean)
  return partes.length ? `Próxima vez (${nome}): ${partes.join(', ')}.` : ''
}
