/**
 * Quando o bonus de indicacao deve ser creditado.
 *
 * A regra era inferida de `clients.visits_count === 0`, com o raciocinio de que o contador so
 * reflete o job diario e portanto ainda mostra o numero ANTES desta visita. O raciocinio estava
 * certo e o efeito era o oposto: como o contador NAO muda entre uma conclusao e a seguinte, ele
 * continuava `0` na segunda, na terceira, e em toda conclusao ate o cron rodar — uma vez por dia,
 * com 5 a 6 horas de atraso medido do GitHub Actions.
 *
 * Duas conclusoes da mesma cliente antes do cron pagavam o bonus DUAS VEZES, para ela e para quem
 * indicou. Corte e barba marcados como dois atendimentos no mesmo dia bastam. Ponto de fidelidade
 * e resgatavel, entao e dinheiro saindo por engano — e do jeito mais dificil de perceber, porque
 * o extrato mostra dois lancamentos com o mesmo motivo e nada acusa.
 *
 * O sinal certo e o LIVRO-RAZAO, nao um contador derivado: se o lancamento existe, o bonus ja foi
 * pago. Idempotente por construcao, que e o que uma regra de "primeira vez" precisa ser.
 */
export type EntradaDeIndicacao = {
  /** Quanto o salao configurou de bonus. Zero desliga a regra. */
  bonusPoints: number
  /** Quem indicou esta cliente, se alguem indicou. */
  referredBy: string | null
  /** Ja existe lancamento de "veio por indicacao" para esta cliente. */
  bonusJaCreditado: boolean
}

export function deveCreditarIndicacao(e: EntradaDeIndicacao): boolean {
  if (e.bonusPoints <= 0) return false
  if (!e.referredBy) return false
  return !e.bonusJaCreditado
}
