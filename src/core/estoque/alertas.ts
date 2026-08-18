import { Temporal } from '@js-temporal/polyfill'

const LIMIAR_DIAS_DE_COBERTURA = 7
const ALERTA_VALIDADE_DIAS = 30

/** §5.6: dias que o estoque atual ainda dura no ritmo de consumo dos últimos 30 dias. `null` quando não há consumo — não dá pra prever quando "nunca acaba". */
export function calcularDiasDeCobertura(estoqueAtualQty: number, consumoMedioDiario: number): number | null {
  if (consumoMedioDiario <= 0) return null
  return estoqueAtualQty / consumoMedioDiario
}

export type EntradaAlertaRecompra = {
  estoqueAtualQty: number
  reorderPointQty: number
  diasDeCobertura: number | null
}

/** §5.6: "estoque_atual ≤ ponto_pedido **ou** dias_de_cobertura < 7" — qualquer um dos dois já alerta. */
export function precisaRecomprar(entrada: EntradaAlertaRecompra): boolean {
  if (entrada.estoqueAtualQty <= entrada.reorderPointQty) return true
  return entrada.diasDeCobertura !== null && entrada.diasDeCobertura < LIMIAR_DIAS_DE_COBERTURA
}

export type EstadoValidade = 'ok' | 'alerta' | 'bloqueado'

/** §5.6: "alerta em D-30 e bloqueio de uso em D+0". Sem validade cadastrada, o produto nunca vence. */
export function estadoValidade(hoje: Temporal.PlainDate, expiraEm: Temporal.PlainDate | null): EstadoValidade {
  if (!expiraEm) return 'ok'
  const diasAteVencer = expiraEm.since(hoje).total('days')
  if (diasAteVencer <= 0) return 'bloqueado'
  if (diasAteVencer <= ALERTA_VALIDADE_DIAS) return 'alerta'
  return 'ok'
}
