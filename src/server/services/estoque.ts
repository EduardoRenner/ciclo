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

/** Tentativas da CAS abaixo antes de desistir — contenção real neste ponto é rajada, não constante. */
const MAX_TENTATIVAS_ESTOQUE = 5

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

  /*
   * O movimento acima já está gravado e correto — é o `stock_qty` (número cacheado em `products`,
   * fonte da leitura rápida da lista/alerta) que precisa somar o delta sem perder a corrida.
   *
   * Ler-somar-escrever sem `.eq('stock_qty', ...)` no UPDATE é o mesmo defeito que `transicaoSimples`/
   * o fechamento de comanda já evitam noutro lugar: duas comandas fechando ao mesmo tempo,
   * consumindo o MESMO produto (ex.: o mesmo xampu em dois cortes do dia), liam o mesmo `stock_qty`
   * e a segunda escrita apagava o desconto da primeira — o estoque ficava CONTADO A MENOS do que
   * realmente saiu, silenciosamente, porque nenhuma das duas escritas dava erro.
   *
   * CAS com retry, não migration: uma função `UPDATE ... SET stock_qty = stock_qty + x` no banco
   * seria mais direta, mas exige nova migration + `pnpm test:rls` para confiar (indisponível nesta
   * sessão). Isto resolve a corrida inteiramente em código de aplicação, sem tocar schema.
   */
  let stockAtual = produto.stock_qty
  for (let tentativa = 1; tentativa <= MAX_TENTATIVAS_ESTOQUE; tentativa++) {
    const { data: atualizado, error: erroUpdate } = await db
      .from('products')
      .update({ stock_qty: stockAtual + entrada.qty })
      .eq('tenant_id', tenantId)
      .eq('id', entrada.productId)
      .eq('stock_qty', stockAtual)
      .select('stock_qty')
      .maybeSingle()
    if (erroUpdate) throw new AppError('INTERNAL', { cause: erroUpdate })
    if (atualizado) return

    // Perdeu a corrida: outra escrita mudou `stock_qty` entre a leitura e este UPDATE. Relê o
    // valor de verdade e tenta de novo com ele — o movimento em `stock_moves` já está gravado e
    // correto, só o total cacheado precisa alcançar o valor certo.
    const { data: relido, error: erroReler } = await db.from('products').select('stock_qty').eq('tenant_id', tenantId).eq('id', entrada.productId).maybeSingle()
    if (erroReler) throw new AppError('INTERNAL', { cause: erroReler })
    if (!relido) throw new AppError('NOT_FOUND')
    stockAtual = relido.stock_qty
  }

  // Contenção extrema e improvável (5 tentativas seguidas perdendo a corrida no mesmo produto) —
  // o movimento já está gravado; falhar aqui é visível (alarma, não corrompe em silêncio).
  throw new AppError('INTERNAL', { cause: new Error(`stock_qty de ${entrada.productId} não estabilizou após ${MAX_TENTATIVAS_ESTOQUE} tentativas`) })
}

export const EsquemaEntradaEstoque = z.object({
  productId: z.string().uuid(),
  qty: z.number().positive(),
  unitCostCents: z.number().int().nonnegative(),
  note: z.string().trim().max(500).nullish(),
  /*
   * `products.reorder_point` existe desde a migration 0001 e, até 2026-09-03, era LIDA em três
   * lugares e escrita em NENHUM — não havia formulário, rota nem serviço que a definisse.
   *
   * A consequência é sutil porque o alerta não some, ele só chega tarde: `precisaRecomprar` é
   * "estoque <= ponto_de_pedido **ou** cobertura < 7 dias", e com o ponto sempre em 0 a primeira
   * metade da regra só dispara quando o produto ACABOU. O aviso que existe justamente para chegar
   * antes chegava depois. E a linha " · repor com N" da lista, guardada por `pontoDePedido > 0`,
   * nunca apareceu para ninguém.
   *
   * Entra aqui, na entrada de estoque, e não numa tela própria: quem está registrando a compra é
   * exatamente quem acabou de decidir quanto precisa ter em mãos. Perguntar noutro lugar seria
   * pedir a mesma decisão duas vezes.
   *
   * Opcional para não mexer no ponto de quem só quer lançar a compra — `undefined` preserva o
   * valor atual, e zero é escolha válida ("não me avise por quantidade").
   */
  reorderPoint: z.number().nonnegative().optional(),
})
export type EntradaEstoqueManual = z.infer<typeof EsquemaEntradaEstoque>

