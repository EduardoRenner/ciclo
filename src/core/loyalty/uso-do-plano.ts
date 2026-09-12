/**
 * CICLO Clube · C-07 (docs/60) — quantas visitas do ciclo de cobrança atual já foram consumidas do
 * plano, e se passou do limite.
 *
 * **Avisa, não bloqueia** — mesma filosofia do estoque negativo (CLAUDE.md: "Alerte, não bloqueie.
 * Bloquear faz o salão abandonar o sistema."). Um assinante que passa do limite continua sendo
 * atendido; o dono só fica sabendo, pra decidir cobrar avulso ou deixar passar. Decisão registrada
 * em docs/60 §Clube.
 */
export type UsoDoPlano = {
  /** `null` = plano ilimitado — nunca "excede", nunca tem "restantes" para contar. */
  restantes: number | null
  excedeu: boolean
}

export function usoDoPlano(sessionsPerMonth: number | null, visitasNoCiclo: number): UsoDoPlano {
  if (sessionsPerMonth === null) return { restantes: null, excedeu: false }

  return {
    restantes: Math.max(0, sessionsPerMonth - visitasNoCiclo),
    excedeu: visitasNoCiclo > sessionsPerMonth,
  }
}
