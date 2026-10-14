import { Temporal } from '@js-temporal/polyfill'

/**
 * A leitura de km no check-in (`docs/106-automotivo` AUT-103, `docs/105-ciclo/C-029`).
 *
 * É a leitura que alimenta o relógio de uso (`core/cycle/relogios.ts`, C-002): uma leitura errada vira
 * uma troca de óleo prevista para daqui a 3 anos ou para ontem. Dois erros comuns no balcão:
 * - zero a mais (41.300 → 413.000): o carro "rodou" 5 mil km por dia;
 * - km que DESCE: troca do painel ou do hodômetro, ou dígito trocado.
 * Nenhum dos dois é bloqueado (bloquear faz a oficina largar o sistema, mesma regra do estoque
 * negativo no CLAUDE.md): a leitura é ACEITA com aviso, na hora, para o balcão conferir antes de gravar.
 * O relógio de uso já se defende sozinho de uma leitura absurda (mediana robusta do C-002, medido no
 * C-029); o que este aviso protege é o HISTÓRICO do carro, que a oficina e o motorista leem.
 */

export type LeituraAnterior = { date: Temporal.PlainDate; km: number }

/** Acima disto por dia, entre duas leituras, é quase certamente erro de digitação. */
export const KM_POR_DIA_IMPROVAVEL = 1500

export type AvaliacaoDaLeitura =
  | { tipo: 'ok' }
  | { tipo: 'primeira' }
  | { tipo: 'desce'; diferencaKm: number; aviso: string }
  | { tipo: 'salto'; kmPorDia: number; aviso: string }

export function avaliarLeitura(anteriores: readonly LeituraAnterior[], nova: LeituraAnterior): AvaliacaoDaLeitura {
  const ultima = [...anteriores]
    .filter((l) => Temporal.PlainDate.compare(l.date, nova.date) <= 0)
    .sort((a, b) => Temporal.PlainDate.compare(a.date, b.date))
    .at(-1)
  if (!ultima) return { tipo: 'primeira' }
  if (nova.km < ultima.km) {
    const diferencaKm = ultima.km - nova.km
    return {
      tipo: 'desce',
      diferencaKm,
      aviso: `O km está ${diferencaKm.toLocaleString('pt-BR')} abaixo da última visita. Trocou o painel? Se foi engano, confira o número.`,
    }
  }
  const dias = Math.max(1, ultima.date.until(nova.date).total('days'))
  const kmPorDia = (nova.km - ultima.km) / dias
  if (kmPorDia > KM_POR_DIA_IMPROVAVEL) {
    return {
      tipo: 'salto',
      kmPorDia: Math.round(kmPorDia),
      aviso: `Isso dá ${Math.round(kmPorDia).toLocaleString('pt-BR')} km por dia desde a última visita. Confira se não sobrou um zero.`,
    }
  }
  return { tipo: 'ok' }
}
