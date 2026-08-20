import { Temporal } from '@js-temporal/polyfill'

export type ItemOrcamento = { qty: number; unitPriceCents: number }

/** `qty` é decimal (§5: "diária", "meia diária") — arredonda pra cima, nunca corta centavo do cliente. */
export function totalDoItem(item: ItemOrcamento): number {
  return Math.ceil(item.qty * item.unitPriceCents)
}

export function totalDoOrcamento(itens: ItemOrcamento[]): number {
  return itens.reduce((soma, item) => soma + totalDoItem(item), 0)
}

/** `validUntil` é uma data (YYYY-MM-DD) no fuso do tenant — expira no fim daquele dia local. */
export function orcamentoExpirado(validUntil: string | null, timezone: string, agora: Temporal.Instant = Temporal.Now.instant()): boolean {
  if (!validUntil) return false
  const limite = Temporal.PlainDate.from(validUntil).add({ days: 1 }).toZonedDateTime({ timeZone: timezone, plainTime: '00:00' }).toInstant()
  return Temporal.Instant.compare(agora, limite) >= 0
}
