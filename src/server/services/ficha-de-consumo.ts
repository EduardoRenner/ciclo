import { z } from 'zod'

import { AppError } from '@/server/http/errors'

import type { Database } from '@/server/db/types.gen'
import type { SupabaseClient } from '@supabase/supabase-js'

type Cliente = SupabaseClient<Database>

/**
 * A ficha de consumo — quanto de cada produto um serviço gasta.
 *
 * A tabela `service_products` existe desde a `0001` e `baixarEstoqueDaComanda` a lê desde o
 * TICKET-044. Mas **nunca houve como preencher**: nenhuma tela, nenhuma rota, nenhum serviço
 * escrevia nela (`docs/49`). Duas coisas dependiam disso e ficavam paradas em silêncio: a baixa de
 * insumo no fechamento e — desde 2026-09-06 — o custo de material do serviço.
 *
 * É o mesmo padrão de `fee_cents` e `reorder_point`: mecanismo inteiro construído, esperando um
 * escritor que nunca chegou.
 */

export const EsquemaFichaDeConsumo = z
  .object({
    itens: z
      .array(
        z.object({
          productId: z.string().uuid(),
          // Decimal de propósito: 30 ml de oxigenada, 0,5 sachê. `numeric(12,3)` no banco.
          qty: z.number().positive().max(1_000_000),
        }),
      )
      .max(50),
  })
  .refine((v) => new Set(v.itens.map((i) => i.productId)).size === v.itens.length, {
    message: 'O mesmo produto aparece duas vezes na ficha. Some as quantidades numa linha só.',
    path: ['itens'],
  })
export type EntradaFichaDeConsumo = z.infer<typeof EsquemaFichaDeConsumo>

export type ItemDaFicha = {
  productId: string
  name: string
  unit: string
  qty: number
  avgCostCents: number
}

export async function listarFicha(db: Cliente, tenantId: string, serviceId: string): Promise<ItemDaFicha[]> {
  const { data, error } = await db
    .from('service_products')
    .select('product_id, qty, products(name, unit, avg_cost_cents)')
    .eq('tenant_id', tenantId)
    .eq('service_id', serviceId)
  if (error) throw new AppError('INTERNAL', { cause: error })

  return (data ?? [])
    .map((linha) => ({
      productId: linha.product_id,
      name: linha.products?.name ?? '',
      unit: linha.products?.unit ?? 'un',
      qty: linha.qty,
      avgCostCents: linha.products?.avg_cost_cents ?? 0,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
}

/**
 * Substitui a ficha inteira. Não é `PATCH` por linha de propósito: a tela edita a lista como um
 * bloco, e um "salvar" que só acrescenta deixaria produto removido na tela anterior descendo do
 * estoque para sempre, sem ninguém entender por quê.
 *
 * `service_products` não está entre as tabelas que a regra 11 do `CLAUDE.md` proíbe apagar
 * (agendamento, movimento de estoque, auditoria) — é cadastro, e o histórico do que já saiu do
 * estoque vive em `stock_moves`, intacto.
 */
export async function salvarFicha(db: Cliente, tenantId: string, serviceId: string, entrada: EntradaFichaDeConsumo): Promise<ItemDaFicha[]> {
  const { data: servico, error: erroServico } = await db.from('services').select('id').eq('tenant_id', tenantId).eq('id', serviceId).maybeSingle()
  if (erroServico) throw new AppError('INTERNAL', { cause: erroServico })
  if (!servico) throw new AppError('NOT_FOUND', { message: 'Esse serviço não está mais no seu catálogo.' })

  if (entrada.itens.length > 0) {
    // Confere que todo produto é do tenant ANTES de escrever: a FK garante que o produto existe,
    // não que ele é deste salão, e o `tenant_id` da linha vem do contexto.
    const ids = entrada.itens.map((i) => i.productId)
    const { data: produtos, error: erroProdutos } = await db.from('products').select('id').eq('tenant_id', tenantId).in('id', ids)
    if (erroProdutos) throw new AppError('INTERNAL', { cause: erroProdutos })
    if ((produtos ?? []).length !== new Set(ids).size) {
      throw AppError.validacao({ itens: 'Um dos produtos da ficha não está mais no seu estoque.' })
    }
  }

  const { error: erroDelete } = await db.from('service_products').delete().eq('tenant_id', tenantId).eq('service_id', serviceId)
  if (erroDelete) throw new AppError('INTERNAL', { cause: erroDelete })

  if (entrada.itens.length > 0) {
    const { error } = await db
      .from('service_products')
      .insert(entrada.itens.map((i) => ({ tenant_id: tenantId, service_id: serviceId, product_id: i.productId, qty: i.qty })))
    if (error) throw new AppError('INTERNAL', { cause: error })
  }

  return listarFicha(db, tenantId, serviceId)
}

/** Os produtos que podem entrar numa ficha: insumo (`is_retail = false`) e revenda, os dois. */
export async function listarProdutosParaFicha(db: Cliente, tenantId: string) {
  const { data, error } = await db
    .from('products')
    .select('id, name, unit, avg_cost_cents')
    .eq('tenant_id', tenantId)
    .eq('active', true)
    .is('deleted_at', null)
    .order('name')
  if (error) throw new AppError('INTERNAL', { cause: error })
  return data ?? []
}

/**
 * Quantos, dos serviços passados, ainda não têm ficha — ou seja, quantos entraram na comanda com
 * material zero por falta de cadastro, e não por não gastarem nada.
 *
 * É o insumo da lacuna `'ficha'` de `explicarSobra`. Sem ele a tela mostraria "Material R$ 0,00"
 * do mesmo jeito nos dois casos, que é a confusão que o `docs/48` §Fase 3 proíbe.
 */
export async function contarServicosSemFicha(db: Cliente, tenantId: string, serviceIds: readonly string[]): Promise<number> {
  const distintos = [...new Set(serviceIds)]
  if (distintos.length === 0) return 0

  const { data, error } = await db.from('service_products').select('service_id').eq('tenant_id', tenantId).in('service_id', distintos)
  if (error) throw new AppError('INTERNAL', { cause: error })

  const comFicha = new Set((data ?? []).map((l) => l.service_id))
  return distintos.filter((id) => !comFicha.has(id)).length
}
