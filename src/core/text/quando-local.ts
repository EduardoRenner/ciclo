import { Temporal } from '@js-temporal/polyfill'

const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'] as const

/**
 * "quinta, 14:30" no fuso do NEGÓCIO, nunca fatiando o ISO em UTC (armadilha conhecida).
 * Morava dentro de `public-booking.ts`; veio para cá quando o aviso de cancelamento (docs/112
 * EXP-A03) precisou do mesmo texto, para não nascer uma segunda cópia da mesma conta.
 */
export function quandoLocal(startsAtIso: string, timezone: string): string {
  const zoned = Temporal.Instant.from(startsAtIso).toZonedDateTimeISO(timezone)
  const dia = DIAS[zoned.dayOfWeek % 7]
  const hora = `${String(zoned.hour).padStart(2, '0')}:${String(zoned.minute).padStart(2, '0')}`
  return `${dia}, ${hora}`
}
