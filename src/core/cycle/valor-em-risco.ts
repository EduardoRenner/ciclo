import type { EstadoCiclo } from '@/core/cycle/compute'

/**
 * A segunda metade do `§5.3`: dado o estado que `compute.ts` calculou, quanto dinheiro está em
 * risco naquela combinação (cliente, serviço).
 *
 * **Por que mora aqui e não em `server/services/ciclo.ts`, de onde veio.** É `preço × fator`,
 * sem I/O — regra de negócio pura, que a regra 5 do `CLAUDE.md` manda pôr em `core/`. Estando no
 * serviço, a única forma de exercitá-la era o teste de integração (`tests/integration/ciclo.test.ts`),
 * que precisa subir um Supabase. Ou seja: a tabela que ORDENA a tela "Recuperar receita" — o
 * diferencial que sustenta o preço do produto — só era conferida com banco no ar, enquanto a
 * primeira metade do mesmo parágrafo da especificação (o estado, em `compute.ts`) tem teste de
 * unidade desde sempre. As duas metades agora ficam no mesmo lugar, testáveis do mesmo jeito.
 *
 * A promessa que isto sustenta está escrita na landing, palavra por palavra: *"a lista vem
 * ordenada por quanto vale chamar cada uma, que é o preço do serviço vezes a chance de ela
 * voltar"*. Conferido ponta a ponta: `client_cycles.value_at_risk_cents` recebe este valor,
 * `v_recover_revenue` o expõe, e `quemRecuperar` ordena por ele em ordem decrescente.
 */
export const PROBABILIDADE_POR_ESTADO: Record<EstadoCiclo, number> = {
  /*
   * `on_track` é 0 e não é omissão: quem está em dia não tem receita em risco. A view
   * `v_recover_revenue` já filtra esse estado fora da tela, mas o job recalcula TODA combinação,
   * então o valor precisa existir e precisa ser zero — não `undefined`.
   */
  on_track: 0,
  due: 0.85,
  late: 0.65,
  at_risk: 0.35,
  lost: 0.12,
}

export function valorEmRiscoCents(priceCents: number, state: string): number {
  const probabilidade = PROBABILIDADE_POR_ESTADO[state as EstadoCiclo] ?? 0
  // "sempre arredondado para baixo" — nunca prometer mais do que entrega.
  return Math.floor(priceCents * probabilidade)
}
