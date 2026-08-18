/** §6, literal. */
export type EstadoAgendamento = 'pending' | 'confirmed' | 'arrived' | 'done' | 'no_show' | 'canceled' | 'expired'

/**
 * A leitura do diagrama de `§6`: cancelamento só existe enquanto o
 * atendimento não começou de verdade (`pending`/`confirmed`) — depois que a
 * cliente chegou (`arrived`), o caminho é `done` ou `no_show`, nunca voltar
 * para cancelado. `no_show` só existe a partir de `confirmed`: marcar falta
 * de quem nem chegou a confirmar não faz sentido (viraria `expired`).
 */
const TRANSICOES: Record<EstadoAgendamento, ReadonlySet<EstadoAgendamento>> = {
  pending: new Set<EstadoAgendamento>(['confirmed', 'canceled', 'expired']),
  confirmed: new Set<EstadoAgendamento>(['arrived', 'no_show', 'canceled']),
  arrived: new Set<EstadoAgendamento>(['done']),
  done: new Set<EstadoAgendamento>(),
  no_show: new Set<EstadoAgendamento>(),
  canceled: new Set<EstadoAgendamento>(),
  expired: new Set<EstadoAgendamento>(),
}

/** `§6`: "transições ilegais devolvem 422 INVALID_TRANSITION". Este módulo só diz sim/não; quem devolve o erro é a camada de servidor. */
export function transicaoValida(de: EstadoAgendamento, para: EstadoAgendamento): boolean {
  return TRANSICOES[de].has(para)
}

export function proximosEstados(de: EstadoAgendamento): EstadoAgendamento[] {
  return [...TRANSICOES[de]]
}
