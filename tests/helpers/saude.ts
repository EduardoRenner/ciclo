import { readdirSync } from 'node:fs'

/**
 * Banco encenado para `verificarSaude` — só a superfície que ela toca, nada de rede.
 *
 * Mora aqui porque DOIS testes precisam do mesmo dublê (`motor-de-ciclo-observavel` e
 * `saude-vigia-so-o-que-roda`), e a alternativa era a segunda cópia, que é como a leitura do
 * `cron.yml` já tinha errado uma vez de arquivo (ver `tests/helpers/cron.ts`).
 */

/**
 * A lista que `migracoes_aplicadas` devolveria num banco em dia: o proprio disco.
 *
 * Fixar aqui um array escrito a mao seria uma terceira copia da lista de migrations (o disco e
 * `core/schema/versao.ts` ja sao duas), e ela ficaria velha na primeira migration nova — deixando
 * o dublê vermelho por um defeito que nao existe.
 */
function migracoesDoDisco(): { name: string }[] {
  return readdirSync('supabase/migrations')
    .filter((nome) => nome.endsWith('.sql'))
    .map((nome) => ({ name: nome.replace(/\.sql$/, '') }))
}

/** `heartbeats` mapeia kind → minutos atrás. `null` = a linha não existe (job nunca rodou). */
export function bancoDeSaudeFalso(heartbeats: Record<string, number | null>, migracoes: { name: string }[] = migracoesDoDisco()) {
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
  return {
    from: (tabela: string) => construtor(tabela),
    rpc: async (nome: string) => (nome === 'migracoes_aplicadas' ? { data: migracoes, error: null } : { data: null, error: { code: 'PGRST202' } }),
  } as never
}

/** Todos os heartbeats recentes, menos os que o caso quiser envelhecer ou apagar. */
export function bancoSaudavel(sobrescreve: Record<string, number | null> = {}, migracoes?: { name: string }[]) {
  return bancoDeSaudeFalso({ send_reminders: 5, send_campaigns: 60, recompute_cycles: 60, recompute_segments: 60, ...sobrescreve }, migracoes)
}

/**
 * Banco onde a leitura da lista de migrations FALHA, com o código que o caso quiser.
 *
 * `PGRST202` é o caso real medido em 2026-09-10: a função `migracoes_aplicadas` (criada pela
 * `0062`) não existe, o que prova que o banco está antes dela. Qualquer outro código é ambíguo.
 * Tudo o mais fica saudável de propósito, para o caso isolar a checagem de schema.
 */
export function bancoComLeituraDeMigrationsFalhando(codigo: string) {
  const base = bancoDeSaudeFalso({ send_reminders: 5, send_campaigns: 60, recompute_cycles: 60, recompute_segments: 60 }) as unknown as Record<
    string,
    unknown
  >
  return { ...base, rpc: async () => ({ data: null, error: { code: codigo } }) } as never
}
