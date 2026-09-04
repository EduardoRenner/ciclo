import { z } from 'zod'

import { calcularNovoCustoMedio } from '@/core/estoque/media-movel'
import { AppError } from '@/server/http/errors'

import type { Database } from '@/server/db/types.gen'
import type { SupabaseClient } from '@supabase/supabase-js'

type Cliente = SupabaseClient<Database>

/**
 * §5.6/TICKET-044: "baixa ao FECHAR a comanda (não ao abrir)". Um item de serviço consome os
 * produtos da própria ficha de consumo (`service_products`, quanto*qty do serviço); um item de
 * produto vendido direto (revenda) consome a si mesmo. Nunca bloqueia o fechamento por estoque
 * insuficiente (F83) — só desce o número, mesmo que fique negativo.
 */
export async function baixarEstoqueDaComanda(db: Cliente, tenantId: string, ticketId: string): Promise<void> {
  const { data: items, error: erroItems } = await db.from('ticket_items').select('id, qty, service_id, product_id').eq('tenant_id', tenantId).eq('ticket_id', ticketId)
  if (erroItems) throw new AppError('INTERNAL', { cause: erroItems })

  const consumoPorProduto = new Map<string, number>()

  const servicosComItem = (items ?? []).filter((i) => i.service_id).map((i) => ({ serviceId: i.service_id!, qtyItem: i.qty }))
  if (servicosComItem.length > 0) {
    const { data: fichas, error: erroFichas } = await db
      .from('service_products')
      .select('service_id, product_id, qty')
      .eq('tenant_id', tenantId)
      .in('service_id', [...new Set(servicosComItem.map((s) => s.serviceId))])
    if (erroFichas) throw new AppError('INTERNAL', { cause: erroFichas })

    for (const item of servicosComItem) {
      for (const ficha of fichas ?? []) {
        if (ficha.service_id !== item.serviceId) continue
        const consumo = ficha.qty * item.qtyItem
        consumoPorProduto.set(ficha.product_id, (consumoPorProduto.get(ficha.product_id) ?? 0) + consumo)
      }
    }
  }

  for (const item of items ?? []) {
    if (!item.product_id) continue
    consumoPorProduto.set(item.product_id, (consumoPorProduto.get(item.product_id) ?? 0) + item.qty)
  }

  // Cada produto é uma linha independente (`consumoPorProduto` já está deduplicado e somado por
  // `productId`), então os `registrarMovimento` de produtos diferentes não competem por linha
  // nenhuma — rodavam em série, três idas ao banco por produto, uma comanda de N produtos atrás
  // da outra no fechamento (docs/28-LATENCIA-DE-CLIQUE-PLANO.md §10).
  await Promise.all(
    [...consumoPorProduto].map(([productId, qty]) =>
      registrarMovimento(db, tenantId, {
        productId,
        kind: 'out',
        qty: -qty,
        source: 'ticket',
        sourceId: ticketId,
      }),
    ),
  )
}

/**
 * F81: "jamais delete o movimento original" — o estorno é um movimento `return` novo, positivo,
 * do mesmo tamanho de cada `out` gerado por este ticket. Idempotente contra ticket sem baixa
 * nenhuma (loja sem produto cadastrado, por exemplo): não acha `out` nenhum, não faz nada.
 */
export async function estornarBaixaDaComanda(db: Cliente, tenantId: string, ticketId: string): Promise<void> {
  const { data: saidas, error } = await db.from('stock_moves').select('product_id, qty').eq('tenant_id', tenantId).eq('source', 'ticket').eq('source_id', ticketId).eq('kind', 'out')
  if (error) throw new AppError('INTERNAL', { cause: error })

  for (const saida of saidas ?? []) {
    await registrarMovimento(db, tenantId, {
      productId: saida.product_id,
      kind: 'return',
      qty: -saida.qty, // saida.qty já é negativo (saída) — inverte pra devolver positivo
      source: 'reversal',
      sourceId: ticketId,
    })
  }
}

type EntradaMovimento = { productId: string; kind: Database['public']['Enums']['stock_move_type']; qty: number; source: string; sourceId?: string; unitCostCents?: number; note?: string }

