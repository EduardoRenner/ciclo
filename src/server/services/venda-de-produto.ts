import { z } from 'zod'

import { FORMAS_DE_PAGAMENTO } from '@/core/comanda/taxa-de-pagamento'
import { AppError } from '@/server/http/errors'

import { adicionarItemComanda, fecharComanda } from './comanda'

import type { Database } from '@/server/db/types.gen'
import type { SupabaseClient } from '@supabase/supabase-js'

type Cliente = SupabaseClient<Database>

/**
 * A venda de balcão: produto, quantidade, quem vendeu e como pagou. Nada de comanda aberta para
 * lembrar de fechar depois.
 *
 * O desconto padrão de `paymentMethod` é Pix porque o campo é obrigatório no fechamento (sem ele a
 * taxa nunca existiria, `docs/49`) e a tela não deve forçar uma escolha para a venda mais comum.
 * Quem cobra taxa por forma já configurou a tela de taxas, e a escolha certa aparece nela.
 */
export const EsquemaVendaDeProduto = z.object({
  professionalId: z.string().uuid('Escolha quem vendeu.'),
  qty: z.number().int('A quantidade é um número inteiro.').min(1, 'Venda pelo menos 1.').max(999, 'Quantidade alta demais.').default(1),
  paymentMethod: z.enum(FORMAS_DE_PAGAMENTO).default('pix'),
})
export type EntradaVendaDeProduto = z.infer<typeof EsquemaVendaDeProduto>

/**
 * Abre a comanda, lança o item no nome de quem vendeu e fecha. É o fechamento que dá baixa no
 * estoque (`baixarEstoqueDaComanda`) e congela a comissão do item: a venda reaproveita o caminho
 * que a comanda de um atendimento já usa, em vez de uma segunda conta de estoque e de comissão que
 * divergiria da primeira (`docs/DECISOES.md`, "duas cópias da mesma fórmula").
 *
 * Se algo falhar depois de a comanda existir, ela é cancelada: uma comanda aberta e vazia no
 * caixa do dia é pior que o erro que a causou.
 */
export async function venderProduto(db: Cliente, tenantId: string, productId: string, entrada: EntradaVendaDeProduto) {
  const { data: profissional, error: erroProfissional } = await db
    .from('professionals')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('id', entrada.professionalId)
    .eq('active', true)
    .is('deleted_at', null)
    .maybeSingle()
  if (erroProfissional) throw new AppError('INTERNAL', { cause: erroProfissional })
  if (!profissional) throw AppError.validacao({ professionalId: 'Essa pessoa não está mais na equipe.' })

  const { data: ticket, error: erroTicket } = await db
    .from('tickets')
    .insert({ tenant_id: tenantId, professional_id: entrada.professionalId })
    .select('id')
    .single()
  if (erroTicket) throw new AppError('INTERNAL', { cause: erroTicket })

  try {
    await adicionarItemComanda(db, tenantId, ticket.id, {
      productId,
      professionalId: entrada.professionalId,
      qty: entrada.qty,
      discountCents: 0,
    })
    const fechado = await fecharComanda(db, tenantId, ticket.id, entrada.paymentMethod)

    const { data: produto, error: erroProduto } = await db
      .from('products')
      .select('id, stock_qty')
      .eq('tenant_id', tenantId)
      .eq('id', productId)
      .maybeSingle()
    if (erroProduto) throw new AppError('INTERNAL', { cause: erroProduto })

    return { ticketId: ticket.id, totalCents: fechado.total_cents, stockQty: produto?.stock_qty ?? null }
  } catch (erro) {
    // `.eq('status', 'open')` + `select`: se o fechamento chegou a acontecer, a comanda não está mais
    // aberta e não há o que cancelar (zero linhas é o esperado). Um erro AQUI não pode esconder o que
    // derrubou a venda, então só avisa.
    const { error: erroCancelar } = await db
      .from('tickets')
      .update({ status: 'canceled' })
      .eq('tenant_id', tenantId)
      .eq('id', ticket.id)
      .eq('status', 'open')
      .select('id')
    if (erroCancelar) {
      console.warn(JSON.stringify({ level: 'warn', event: 'venda_de_produto_cancelar_falhou', tenantId, ticketId: ticket.id }), erroCancelar)
    }
    throw erro
  }
}
