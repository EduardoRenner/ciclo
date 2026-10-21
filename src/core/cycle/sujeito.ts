import { Temporal } from '@js-temporal/polyfill'

/**
 * O "sujeito" do ciclo (`docs/105-ciclo/C-003`): QUEM volta. Na beleza é o próprio cliente; no pet é
 * o animal; na oficina, o veículo. Um tutor com dois cães no banho quinzenal tem dois relógios, não
 * um — misturar as duas séries faz o Motor ver um intervalo de uma semana e chamar de "atrasado"
 * quem está em dia (medido no placar de `sujeito-placar.test.ts`).
 *
 * Sujeito ausente (`null`/`undefined`) é o próprio cliente: a beleza não muda nada.
 */
export type VisitaComSujeito = { date: Temporal.PlainDate; sujeito?: string | null }

/** A chave do sujeito ausente: o cliente. Não colide com id de sujeito (que é uuid). */
export const O_PROPRIO_CLIENTE = '∅'

/** Agrupa as visitas de UM cliente num serviço por sujeito, cada série em ordem cronológica. */
export function agruparPorSujeito(visitas: readonly VisitaComSujeito[]): Map<string, Temporal.PlainDate[]> {
  const grupos = new Map<string, Temporal.PlainDate[]>()
  for (const v of visitas) {
    const chave = v.sujeito ?? O_PROPRIO_CLIENTE
    grupos.set(chave, [...(grupos.get(chave) ?? []), v.date])
  }
  for (const [chave, datas] of grupos) grupos.set(chave, [...datas].sort(Temporal.PlainDate.compare))
  return grupos
}
