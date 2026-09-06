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

export type MaterialIncerto = {
  /** Serviços que não têm ficha nenhuma: o material deles nem foi tentado. */
  semFicha: number
  /** Serviços com ficha cujo material saiu curto: algum produto dela nunca teve compra registrada. */
  comProdutoSemCusto: number
  /**
   * Os ids dos serviços com material incerto, pelas duas razões juntas, na ordem em que vieram.
   *
   * Existe para a faixa da comanda levar à ficha DAQUELE serviço quando o problema é um só, em vez
   * de despejar o dono na lista inteira do catálogo para procurar qual — `docs/50` L-02. Com mais
   * de um, a lista continua sendo o destino honesto: escolher um dos três esconderia os outros.
   */
  servicos: string[]
}

/**
 * As duas razões pelas quais o "Material" de uma comanda pode não ser o material de verdade.
 *
 * Até 2026-09-06 esta função só respondia a primeira, e o nome dela (`contarServicosSemFicha`)
 * dizia exatamente o que ela fazia — o defeito não estava na implementação, estava na pergunta.
 * `apply_vertical_pack` (0002/0057) semeia a ficha de consumo JUNTO com um `avg_cost_cents` de
 * catálogo: um salão de cabelo recém-criado tem ficha completa para "Coloração", e por isso
 * "0 serviços sem ficha" — enquanto os R$ 24,60 de material daquele atendimento saíam de preços
 * que o CICLO escreveu sozinho no cadastro. A tela mostrava o "Sobrou" sem uma ressalva sequer.
 *
 * Perguntar `avg_cost_cents <= 0` é o que separa "o dono registrou a compra" de "veio no pack e
 * ninguém conferiu" — depois que a migration 0069 devolve o custo semeado a zero, que é onde ele
 * deveria ter nascido.
 */
export async function medirMaterialIncerto(db: Cliente, tenantId: string, serviceIds: readonly string[]): Promise<MaterialIncerto> {
  const distintos = [...new Set(serviceIds)]
  if (distintos.length === 0) return { semFicha: 0, comProdutoSemCusto: 0, servicos: [] }

  const { data, error } = await db
    .from('service_products')
    .select('service_id, products(avg_cost_cents)')
    .eq('tenant_id', tenantId)
    .in('service_id', distintos)
  if (error) throw new AppError('INTERNAL', { cause: error })

  const comFicha = new Set<string>()
  const comProdutoSemCusto = new Set<string>()
  for (const linha of data ?? []) {
    comFicha.add(linha.service_id)
    // `?? 0` aqui é a leitura certa e não um padrão de conveniência: produto que sumiu da junção
    // é produto sem custo conhecido, que é justamente o caso que esta função existe para contar.
    if ((linha.products?.avg_cost_cents ?? 0) <= 0) comProdutoSemCusto.add(linha.service_id)
  }

  const semFicha = distintos.filter((id) => !comFicha.has(id))

  return {
    semFicha: semFicha.length,
    comProdutoSemCusto: comProdutoSemCusto.size,
    servicos: [...semFicha, ...comProdutoSemCusto],
  }
}

/**
 * O mesmo `medirMaterialIncerto`, mas sobre o catálogo ativo inteiro em vez de uma comanda — é o
 * que a Central de Ações precisa para dizer ao dono o que falta ANTES de ele fechar a primeira
 * comanda e descobrir a lacuna no pior momento possível.
 *
 * Duas idas de rede em série, e de propósito: a alternativa era um segundo `select` que
 * respondesse "material incompleto" por conta própria, e regra de dinheiro escrita duas vezes é
 * exatamente a segunda fonte que esta base já pagou uma vez no livro-caixa. A regra mora em
 * `medirMaterialIncerto`; aqui só muda de quem se pergunta.
 */
export async function medirMaterialDoCatalogo(db: Cliente, tenantId: string): Promise<MaterialIncerto> {
  const { data, error } = await db
    .from('services')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('active', true)
    .is('deleted_at', null)
  if (error) throw new AppError('INTERNAL', { cause: error })

  return medirMaterialIncerto(db, tenantId, (data ?? []).map((s) => s.id))
}
