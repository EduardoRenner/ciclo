import { z } from 'zod'

import { calcularComissaoItem, calcularTotalItem, calcularTotaisComanda, type BaseComissao } from '@/core/comanda/totals'
import { AppError } from '@/server/http/errors'

import type { Database } from '@/server/db/types.gen'
import type { SupabaseClient } from '@supabase/supabase-js'

type Cliente = SupabaseClient<Database>

const PRODUCT_COMMISSION_BPS_PADRAO = 1_000 // F80: 10% padrão, configurável em settings.product_commission_bps

export const EsquemaItemComanda = z
  .object({
    serviceId: z.string().uuid().optional(),
    productId: z.string().uuid().optional(),
    professionalId: z.string().uuid(),
    qty: z.number().positive().default(1),
    unitPriceCents: z.number().int().nonnegative().optional(),
    discountCents: z.number().int().nonnegative().default(0),
  })
  .refine((v) => Boolean(v.serviceId) !== Boolean(v.productId), { message: 'Escolha um serviço OU um produto, nunca os dois.' })
export type EntradaItemComanda = z.infer<typeof EsquemaItemComanda>

export const EsquemaDescontoGorjeta = z.object({
  discountCents: z.number().int().nonnegative().optional(),
  tipCents: z.number().int().nonnegative().optional(),
})
export type EntradaDescontoGorjeta = z.infer<typeof EsquemaDescontoGorjeta>

async function buscarTicketAberto(db: Cliente, tenantId: string, ticketId: string) {
  const { data, error } = await db.from('tickets').select('*').eq('tenant_id', tenantId).eq('id', ticketId).maybeSingle()
  if (error) throw new AppError('INTERNAL', { cause: error })
  if (!data) throw new AppError('NOT_FOUND')
  if (data.status !== 'open') throw new AppError('INVALID_TRANSITION', { message: 'Essa comanda já foi fechada.' })
  return data
}

/** Link "Ver comanda" da agenda só conhece o `appointmentId` — resolve o ticket pra redirecionar. */
export async function buscarTicketIdPorAgendamento(db: Cliente, tenantId: string, appointmentId: string): Promise<string | null> {
  const { data, error } = await db.from('tickets').select('id').eq('tenant_id', tenantId).eq('appointment_id', appointmentId).maybeSingle()
  if (error) throw new AppError('INTERNAL', { cause: error })
  return data?.id ?? null
}

export async function buscarComanda(db: Cliente, tenantId: string, ticketId: string) {
  const { data: ticket, error: erroTicket } = await db.from('tickets').select('*').eq('tenant_id', tenantId).eq('id', ticketId).maybeSingle()
  if (erroTicket) throw new AppError('INTERNAL', { cause: erroTicket })
  if (!ticket) throw new AppError('NOT_FOUND')

  const { data: items, error: erroItems } = await db
    .from('ticket_items')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('ticket_id', ticketId)
    .order('id')
  if (erroItems) throw new AppError('INTERNAL', { cause: erroItems })

  return { ticket, items: items ?? [] }
}

/**
 * §5.7: preço/comissão só congelam no FECHAMENTO — os itens da comanda aberta guardam o preço
 * "de agora" (catálogo, com override manual opcional), mas `commission_bps`/`commission_cents`
 * ficam em 0 até `fecharComanda` calcular com a comissão vigente naquele momento. Assim mudar o
 * percentual de comissão de um profissional no meio do atendimento não é uma corrida — o que
 * vale é a comissão configurada quando a comanda foi fechada, não quando o item foi lançado.
 */
export async function adicionarItemComanda(db: Cliente, tenantId: string, ticketId: string, entrada: EntradaItemComanda) {
  await buscarTicketAberto(db, tenantId, ticketId)

  let description: string
  let unitPriceCents: number
  let costCents: number

  if (entrada.serviceId) {
    const { data: servico, error } = await db.from('services').select('name, price_cents, cost_cents').eq('tenant_id', tenantId).eq('id', entrada.serviceId).maybeSingle()
    if (error) throw new AppError('INTERNAL', { cause: error })
    if (!servico) throw new AppError('NOT_FOUND')
    description = servico.name
    unitPriceCents = entrada.unitPriceCents ?? servico.price_cents
    costCents = servico.cost_cents
  } else {
    const { data: produto, error } = await db.from('products').select('name, price_cents, avg_cost_cents').eq('tenant_id', tenantId).eq('id', entrada.productId!).maybeSingle()
    if (error) throw new AppError('INTERNAL', { cause: error })
    if (!produto) throw new AppError('NOT_FOUND')
    description = produto.name
    unitPriceCents = entrada.unitPriceCents ?? produto.price_cents ?? 0
    costCents = produto.avg_cost_cents
  }

  const totalCents = calcularTotalItem({ qty: entrada.qty, unitPriceCents, discountCents: entrada.discountCents })

  const { data: item, error: erroInsert } = await db
    .from('ticket_items')
    .insert({
      tenant_id: tenantId,
      ticket_id: ticketId,
      service_id: entrada.serviceId ?? null,
      product_id: entrada.productId ?? null,
      professional_id: entrada.professionalId,
      description,
      qty: entrada.qty,
      unit_price_cents: unitPriceCents,
      discount_cents: entrada.discountCents,
      total_cents: totalCents,
      cost_cents: Math.round(entrada.qty * costCents),
    })
    .select('*')
    .single()
  if (erroInsert) throw new AppError('INTERNAL', { cause: erroInsert })

  await recalcularSubtotal(db, tenantId, ticketId)
  return item
}

