import { Temporal } from '@js-temporal/polyfill'

import { buscarTudoPaginado } from '@/server/db/paginar'

import type { Database } from '@/server/db/types.gen'
import type { SupabaseClient } from '@supabase/supabase-js'

type Cliente = SupabaseClient<Database>

export type ItemExtratoComissao = {
  ticketId: string
  itemId: string
  description: string
  totalCents: number
  commissionBps: number
  commissionCents: number
  closedAt: string
}

export type ExtratoComissao = {
  professionalId: string
  desde: string
  ate: string
  totalCents: number
  items: ItemExtratoComissao[]
}

/**
 * TICKET-046: "extrato por período fecha" — a soma das linhas listadas AQUI é exatamente
 * `totalCents`, nada calculado à parte. `commission_bps`/`commission_cents` já vêm congelados do
 * fechamento da comanda (TICKET-042/§5.7); mudar o percentual do profissional depois nunca
 * reescreve uma linha já fechada, então o mesmo extrato pedido duas vezes sempre bate igual.
 * Só `tickets.status in (closed, paid)` entra — comanda aberta ainda não tem comissão congelada.
 *
 * ## Três correções da auditoria de 2026-08-28
 *
 * O filtro de período era `closed_at >= '{desde}T00:00:00Z'` e `<= '{ate}T23:59:59Z'`. Três
 * defeitos numa linha, e os dois primeiros tiram dinheiro de quem trabalhou:
 *
 * 1. **O dia era UTC, não o fuso do salão.** É exatamente o bug que o `caixa.ts` documenta e
 *    evita desde o TICKET-047 — e o extrato de comissão aparece na MESMA TELA que o caixa
 *    (`admin/caixa/page.tsx`). Em Brasília, toda comanda fechada depois das 21h cai no dia
 *    seguinte em UTC: no fechamento do mês, ela some do mês trabalhado e reaparece no seguinte.
 *    Salão que fecha às 20h perde a última hora de todo dia; barbearia aberta até 22h perde mais.
 *    Dois números do mesmo mês, lado a lado, contavam dias diferentes.
 * 2. **`<= 23:59:59` não é o fim do dia.** Comanda fechada em `23:59:59.4` não entra em período
 *    nenhum — nem neste, nem no seguinte, que começa em `00:00:00`. O intervalo agora é
 *    semiaberto `[início, fim)`, como no `caixa.ts`.
 * 3. **Sem paginação.** O PostgREST corta a resposta no teto de linhas do projeto (1000) e não
 *    avisa: o extrato de um mês movimentado vinha truncado, e `totalCents`, somado das linhas
 *    devolvidas, vinha menor — sem nada na tela dizendo que faltou. O `caixa.ts` já paginava.
 */
export async function extratoDeComissao(
  db: Cliente,
  tenantId: string,
  professionalId: string,
  timezone: string,
  desde: string,
  ate: string,
): Promise<ExtratoComissao> {
  const inicio = Temporal.PlainDate.from(desde).toZonedDateTime({ timeZone: timezone, plainTime: '00:00' }).toInstant().toString()
  // `ate` é inclusivo para quem pede ("de 1 a 31 de março"), então o corte é o começo do dia
  // SEGUINTE. Meia-noite do dia seguinte no fuso do salão, não `23:59:59` em UTC.
  const fim = Temporal.PlainDate.from(ate).add({ days: 1 }).toZonedDateTime({ timeZone: timezone, plainTime: '00:00' }).toInstant().toString()

  /*
    `buscarTudoPaginado` em vez do laço à mão: era a quinta cópia da mesma paginação nesta base, e
    a única diferença que importava era o que a cópia NÃO tinha — teto. O laço era `for (;;)` com
    saída só na página curta; consulta que devolvesse sempre página cheia rodaria para sempre,
    prendendo a requisição. Num extrato de COMISSÃO, que é o que o profissional confere para saber
    quanto recebe, a alternativa de "devolver o que já juntou" seria pior que travar: um total
    redondo, plausível e menor que o devido.
  */
  const linhas = await buscarTudoPaginado(() =>
    db
      .from('ticket_items')
      .select('id, ticket_id, description, total_cents, commission_bps, commission_cents, tickets!inner(status, closed_at)')
      .eq('tenant_id', tenantId)
      .eq('professional_id', professionalId)
      .in('tickets.status', ['closed', 'paid'])
      .gte('tickets.closed_at', inicio)
      .lt('tickets.closed_at', fim)
      .order('id'),
  )

  const items: ItemExtratoComissao[] = linhas.map((i) => ({
    ticketId: i.ticket_id,
    itemId: i.id,
    description: i.description,
    totalCents: i.total_cents,
    commissionBps: i.commission_bps,
    commissionCents: i.commission_cents,
    closedAt: (i.tickets as unknown as { closed_at: string }).closed_at,
  }))

  return {
    professionalId,
    desde,
    ate,
    totalCents: items.reduce((soma, i) => soma + i.commissionCents, 0),
    items,
  }
}
