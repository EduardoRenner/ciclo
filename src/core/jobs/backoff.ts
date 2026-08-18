/**
 * Espelha o que `finish_job()` (migration 0009) calcula no banco — existe
 * aqui também porque `decidirDesfecho()` precisa saber, sem ir ao banco, se
 * uma falha ainda tenta de novo ou já é a última (§7: "dead_letter depois de
 * 5 tentativas").
 */
const TETO_MINUTOS = 60

export function backoffMinutos(tentativasJaFeitas: number): number {
  return Math.min(TETO_MINUTOS, 2 ** tentativasJaFeitas)
}

export type DesfechoFalha = 'failed' | 'dead'

/** `attempts` é o valor ANTES desta falha — a que está prestes a ser contada. */
export function decidirDesfecho(attempts: number, maxAttempts: number): DesfechoFalha {
  return attempts + 1 >= maxAttempts ? 'dead' : 'failed'
}
