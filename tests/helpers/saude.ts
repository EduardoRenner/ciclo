/**
 * Banco encenado para `verificarSaude` — só a superfície que ela toca, nada de rede.
 *
 * Mora aqui porque DOIS testes precisam do mesmo dublê (`motor-de-ciclo-observavel` e
 * `saude-vigia-so-o-que-roda`), e a alternativa era a segunda cópia, que é como a leitura do
 * `cron.yml` já tinha errado uma vez de arquivo (ver `tests/helpers/cron.ts`).
 */

/** `heartbeats` mapeia kind → minutos atrás. `null` = a linha não existe (job nunca rodou). */
export function bancoDeSaudeFalso(heartbeats: Record<string, number | null>) {
  const construtor = (tabela: string) => {
    let kindPedido = ''
    const encadeavel: Record<string, unknown> = {
      select: () => encadeavel,
      limit: () => encadeavel,
      in: () => encadeavel,
      gte: () => encadeavel,
      lt: () => encadeavel,
      eq: (_coluna: string, valor: string) => {
        kindPedido = valor
        return encadeavel
      },
      maybeSingle: async () => {
        const minutos = heartbeats[kindPedido]
        if (minutos == null) return { data: null, error: null }
        return { data: { last_run_at: new Date(Date.now() - minutos * 60_000).toISOString() }, error: null }
      },
      then: (resolver: (v: unknown) => unknown) =>
        Promise.resolve(tabela === 'messages' ? { data: [], error: null } : { count: 0, error: null }).then(resolver),
    }
    return encadeavel
  }
  return { from: (tabela: string) => construtor(tabela) } as never
}

/** Todos os heartbeats recentes, menos os que o caso quiser envelhecer ou apagar. */
export function bancoSaudavel(sobrescreve: Record<string, number | null> = {}) {
  return bancoDeSaudeFalso({ send_reminders: 5, send_campaigns: 60, recompute_cycles: 60, recompute_segments: 60, ...sobrescreve })
}
