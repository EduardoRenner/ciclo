import { Temporal } from '@js-temporal/polyfill'

import { ITENS, type ChaveDoItem } from './itens'

/**
 * Agrupar itens em VISITAS (`docs/106-automotivo` §4.2, AUT-303).
 *
 * O motorista não volta nove vezes por ano, uma por item; volta duas ou três. A visita sugerida junta
 * os itens que vencem perto um do outro, para a mensagem ser uma só e com todos os motivos.
 *
 * Regra (gulosa, e por isso explicável na tela): a visita acontece no PRIMEIRO vencimento da fila — nada
 * é empurrado para depois de vencer, crítico ou não — e leva junto tudo o que venceria até `janelaDias`
 * depois. O custo de antecipar é vida útil não usada; ele é devolvido (`antecipacaoDias`) para a oficina
 * ver quanto está adiantando e ajustar a janela.
 */

export type ItemAVencer = { item: ChaveDoItem; venceEm: Temporal.PlainDate }

export type Visita = {
  data: Temporal.PlainDate
  itens: ChaveDoItem[]
  /** Soma dos dias que cada item foi adiantado em relação ao próprio vencimento. */
  antecipacaoDias: number
  temCritico: boolean
}

export function agruparEmVisitas(aVencer: readonly ItemAVencer[], hoje: Temporal.PlainDate, janelaDias = 30): Visita[] {
  const fila = [...aVencer].sort((a, b) => Temporal.PlainDate.compare(a.venceEm, b.venceEm))
  const visitas: Visita[] = []
  let i = 0
  while (i < fila.length) {
    const primeiro = fila[i]!.venceEm
    // Vencido hoje ou antes: a visita é hoje (não se marca no passado).
    const data = Temporal.PlainDate.compare(primeiro, hoje) < 0 ? hoje : primeiro
    const limite = data.add({ days: janelaDias })
    const itens: ChaveDoItem[] = []
    let antecipacaoDias = 0
    while (i < fila.length && Temporal.PlainDate.compare(fila[i]!.venceEm, limite) <= 0) {
      itens.push(fila[i]!.item)
      antecipacaoDias += Math.max(0, fila[i]!.venceEm.since(data).total('days'))
      i++
    }
    visitas.push({ data, itens, antecipacaoDias, temCritico: itens.some((k) => ITENS[k].critico) })
  }
  return visitas
}