/**
 * Compra/reposição manual — a única forma de `avg_cost_cents` sair de 0 e ficar de verdade em
 * dia (nenhum outro fluxo desta base sabe QUANTO custou o produto).
 */
export async function registrarEntradaEstoque(db: Cliente, tenantId: string, entrada: EntradaEstoqueManual) {
  const { data: produtoInicial, error } = await db.from('products').select('stock_qty, avg_cost_cents').eq('tenant_id', tenantId).eq('id', entrada.productId).maybeSingle()
  if (error) throw new AppError('INTERNAL', { cause: error })
  if (!produtoInicial) throw new AppError('NOT_FOUND')

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

  /*
   * Mesma corrida de `registrarMovimento`, agravada aqui: além de `stock_qty`, o
   * ler-somar-escrever também decide `avg_cost_cents` a partir do mesmo par de valores lidos —
   * uma segunda escrita concorrente (outra entrada manual, ou uma comanda fechando e consumindo
   * este produto ao mesmo tempo) não só perderia quantidade, corromperia o CUSTO MÉDIO com um
   * cálculo feito sobre um estoque que já não é o de verdade.
   *
   * CAS com retry, recalculando `novoCustoMedio` a cada tentativa com o valor relido — não basta
   * repetir o UPDATE com o número velho, a fórmula em si depende do estado antes dela.
   */
  let produto = produtoInicial
  for (let tentativa = 1; tentativa <= MAX_TENTATIVAS_ESTOQUE; tentativa++) {
    const novoCustoMedio = calcularNovoCustoMedio({
      estoqueAtualQty: produto.stock_qty,
      custoMedioAtualCents: produto.avg_cost_cents,
      qtyEntrada: entrada.qty,
      custoUnitarioEntradaCents: entrada.unitCostCents,
    })

    const { data: produtoAtualizado, error: erroUpdate } = await db
      .from('products')
      .update({
        stock_qty: produto.stock_qty + entrada.qty,
        avg_cost_cents: novoCustoMedio,
        ...(entrada.reorderPoint === undefined ? {} : { reorder_point: entrada.reorderPoint }),
      })
      .eq('tenant_id', tenantId)
      .eq('id', entrada.productId)
      .eq('stock_qty', produto.stock_qty)
      .eq('avg_cost_cents', produto.avg_cost_cents)
      .select('*')
      .maybeSingle()
    if (erroUpdate) throw new AppError('INTERNAL', { cause: erroUpdate })
    if (produtoAtualizado) return produtoAtualizado

    const { data: relido, error: erroReler } = await db.from('products').select('stock_qty, avg_cost_cents').eq('tenant_id', tenantId).eq('id', entrada.productId).maybeSingle()
    if (erroReler) throw new AppError('INTERNAL', { cause: erroReler })
    if (!relido) throw new AppError('NOT_FOUND')
    produto = relido
  }

  throw new AppError('INTERNAL', { cause: new Error(`stock_qty/avg_cost_cents de ${entrada.productId} não estabilizou após ${MAX_TENTATIVAS_ESTOQUE} tentativas`) })
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

/**
 * docs/62 Fase 1: o alicerce que faltava. `products` tem `price_cents`/`is_retail` desde a
 * migration 0001 e `adicionarItemComanda` (comanda.ts) já sabe vender um produto de revenda —
 * só não existia rota nem tela para CADASTRAR um produto novo depois do pacote inicial do nicho.
 *
 * `priceCents` só é exigido quando `isRetail` é `true` — o mesmo `.refine()` que
 * `adicionarItemComanda` já checa em runtime (comanda.ts: "produto de revenda sem preço, definir
 * no estoque antes de vender"), agora barrado na borda, em vez de só na hora de vender.
 */
const EsquemaProdutoBase = z.object({
  name: z.string().trim().min(2, 'Dê um nome ao produto.').max(120, 'Nome muito longo.'),
  unit: z.string().trim().min(1, 'Informe a unidade.').max(10, 'Unidade muito longa.').default('un'),
  avgCostCents: z.number().int().nonnegative('O custo não pode ser negativo.').default(0),
  priceCents: z.number().int().nonnegative('O preço não pode ser negativo.').nullish(),
  isRetail: z.boolean().default(false),
  reorderPoint: z.number().nonnegative('O ponto de pedido não pode ser negativo.').default(0),
})

export const EsquemaProduto = EsquemaProdutoBase.refine((d) => !d.isRetail || d.priceCents != null, {
  message: 'Defina o preço de venda para um produto de revenda.',
  path: ['priceCents'],
})

/** No PATCH todo campo é opcional — mas a combinação isRetail+priceCents ainda é checada quando as duas chegam juntas. */
export const EsquemaProdutoParcial = EsquemaProdutoBase.partial().refine(
  (d) => d.isRetail !== true || d.priceCents !== null,
  { message: 'Defina o preço de venda para um produto de revenda.', path: ['priceCents'] },
)

type EntradaProduto = z.infer<typeof EsquemaProdutoBase>
type EntradaProdutoParcial = z.infer<typeof EsquemaProdutoParcial>

/** Traduz o índice único `products_tenant_name_uniq` (0003) em erro de campo, mesmo padrão de `servicos.ts`. */
function traduzirErroProduto(erro: { code?: string }): never {
  if (erro.code === '23505') {
    throw AppError.validacao({ name: 'Já existe um produto com esse nome.' })
  }
  throw new AppError('INTERNAL', { cause: erro })
}

type ColunasProduto = Database['public']['Tables']['products']['Update']

function paraColunasProduto(entrada: Partial<EntradaProduto>): ColunasProduto {
  const colunas: ColunasProduto = {}
  if (entrada.name !== undefined) colunas.name = entrada.name
  if (entrada.unit !== undefined) colunas.unit = entrada.unit
  if (entrada.avgCostCents !== undefined) colunas.avg_cost_cents = entrada.avgCostCents
  if (entrada.priceCents !== undefined) colunas.price_cents = entrada.priceCents ?? null
  if (entrada.isRetail !== undefined) colunas.is_retail = entrada.isRetail
  if (entrada.reorderPoint !== undefined) colunas.reorder_point = entrada.reorderPoint
  return colunas
}

const COLUNAS_PRODUTO = 'id, name, unit, avg_cost_cents, price_cents, is_retail, stock_qty, reorder_point, expires_at, active'

export async function criarProduto(db: Cliente, tenantId: string, entrada: EntradaProduto) {
  const { data, error } = await db
    .from('products')
    .insert({ tenant_id: tenantId, ...(paraColunasProduto(entrada) as { name: string }) })
    .select(COLUNAS_PRODUTO)
    .single()

  if (error) traduzirErroProduto(error)
  return data
}

export async function atualizarProduto(db: Cliente, tenantId: string, id: string, entrada: EntradaProdutoParcial) {
  const colunas = paraColunasProduto(entrada)
  if (Object.keys(colunas).length === 0) throw AppError.validacao({ _corpo: 'Nada para alterar.' })

  const { data, error } = await db
    .from('products')
    .update(colunas)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .select(COLUNAS_PRODUTO)
    .maybeSingle()

  if (error) traduzirErroProduto(error)
  if (!data) throw new AppError('NOT_FOUND', { message: 'Esse produto não está mais no seu estoque.' })
  return data
}
