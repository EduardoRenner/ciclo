import { z } from 'zod'

import { calcularComissaoItem, calcularSobraDaComanda, calcularTotalItem, calcularTotaisComanda, type BaseComissao } from '@/core/comanda/totals'
import { AppError } from '@/server/http/errors'
import { baixarEstoqueDaComanda, estornarBaixaDaComanda } from '@/server/services/estoque'

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
  // As duas consultas não dependem uma da outra — `items` só precisa do `ticketId`, que já veio
  // por parâmetro. Rodavam em série (docs/28-LATENCIA-DE-CLIQUE-PLANO.md §10): abrir uma comanda
  // pagava duas idas ao banco uma atrás da outra, na tela mais operacional do dia a dia. Quando o
  // ticket não existe, a consulta de itens volta vazia à toa — troca aceitável por não pagar duas
  // idas em série no caminho comum, que é o ticket existir.
  const [{ data: ticket, error: erroTicket }, { data: items, error: erroItems }] = await Promise.all([
    db.from('tickets').select('*').eq('tenant_id', tenantId).eq('id', ticketId).maybeSingle(),
    db.from('ticket_items').select('*').eq('tenant_id', tenantId).eq('ticket_id', ticketId).order('id'),
  ])
  if (erroTicket) throw new AppError('INTERNAL', { cause: erroTicket })
  if (!ticket) throw new AppError('NOT_FOUND')
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
  const profitCents = calcularSobraDaComanda({
    subtotalCents,
    discountCents: ticket.discount_cents,
    tipCents: ticket.tip_cents,
    materialCents: custoTotalCents,
    feeCents: ticket.fee_cents,
    commissionCents: commissaoTotalCents,
  })

  // `.eq('status', 'open')` no próprio UPDATE, e não só na leitura acima: entre o
  // `buscarComanda` e este ponto rodam N consultas de comissão, uma por item. Duas requisições
  // simultâneas passavam as duas pela verificação de estado e fechavam a mesma comanda duas
  // vezes — e `baixarEstoqueDaComanda` não é idempotente, então o estoque descia em dobro sem
  // nada reprovar. É a mesma correção que o achado S11 fez no débito de carteira: quem decide o
  // estado é o banco, numa operação só.
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
    .eq('status', 'open')
    .select('*')
    .maybeSingle()
  if (error) throw new AppError('INTERNAL', { cause: error })
  if (!fechado) throw new AppError('INVALID_TRANSITION', { message: 'Essa comanda já foi fechada.' })

  // §5.6/TICKET-044: baixa DEPOIS de fechar, nunca ao abrir — uma comanda aberta pode ganhar e
  // perder item várias vezes antes de fechar, e nada disso deveria mexer em estoque de verdade.
  await baixarEstoqueDaComanda(db, tenantId, ticketId)

  return fechado
}

/**
 * F81: estorno de comanda FECHADA (não paga — comanda `paid` precisa reverter pagamento também,
 * escopo do TICKET-043, ainda bloqueado por credencial). Reverte o estoque com movimento `return`
 * novo (nunca apaga o `out` original) e move a comanda pra `canceled`.
 */
export async function cancelarComandaFechada(db: Cliente, tenantId: string, ticketId: string) {
  const { data: ticket, error: erroTicket } = await db.from('tickets').select('status').eq('tenant_id', tenantId).eq('id', ticketId).maybeSingle()
  if (erroTicket) throw new AppError('INTERNAL', { cause: erroTicket })
  if (!ticket) throw new AppError('NOT_FOUND')
  if (ticket.status !== 'closed') throw new AppError('INVALID_TRANSITION', { message: 'Só dá para cancelar uma comanda fechada e ainda não paga.' })

  // Mesma razão do `fecharComanda`: a troca de estado vem ANTES do estorno, e com
  // `.eq('status', 'closed')` no próprio UPDATE. `estornarBaixaDaComanda` lê os `out` do ticket e
  // gera um `return` para cada um — chamada duas vezes, devolve o dobro ao estoque e ninguém
  // percebe. Quem perder a corrida não passa daqui e não estorna nada.
  const { data: cancelado, error } = await db
    .from('tickets')
    .update({ status: 'canceled' })
    .eq('tenant_id', tenantId)
    .eq('id', ticketId)
    .eq('status', 'closed')
    .select('*')
    .maybeSingle()
  if (error) throw new AppError('INTERNAL', { cause: error })
  if (!cancelado) throw new AppError('INVALID_TRANSITION', { message: 'Só dá para cancelar uma comanda fechada e ainda não paga.' })

  await estornarBaixaDaComanda(db, tenantId, ticketId)

  return cancelado
}
