import { Temporal } from '@js-temporal/polyfill'

import { computeCycle, mediana } from './compute'

/**
 * Relógio múltiplo do Motor (`docs/105-ciclo/C-002`).
 *
 * O `computeCycle` sabe um relógio só: o tempo. Muitos negócios com cliente que volta têm outro —
 * a oficina tem a QUILOMETRAGEM ("10 mil km ou 12 meses, o que ocorrer primeiro"). Este módulo prevê
 * cada relógio separado e devolve o que vence primeiro, dizendo qual foi, para a mensagem falar a
 * verdade ("pela quilometragem" ou "pelo tempo").
 *
 * Invariante: sem relógio de uso, o resultado é o do `computeCycle` — a beleza não muda nada.
 */

export type Visita = { date: Temporal.PlainDate; /** Leitura do contador de uso nessa visita (km), quando houver. */ uso?: number | null }

export type Regra = {
  /** O relógio de tempo: o padrão do serviço em dias (o mesmo `defaultCycleDays` do Motor). */
  dias?: number | null
  /** O relógio de uso: a cada quanto de uso a manutenção vence (km). */
  uso?: number | null
  /**
   * O relógio de tempo SEGUE o ritmo medido do cliente (beleza: o Motor) ou é um LIMITE fixo desde a
   * última visita (oficina: "12 meses" do manual)? Na oficina a pessoa volta quando o carro pede, e
   * o intervalo entre visitas é efeito da quilometragem — tratar esse intervalo como "ritmo" seria
   * medir o relógio errado. Padrão: segue o ritmo (o comportamento do Motor de sempre).
   */
  tempoPeloRitmo?: boolean
}

export type RitmoDeUso = {
  porDia: number
  /** `medido`: duas ou mais leituras coerentes; `referencia`: sem leituras bastantes, usou o ritmo de referência. */
  origem: 'medido' | 'referencia'
  leituras: number
}

export type PrevisaoPorRelogios = {
  data: Temporal.PlainDate
  /** Qual relógio venceu primeiro. */
  relogio: 'tempo' | 'uso'
  porTempo: Temporal.PlainDate | null
  porUso: Temporal.PlainDate | null
  ritmo: RitmoDeUso | null
}

/**
 * Ritmo de uso por dia, robusto: mediana das taxas entre leituras consecutivas. Leitura que DESCE
 * (digitação errada, painel trocado) ou que dá taxa absurda é descartada — a mediana absorve o resto.
 * Com menos de 2 leituras válidas, usa o ritmo de referência e diz que usou.
 */
export function ritmoDeUso(visitas: readonly Visita[], referenciaPorDia: number, tetoPorDia = 1000): RitmoDeUso {
  const comLeitura = visitas.filter((v): v is Visita & { uso: number } => typeof v.uso === 'number' && v.uso >= 0)
  // A taxa é sempre medida contra a última leitura ACEITA: uma leitura que desce é pulada inteira,
  // senão a leitura seguinte (a certa) seria comparada com a errada e daria uma taxa absurda.
  const taxas: number[] = []
  let anterior: { date: Temporal.PlainDate; uso: number } | null = null
  for (const atual of comLeitura) {
    if (!anterior) {
      anterior = atual
      continue
    }
    const dias = atual.date.since(anterior.date).total('days')
    const delta = atual.uso - anterior.uso
    if (delta < 0) continue
    if (dias > 0) {
      const taxa = delta / dias
      if (taxa <= tetoPorDia) taxas.push(taxa)
    }
    anterior = atual
  }
  if (taxas.length === 0) return { porDia: referenciaPorDia, origem: 'referencia', leituras: comLeitura.length }
  return { porDia: mediana(taxas), origem: 'medido', leituras: comLeitura.length }
}

/** A última leitura de uso válida (a maior até a última visita, como o `GREATEST` do StarkOS). */
function ultimaLeitura(visitas: readonly Visita[]): { date: Temporal.PlainDate; uso: number } | null {
  let melhor: { date: Temporal.PlainDate; uso: number } | null = null
  for (const v of visitas) if (typeof v.uso === 'number' && v.uso >= 0 && (!melhor || v.uso >= melhor.uso)) melhor = { date: v.date, uso: v.uso }
  return melhor
}

/**
 * Prevê a próxima manutenção pelo que vencer primeiro.
 *
 * - Tempo: o `computeCycle` (v2) com o padrão `regra.dias` — o mesmo Motor da beleza.
 * - Uso: da última manutenção, faltam `regra.uso` de uso; ao ritmo do veículo, isso dá N dias.
 *   O "uso na última manutenção" é a leitura da última visita (ou a última leitura conhecida).
 */
export function preverPorRelogios(visitas: readonly Visita[], regra: Regra, referenciaPorDia: number): PrevisaoPorRelogios {
  if (visitas.length === 0) throw new Error('preverPorRelogios precisa de ao menos uma visita')
  const ultima = visitas[visitas.length - 1]!.date

  const porTempo = !regra.dias
    ? null
    : regra.tempoPeloRitmo === false
      ? ultima.add({ days: regra.dias })
      : computeCycle({ history: visitas.map((v) => ({ date: v.date })), defaultCycleDays: regra.dias, today: ultima }).predictedDate

  let porUso: Temporal.PlainDate | null = null
  let ritmo: RitmoDeUso | null = null
  if (regra.uso) {
    ritmo = ritmoDeUso(visitas, referenciaPorDia)
    const leitura = ultimaLeitura(visitas)
    const usoNaManutencao = typeof visitas[visitas.length - 1]!.uso === 'number' ? visitas[visitas.length - 1]!.uso! : leitura?.uso ?? null
    if (usoNaManutencao !== null && ritmo.porDia > 0) {
      const dias = Math.round(regra.uso / ritmo.porDia)
      porUso = ultima.add({ days: dias })
    }
  }

  if (porTempo && porUso) {
    return Temporal.PlainDate.compare(porUso, porTempo) < 0
      ? { data: porUso, relogio: 'uso', porTempo, porUso, ritmo }
      : { data: porTempo, relogio: 'tempo', porTempo, porUso, ritmo }
  }
  if (porUso) return { data: porUso, relogio: 'uso', porTempo, porUso, ritmo }
  if (porTempo) return { data: porTempo, relogio: 'tempo', porTempo, porUso, ritmo }
  throw new Error('a regra precisa de pelo menos um relógio (dias ou uso)')
}
