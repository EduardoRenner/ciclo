import { Temporal } from '@js-temporal/polyfill'

/** Ritmo a partir do qual o serviço não tem volta para sugerir (remoção, por exemplo, grava 365). */
export const RITMO_SEM_VOLTA = 180

/**
 * docs/114 L-05: o dia sugerido para a próxima vez, na página que quem foi atendido abre depois do
 * atendimento. Prefere a previsão do Motor (pessoal, recalculada na conclusão); sem ela, o último
 * atendimento mais o ritmo do serviço. Nunca antes de amanhã: "por volta de" um dia que já passou
 * não diz nada, e pelo link só se marca a partir de amanhã (L-04). Datas `YYYY-MM-DD` no fuso do salão.
 */
export function proximaVolta({
  previsto,
  ultimaVisita,
  ritmoDias,
  hoje,
}: {
  previsto: string | null
  ultimaVisita: string
  ritmoDias: number
  hoje: string
}): string | null {
  if (!(ritmoDias > 0) || ritmoDias >= RITMO_SEM_VOLTA) return null
  const dia = previsto ? Temporal.PlainDate.from(previsto) : Temporal.PlainDate.from(ultimaVisita).add({ days: ritmoDias })
  const amanha = Temporal.PlainDate.from(hoje).add({ days: 1 })
  return (Temporal.PlainDate.compare(dia, amanha) < 0 ? amanha : dia).toString()
}
