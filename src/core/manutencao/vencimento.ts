import { Temporal } from '@js-temporal/polyfill'

import { ritmoDeUso, type RitmoDeUso, type Visita } from '../cycle/relogios'

import { ITENS, type ChaveDoItem, type Relogio } from './itens'
import type { Intervalo } from './perfis'

/**
 * Vencimento de UM item num veículo (`docs/106-automotivo` §4.1, AUT-301/302/305): três relógios —
 * uso (km ao ritmo do veículo), tempo (limite fixo desde a última troca) e desgaste medido — e vale
 * o que vencer primeiro. Puro: recebe as leituras e medições, devolve data, relógio e estado.
 */

export type Medicao = { date: Temporal.PlainDate; km: number; valor: number }

export type EntradaDoItem = {
  item: ChaveDoItem
  intervalo: Intervalo
  /** A última vez que o item foi feito NESTA oficina (data e km). Sem isso, o sistema pergunta. */
  ultimoFeito: { date: Temporal.PlainDate; km: number } | null
  /** Leituras de km do veículo (todas as visitas), em ordem. */
  leituras: readonly Visita[]
  /** Medições de desgaste do item (pastilha %, sulco mm), em ordem. */
  medicoes?: readonly Medicao[]
  severo: boolean
  hoje: Temporal.PlainDate
  /** Ritmo de referência quando não há 2 leituras (km/dia). Brasil: ~36. */
  ritmoDeReferencia: number
  /** Janela da "visita": o que vence até aqui entra no orçamento de hoje. */
  janelaDias?: number
}

export type EstadoDoItem = 'vencido' | 'nesta_visita' | 'em_dia' | 'perguntar'

export type VencimentoDoItem = {
  item: ChaveDoItem
  estado: EstadoDoItem
  venceEm: Temporal.PlainDate | null
  relogio: Relogio | null
  porUso: Temporal.PlainDate | null
  porTempo: Temporal.PlainDate | null
  porDesgaste: Temporal.PlainDate | null
  ritmo: RitmoDeUso
  /** O km em que vence pelo uso (para a mensagem: "faltam ~500 km"). */
  kmDeVencimento: number | null
}

/** km/dia de desgaste entre a 1ª e a última medição; data em que chega ao mínimo, ao ritmo do veículo. */
function porDesgaste(e: EntradaDoItem, ritmo: RitmoDeUso): Temporal.PlainDate | null {
  const def = ITENS[e.item]
  const minimo = 'minimo' in def ? def.minimo : undefined
  const m = e.medicoes ?? []
  if (!minimo || m.length < 2 || ritmo.porDia <= 0) return null
  const primeira = m[0]!
  const ultima = m[m.length - 1]!
  const kmRodados = ultima.km - primeira.km
  const gasto = primeira.valor - ultima.valor
  if (kmRodados <= 0 || gasto <= 0) return null
  const porKm = gasto / kmRodados
  const kmAteOMinimo = Math.max(0, (ultima.valor - minimo.valor) / porKm)
  return ultima.date.add({ days: Math.round(kmAteOMinimo / ritmo.porDia) })
}

export function vencimentoDoItem(e: EntradaDoItem): VencimentoDoItem {
  const ritmo = ritmoDeUso(e.leituras, e.ritmoDeReferencia)
  const fator = e.severo ? (e.intervalo.fatorSevero ?? 1) : 1
  const desgaste = porDesgaste(e, ritmo)

  // AUT-305: item nunca feito aqui não é "vencido" — a oficina não sabe se foi feito em outro lugar.
  // Com medição de desgaste, porém, o estado medido responde sozinho.
  if (!e.ultimoFeito && !desgaste) {
    return { item: e.item, estado: 'perguntar', venceEm: null, relogio: null, porUso: null, porTempo: null, porDesgaste: null, ritmo, kmDeVencimento: null }
  }

  let porUso: Temporal.PlainDate | null = null
  let kmDeVencimento: number | null = null
  if (e.ultimoFeito && e.intervalo.km && ritmo.porDia > 0) {
    kmDeVencimento = e.ultimoFeito.km + Math.round(e.intervalo.km * fator)
    const ultimaLeitura = [...e.leituras].reverse().find((l) => typeof l.uso === 'number') ?? { date: e.ultimoFeito.date, uso: e.ultimoFeito.km }
    const faltam = kmDeVencimento - (ultimaLeitura.uso as number)
    porUso = ultimaLeitura.date.add({ days: Math.round(faltam / ritmo.porDia) })
  }
  const porTempo = e.ultimoFeito && e.intervalo.meses ? e.ultimoFeito.date.add({ days: Math.round(e.intervalo.meses * fator * 30.4375) }) : null

  const candidatos: [Relogio, Temporal.PlainDate][] = []
  if (porUso) candidatos.push(['uso', porUso])
  if (porTempo) candidatos.push(['tempo', porTempo])
  if (desgaste) candidatos.push(['desgaste', desgaste])
  candidatos.sort((a, b) => Temporal.PlainDate.compare(a[1], b[1]))
  const [relogio, venceEm] = candidatos[0] ?? [null, null]

  const janela = e.janelaDias ?? 30
  const estado: EstadoDoItem = !venceEm
    ? 'em_dia'
    : Temporal.PlainDate.compare(venceEm, e.hoje) <= 0
      ? 'vencido'
      : Temporal.PlainDate.compare(venceEm, e.hoje.add({ days: janela })) <= 0
        ? 'nesta_visita'
        : 'em_dia'

  return { item: e.item, estado, venceEm, relogio, porUso, porTempo, porDesgaste: desgaste, ritmo, kmDeVencimento }
}
