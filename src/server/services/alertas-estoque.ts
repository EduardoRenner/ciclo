import { Temporal } from '@js-temporal/polyfill'

import { calcularDiasDeCobertura, estadoValidade, precisaRecomprar, type EstadoValidade } from '@/core/estoque/alertas'
import { AppError } from '@/server/http/errors'

import type { Database } from '@/server/db/types.gen'
import type { SupabaseClient } from '@supabase/supabase-js'

type Cliente = SupabaseClient<Database>

const JANELA_CONSUMO_DIAS = 30

export type AlertaEstoque = {
  productId: string
  name: string
  stockQty: number
  reorderPoint: number
  diasDeCobertura: number | null
  precisaRecomprar: boolean
  validade: EstadoValidade
}

/**
 * TICKET-045 (§5.6). Consumo médio diário = soma de tudo que saiu (`stock_moves.kind = 'out'`)
 * nos últimos 30 dias, dividido por 30 — mesmo produto que não vendeu nada nesse período tem
 * `diasDeCobertura = null` (não "infinito"), porque não há base pra prever quando acaba.
 */
export async function listarAlertasDeEstoque(db: Cliente, tenantId: string, hoje: string): Promise<AlertaEstoque[]> {
  const hojePlain = Temporal.PlainDate.from(hoje)
  const desde = hojePlain.subtract({ days: JANELA_CONSUMO_DIAS }).toString()

  const [{ data: produtos, error: erroProdutos }, { data: saidas, error: erroSaidas }] = await Promise.all([
    db.from('products').select('id, name, stock_qty, reorder_point, expires_at').eq('tenant_id', tenantId).eq('active', true).is('deleted_at', null),
    db.from('stock_moves').select('product_id, qty').eq('tenant_id', tenantId).eq('kind', 'out').gte('created_at', `${desde}T00:00:00Z`),
  ])
  if (erroProdutos) throw new AppError('INTERNAL', { cause: erroProdutos })
  if (erroSaidas) throw new AppError('INTERNAL', { cause: erroSaidas })

  const consumoTotalPorProduto = new Map<string, number>()
  for (const saida of saidas ?? []) {
    consumoTotalPorProduto.set(saida.product_id, (consumoTotalPorProduto.get(saida.product_id) ?? 0) + Math.abs(saida.qty))
  }

  const alertas: AlertaEstoque[] = []
  for (const produto of produtos ?? []) {
    const consumoMedioDiario = (consumoTotalPorProduto.get(produto.id) ?? 0) / JANELA_CONSUMO_DIAS
    const diasDeCobertura = calcularDiasDeCobertura(produto.stock_qty, consumoMedioDiario)
    const recompra = precisaRecomprar({ estoqueAtualQty: produto.stock_qty, reorderPointQty: produto.reorder_point, diasDeCobertura })
    const validade = estadoValidade(hojePlain, produto.expires_at ? Temporal.PlainDate.from(produto.expires_at) : null)

    if (!recompra && validade === 'ok') continue

    alertas.push({
      productId: produto.id,
      name: produto.name,
      stockQty: produto.stock_qty,
      reorderPoint: produto.reorder_point,
      diasDeCobertura,
      precisaRecomprar: recompra,
      validade,
    })
  }

  return alertas
}