async function registrarMovimento(db: Cliente, tenantId: string, entrada: EntradaMovimento): Promise<void> {
  const { data: produto, error: erroProduto } = await db.from('products').select('stock_qty, avg_cost_cents').eq('tenant_id', tenantId).eq('id', entrada.productId).maybeSingle()
  if (erroProduto) throw new AppError('INTERNAL', { cause: erroProduto })
  if (!produto) throw new AppError('NOT_FOUND')

  const { error: erroInsert } = await db.from('stock_moves').insert({
    tenant_id: tenantId,
    product_id: entrada.productId,
    kind: entrada.kind,
    qty: entrada.qty,
    unit_cost_cents: entrada.unitCostCents ?? produto.avg_cost_cents,
    source: entrada.source,
    source_id: entrada.sourceId ?? null,
    note: entrada.note ?? null,
  })
  if (erroInsert) throw new AppError('INTERNAL', { cause: erroInsert })

  const { error: erroUpdate } = await db
    .from('products')
    .update({ stock_qty: produto.stock_qty + entrada.qty })
    .eq('tenant_id', tenantId)
    .eq('id', entrada.productId)
  if (erroUpdate) throw new AppError('INTERNAL', { cause: erroUpdate })
}

export const EsquemaEntradaEstoque = z.object({
  productId: z.string().uuid(),
  qty: z.number().positive(),
  unitCostCents: z.number().int().nonnegative(),
  note: z.string().trim().max(500).nullish(),
})
export type EntradaEstoqueManual = z.infer<typeof EsquemaEntradaEstoque>

/**
 * Compra/reposição manual — a única forma de `avg_cost_cents` sair de 0 e ficar de verdade em
 * dia (nenhum outro fluxo desta base sabe QUANTO custou o produto).
 */
export async function registrarEntradaEstoque(db: Cliente, tenantId: string, entrada: EntradaEstoqueManual) {
  const { data: produto, error } = await db.from('products').select('stock_qty, avg_cost_cents').eq('tenant_id', tenantId).eq('id', entrada.productId).maybeSingle()
  if (error) throw new AppError('INTERNAL', { cause: error })
  if (!produto) throw new AppError('NOT_FOUND')

  const novoCustoMedio = calcularNovoCustoMedio({
    estoqueAtualQty: produto.stock_qty,
    custoMedioAtualCents: produto.avg_cost_cents,
    qtyEntrada: entrada.qty,
    custoUnitarioEntradaCents: entrada.unitCostCents,
  })

  const { error: erroInsert } = await db.from('stock_moves').insert({
    tenant_id: tenantId,
    product_id: entrada.productId,
    kind: 'in',
    qty: entrada.qty,
    unit_cost_cents: entrada.unitCostCents,
    source: 'purchase',
    note: entrada.note ?? null,
  })
  if (erroInsert) throw new AppError('INTERNAL', { cause: erroInsert })

  const { data: produtoAtualizado, error: erroUpdate } = await db
    .from('products')
    .update({ stock_qty: produto.stock_qty + entrada.qty, avg_cost_cents: novoCustoMedio })
    .eq('tenant_id', tenantId)
    .eq('id', entrada.productId)
    .select('*')
    .single()
  if (erroUpdate) throw new AppError('INTERNAL', { cause: erroUpdate })

  return produtoAtualizado
}

/**
 * Produtos DE REVENDA ativos, para quem precisa RESOLVER um nome em id — o assistente lançando
 * item na comanda. Devolve o preço junto só para o cartão de confirmação mostrar; quem decide o
 * preço cobrado continua sendo `adicionarItemComanda`, lendo o catálogo na hora.
 *
 * `is_retail` filtra porque `products` guarda duas naturezas na mesma tabela: revenda (shampoo,
 * óleo de barba) e INSUMO (água oxigenada, luva, navalha descartável), que o serviço consome pela
 * ficha de `service_products` e já entra em `material_cost_cents`. Sem o filtro, o assistente
 * oferecia os 37 insumos da produção como se fossem vendáveis — e todos com `price_cents` nulo,
 * então lançar um deles cobrava R$ 0,00 e ainda tirava a peça do estoque uma segunda vez.
 */
export async function listarProdutosAtivos(db: Cliente, tenantId: string) {
  const { data, error } = await db
    .from('products')
    .select('id, name, price_cents, stock_qty')
    .eq('tenant_id', tenantId)
    .eq('active', true)
    .eq('is_retail', true)
    .is('deleted_at', null)
    .order('name')
  if (error) throw new AppError('INTERNAL', { cause: error })
  return data ?? []
}