export async function removerItemComanda(db: Cliente, tenantId: string, ticketId: string, itemId: string): Promise<void> {
  await buscarTicketAberto(db, tenantId, ticketId)

  const { error } = await db.from('ticket_items').delete().eq('tenant_id', tenantId).eq('ticket_id', ticketId).eq('id', itemId)
  if (error) throw new AppError('INTERNAL', { cause: error })

  await recalcularSubtotal(db, tenantId, ticketId)
}

async function recalcularSubtotal(db: Cliente, tenantId: string, ticketId: string): Promise<void> {
  const { ticket, items } = await buscarComanda(db, tenantId, ticketId)
  const { subtotalCents, totalCents } = calcularTotaisComanda({ items: items.map((i) => ({ totalCents: i.total_cents })), discountCents: ticket.discount_cents, tipCents: ticket.tip_cents })

  const { error } = await db.from('tickets').update({ subtotal_cents: subtotalCents, total_cents: totalCents }).eq('tenant_id', tenantId).eq('id', ticketId)
  if (error) throw new AppError('INTERNAL', { cause: error })
}

export async function atualizarDescontoEGorjeta(db: Cliente, tenantId: string, ticketId: string, entrada: EntradaDescontoGorjeta) {
  await buscarTicketAberto(db, tenantId, ticketId)

  const atualizacao: Database['public']['Tables']['tickets']['Update'] = {}
  if (entrada.discountCents !== undefined) atualizacao.discount_cents = entrada.discountCents
  if (entrada.tipCents !== undefined) atualizacao.tip_cents = entrada.tipCents

  const { error } = await db.from('tickets').update(atualizacao).eq('tenant_id', tenantId).eq('id', ticketId)
  if (error) throw new AppError('INTERNAL', { cause: error })

  await recalcularSubtotal(db, tenantId, ticketId)
}

type Settings = { commission_base?: BaseComissao; product_commission_bps?: number }

/**
 * §5.7: percentual do vínculo profissional×serviço, senão do profissional, senão do tenant (0
 * aqui — a especificação não define um piso diferente de zero). Produto usa
 * `settings.product_commission_bps` (F80), nunca o percentual de serviço.
 */
async function resolverCommissionBps(db: Cliente, tenantId: string, item: { service_id: string | null; product_id: string | null; professional_id: string | null }): Promise<number> {
  if (item.product_id) {
    const { data: tenant } = await db.from('tenants').select('settings').eq('id', tenantId).maybeSingle()
    const settings = (tenant?.settings ?? {}) as Settings
    return settings.product_commission_bps ?? PRODUCT_COMMISSION_BPS_PADRAO
  }
  if (!item.service_id || !item.professional_id) return 0

  const { data: vinculo } = await db
    .from('professional_services')
    .select('commission_bps')
    .eq('tenant_id', tenantId)
    .eq('professional_id', item.professional_id)
    .eq('service_id', item.service_id)
    .maybeSingle()
  if (vinculo?.commission_bps !== null && vinculo?.commission_bps !== undefined) return vinculo.commission_bps

  const { data: profissional } = await db.from('professionals').select('commission_bps').eq('tenant_id', tenantId).eq('id', item.professional_id).maybeSingle()
  return profissional?.commission_bps ?? 0
}

/**
 * TICKET-042: "fechar congela preço e comissão" — a partir daqui a linha nunca muda, mesmo que o
 * percentual de comissão do profissional ou o preço do serviço mudem depois. `payments`/webhook
 * (TICKET-043) é quem move `closed` pra `paid`; aqui só fecha o carrinho.
 */
export async function fecharComanda(db: Cliente, tenantId: string, ticketId: string) {
  const { ticket, items } = await buscarComanda(db, tenantId, ticketId)
  if (ticket.status !== 'open') throw new AppError('INVALID_TRANSITION', { message: 'Essa comanda já foi fechada.' })
  if (items.length === 0) throw AppError.validacao({ items: 'Adicione pelo menos um item antes de fechar.' })

  const { data: tenant } = await db.from('tenants').select('settings').eq('id', tenantId).maybeSingle()
  const commissionBase = ((tenant?.settings as Settings | null)?.commission_base ?? 'gross') as BaseComissao

  let commissaoTotalCents = 0
  for (const item of items) {
    const commissionBps = await resolverCommissionBps(db, tenantId, item)
    const commissionCents = calcularComissaoItem({ totalCents: item.total_cents, costCents: item.cost_cents, commissionBps, commissionBase })
    commissaoTotalCents += commissionCents

    const { error } = await db.from('ticket_items').update({ commission_bps: commissionBps, commission_cents: commissionCents }).eq('tenant_id', tenantId).eq('id', item.id)
    if (error) throw new AppError('INTERNAL', { cause: error })
  }

  const { subtotalCents, totalCents } = calcularTotaisComanda({ items: items.map((i) => ({ totalCents: i.total_cents })), discountCents: ticket.discount_cents, tipCents: ticket.tip_cents })
  const custoTotalCents = items.reduce((soma, item) => soma + item.cost_cents, 0)
  const profitCents = subtotalCents - custoTotalCents - commissaoTotalCents

  const { data: fechado, error } = await db
    .from('tickets')
    .update({
      status: 'closed',
      subtotal_cents: subtotalCents,
      total_cents: totalCents,
      commission_cents: commissaoTotalCents,
      material_cost_cents: custoTotalCents,
      profit_cents: profitCents,
      closed_at: new Date().toISOString(),
    })
    .eq('tenant_id', tenantId)
    .eq('id', ticketId)
    .select('*')
    .single()
  if (error) throw new AppError('INTERNAL', { cause: error })

  return fechado
}
