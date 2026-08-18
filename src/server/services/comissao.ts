import { AppError } from '@/server/http/errors'

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
 */
export async function extratoDeComissao(db: Cliente, tenantId: string, professionalId: string, desde: string, ate: string): Promise<ExtratoComissao> {
  const { data, error } = await db
    .from('ticket_items')
    .select('id, ticket_id, description, total_cents, commission_bps, commission_cents, tickets!inner(status, closed_at)')
    .eq('tenant_id', tenantId)
    .eq('professional_id', professionalId)
    .in('tickets.status', ['closed', 'paid'])
    .gte('tickets.closed_at', `${desde}T00:00:00Z`)
    .lte('tickets.closed_at', `${ate}T23:59:59Z`)
  if (error) throw new AppError('INTERNAL', { cause: error })

  const items: ItemExtratoComissao[] = (data ?? []).map((i) => ({
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
