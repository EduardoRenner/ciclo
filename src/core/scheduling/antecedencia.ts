import { Temporal } from '@js-temporal/polyfill'

/**
 * docs/114 L-04 (decisão do Vitor): pelo link, a cliente marca a partir de amanhã. Quem quer horário
 * para hoje chama no WhatsApp, e a profissional decide. É antecedência em DIAS do calendário do salão
 * (`settings.min_advance_days`, padrão 1), separada da `min_lead_time_minutes`, que continua valendo
 * dentro do dia aceito. Datas como `YYYY-MM-DD` no fuso do salão.
 */
export function primeiroDiaPeloLink(hoje: string, diasDeAntecedencia: number): string {
  return Temporal.PlainDate.from(hoje).add({ days: Math.max(0, Math.trunc(diasDeAntecedencia)) }).toString()
}

export function diaAceitoPeloLink(dia: string, hoje: string, diasDeAntecedencia: number): boolean {
  return Temporal.PlainDate.compare(Temporal.PlainDate.from(dia), Temporal.PlainDate.from(primeiroDiaPeloLink(hoje, diasDeAntecedencia))) >= 0
}
