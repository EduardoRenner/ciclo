/**
 * `docs/53` A-01 — o que a forma de pagamento custou no mês, e o que as outras formas que o salão
 * já usa teriam custado no mesmo volume.
 *
 * A pergunta que nenhum dos 31 concorrentes pesquisados responde (`docs/52` §4.1, §5 pergunta 4):
 * quem dá a agenda de graça ganha da taxa, e por isso nunca pode chamá-la de custo do lojista. O
 * CICLO não ganha nada do fluxo — pode.
 *
 * `tickets.fee_cents` já vem congelado no fechamento (`0066`), pelo `fee_bps` que valia naquele
 * dia. Esta função não recalcula nada do passado: soma o que já foi cobrado, e só o QUE SERIA
 * DIFERENTE (a contrafactual) usa o percentual de HOJE — porque essa parte é explicitamente
 * hipotética, nunca apresentada como "o que você pagou".
 */

import { FORMAS_DE_PAGAMENTO, type FormaDePagamento, type TaxasDePagamento } from '@/core/comanda/taxa-de-pagamento'

export type TicketDoMesParaTaxa = {
  /**
   * `string | null` porque o banco permite — comandas fechadas antes deste campo existir, ou por
   * um caminho que não passa pelo fechamento manual. Qualquer valor fora de `FORMAS_DE_PAGAMENTO`
   * (inclusive `club`/`package`/`voucher`, dinheiro que entrou por outro caminho) é ignorado aqui,
   * pelo mesmo motivo que `taxa-de-pagamento.ts` já exclui os três da lista de formas do fechamento.
   */
  paymentMethod: string | null
  totalCents: number
  feeCents: number
}

export type LinhaTaxaPorForma = {
  forma: FormaDePagamento
  atendimentos: number
  totalCents: number
  /** Real, congelado — soma de `fee_cents` das comandas fechadas nesta forma. */
  feeCents: number
}

export type ContrafactualDeForma = {
  forma: FormaDePagamento
  feeBps: number
  /** Se TODO o volume do mês tivesse passado por esta forma, ao percentual configurado hoje. */
  feeCentsSeTudoFosseAssim: number
}

export type TaxaDoMes =
  | { respondida: false }
  | {
      respondida: true
      porForma: LinhaTaxaPorForma[]
      totalFeeCents: number
      volumeTotalCents: number
      /**
       * Só as formas que o salão **já usou** neste mês — nunca uma forma que ele nunca aceitou.
       * Propor "e se fosse crédito" para quem não tem maquininha de cartão é número de marketing,
       * não informação (`docs/53` §3.1, a mesma régua do `docs/50` §5.6).
       */
      contrafactual: ContrafactualDeForma[]
    }

export function calcularTaxaDoMes(tickets: readonly TicketDoMesParaTaxa[], taxas: TaxasDePagamento, respondida: boolean): TaxaDoMes {
  if (!respondida) return { respondida: false }

  const porForma: LinhaTaxaPorForma[] = FORMAS_DE_PAGAMENTO.map((forma) => {
    const doFormato = tickets.filter((t) => t.paymentMethod === forma)
    return {
      forma,
      atendimentos: doFormato.length,
      totalCents: doFormato.reduce((soma, t) => soma + t.totalCents, 0),
      feeCents: doFormato.reduce((soma, t) => soma + t.feeCents, 0),
    }
  }).filter((linha) => linha.atendimentos > 0)

  const totalFeeCents = porForma.reduce((soma, l) => soma + l.feeCents, 0)
  const volumeTotalCents = porForma.reduce((soma, l) => soma + l.totalCents, 0)

  const contrafactual: ContrafactualDeForma[] = porForma.map((linha) => ({
    forma: linha.forma,
    feeBps: taxas[linha.forma],
    feeCentsSeTudoFosseAssim: Math.round((volumeTotalCents * taxas[linha.forma]) / 10_000),
  }))

  return { respondida: true, porForma, totalFeeCents, volumeTotalCents, contrafactual }
}
