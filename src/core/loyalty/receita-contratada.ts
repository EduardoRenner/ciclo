/**
 * CICLO Clube · C-06 (docs/60) — quanto o clube já garante todo mês, separado da receita avulsa
 * que depende de agenda cheia.
 *
 * Soma simples e pura: existe em `core/` (regra 5 do CLAUDE.md) porque, mesmo trivial, é regra de
 * negócio — "o que conta como receita contratada" pode crescer (por exemplo, excluir assinatura em
 * inadimplência quando C-09 existir) e não deve virar SQL espalhado.
 */
export type AssinaturaAtivaParaReceita = { priceCents: number }

export function receitaContratadaCents(assinaturas: readonly AssinaturaAtivaParaReceita[]): number {
  return assinaturas.reduce((soma, a) => soma + a.priceCents, 0)
}
