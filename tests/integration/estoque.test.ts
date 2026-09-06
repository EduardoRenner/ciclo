import { randomUUID } from 'node:crypto'

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { criarProfissional } from '@/server/services/profissionais'
import { criarServico } from '@/server/services/servicos'
import { executarOnboarding } from '@/server/services/onboarding'
import { adicionarItemComanda, cancelarComandaFechada, fecharComanda } from '@/server/services/comanda'
import { registrarEntradaEstoque } from '@/server/services/estoque'

import type { Database } from '@/server/db/types.gen'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error('O teste de estoque precisa de NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local.')
}

const svc = createClient<Database>(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })

const TZ = 'America/Sao_Paulo'
let tenantId: string
let professionalId: string
let servicoId: string
const tenants: string[] = []
const usuarios: string[] = []

beforeAll(async () => {
  const marca = randomUUID().slice(0, 8)
  const { data, error } = await svc.auth.admin.createUser({
    email: `estoque-${marca}@ciclo.test`,
    password: randomUUID(),
    email_confirm: true,
    user_metadata: { full_name: 'Dona do Estoque' },
  })
  if (error || !data.user) throw new Error(`seed falhou: ${error?.message}`)
  usuarios.push(data.user.id)

  const { tenant } = await executarOnboarding(svc, {
    userId: data.user.id,
    businessName: 'Salão do Estoque',
    vertical: 'nails',
    slug: `estoque-${marca}`,
    timezone: TZ,
  })
  tenantId = tenant.id
  tenants.push(tenantId)

  const profissional = await criarProfissional(svc, tenantId, {
    displayName: 'Manicure',
    compModel: 'owner',
    commissionBps: 0,
    rentCents: 0,
    acceptsOnline: true,
  })
  professionalId = profissional.id

  const servico = await criarServico(svc, tenantId, {
    name: 'Esmaltação em Gel',
    description: null,
    durationMin: 60,
    bufferBeforeMin: 0,
    bufferAfterMin: 0,
    priceCents: 10_000,
    pricingModel: 'fixed',
    cycleDays: 21,
    depositBps: 0,
    depositMinCents: 0,
    parallelCapacity: 1,
    requiresAnamnesis: false,
    bookableOnline: true,
    categoryId: null,
  })
  servicoId = servico.id
}, 60_000)

afterAll(async () => {
  for (const t of tenants) await svc.from('tenants').delete().eq('id', t)
  for (const u of usuarios) await svc.auth.admin.deleteUser(u)
}, 60_000)

/**
 * `is_retail` decide se o produto pode ser LANÇADO na comanda, e o padrão aqui é `false` — insumo,
 * que é o que a maioria destes testes usa (ficha de consumo, média móvel, estorno).
 *
 * O caso de REVENDA pede `{ revenda: true }` e um preço, porque `adicionarItemComanda` passou a
 * recusar produto sem preço em vez de cobrar zero. A fixture antiga criava tudo sem preço e sem
 * `is_retail`, então o teste do "produto vendido direto" na verdade vendia um insumo a R$ 0,00 —
 * o defeito estava dentro do teste que deveria guardá-lo.
 */
async function criarProduto(nome: string, estoqueInicial: number, opcoes: { revenda?: boolean; precoCents?: number } = {}) {
  const produto = await svc
    .from('products')
    .insert({
      tenant_id: tenantId,
      name: nome,
      stock_qty: estoqueInicial,
      avg_cost_cents: 1_000,
      is_retail: opcoes.revenda ?? false,
      price_cents: opcoes.precoCents ?? (opcoes.revenda ? 5_000 : null),
    })
    .select('*')
    .single()
  if (produto.error) throw produto.error
  return produto.data
}

async function abrirTicketVazio() {
  const cliente = await svc.from('clients').insert({ tenant_id: tenantId, name: `Cliente ${randomUUID().slice(0, 6)}` }).select('id').single()
  const ticket = await svc.from('tickets').insert({ tenant_id: tenantId, client_id: cliente.data!.id, professional_id: professionalId }).select('id').single()
  return ticket.data!.id
}

describe('estoque — baixa no fechamento, estorno, média móvel', () => {
  it(
    'fechar comanda com item de serviço baixa a ficha de consumo do produto',
    async () => {
      const produto = await criarProduto('Esmalte Gel Vermelho', 100)
      await svc.from('service_products').insert({ tenant_id: tenantId, service_id: servicoId, product_id: produto.id, qty: 2 })

      const ticketId = await abrirTicketVazio()
      await adicionarItemComanda(svc, tenantId, ticketId, { serviceId: servicoId, professionalId, qty: 1, discountCents: 0 })
      await fecharComanda(svc, tenantId, ticketId, 'cash')

      const { data: produtoDepois } = await svc.from('products').select('stock_qty').eq('id', produto.id).single()
      expect(produtoDepois?.stock_qty).toBe(98) // 100 - 2

      const { data: movimento } = await svc.from('stock_moves').select('kind, qty, source, source_id').eq('product_id', produto.id).eq('source', 'ticket').single()
      expect(movimento).toMatchObject({ kind: 'out', qty: -2, source: 'ticket', source_id: ticketId })
    },
    30_000,
  )

  it(
    'item de produto vendido direto consome a si mesmo, sem ficha de consumo',
    async () => {
      const produto = await criarProduto('Esmaltinho de Revenda', 20, { revenda: true, precoCents: 3_000 })

      const ticketId = await abrirTicketVazio()
      await adicionarItemComanda(svc, tenantId, ticketId, { productId: produto.id, professionalId, qty: 3, discountCents: 0 })
      await fecharComanda(svc, tenantId, ticketId, 'cash')

      const { data: produtoDepois } = await svc.from('products').select('stock_qty').eq('id', produto.id).single()
      expect(produtoDepois?.stock_qty).toBe(17) // 20 - 3
    },
    30_000,
  )

  it(
    'produto de revenda entra pelo preço do catálogo, não por zero',
    async () => {
      const produto = await criarProduto('Óleo de Barba 30ml', 10, { revenda: true, precoCents: 4_500 })
      const ticketId = await abrirTicketVazio()
      await adicionarItemComanda(svc, tenantId, ticketId, { productId: produto.id, professionalId, qty: 2, discountCents: 0 })

      const { data: item } = await svc.from('ticket_items').select('unit_price_cents, total_cents').eq('ticket_id', ticketId).eq('product_id', produto.id).single()
      expect(item).toMatchObject({ unit_price_cents: 4_500, total_cents: 9_000 })
    },
    30_000,
  )

  it(
    'insumo NÃO entra na comanda a preço zero — recusa e diz o que fazer',
    async () => {
      /*
        O defeito que este caso guarda: `unitPriceCents ?? produto.price_cents ?? 0` lançava água
        oxigenada, luva e navalha descartável a R$ 0,00 — item de graça na conta — e ainda dava
        baixa no estoque. Como o insumo TAMBÉM sai pela ficha de consumo do serviço
        (`service_products`), a mesma peça saía duas vezes por um uso só.
      */
      const insumo = await criarProduto('Água Oxigenada 900ml', 30)
      const ticketId = await abrirTicketVazio()

      await expect(adicionarItemComanda(svc, tenantId, ticketId, { productId: insumo.id, professionalId, qty: 1, discountCents: 0 })).rejects.toThrow(
        /insumo de uso interno/i,
      )

      const { data: itens } = await svc.from('ticket_items').select('id').eq('ticket_id', ticketId)
      expect(itens ?? []).toHaveLength(0)

      const { data: depois } = await svc.from('products').select('stock_qty').eq('id', insumo.id).single()
      expect(depois?.stock_qty).toBe(30) // nada saiu do estoque
    },
    30_000,
  )

  it(
    'insumo COM preço informado na hora continua podendo ser vendido',
    async () => {
      // A recusa acima é sobre inventar preço, não sobre proibir a venda: quem atende pode vender
      // uma navalha avulsa, desde que diga por quanto. Sem isto a correção viraria uma parede.
      const insumo = await criarProduto('Navalha Descartável', 50)
      const ticketId = await abrirTicketVazio()
      await adicionarItemComanda(svc, tenantId, ticketId, { productId: insumo.id, professionalId, qty: 1, discountCents: 0, unitPriceCents: 900 })

      const { data: item } = await svc.from('ticket_items').select('unit_price_cents').eq('ticket_id', ticketId).eq('product_id', insumo.id).single()
      expect(item?.unit_price_cents).toBe(900)
    },
    30_000,
  )

  it(
    'estornar comanda fechada devolve o estoque com movimento return, sem apagar o out original',
    async () => {
      const produto = await criarProduto('Esmalte Gel Rosa', 50)
      await svc.from('service_products').insert({ tenant_id: tenantId, service_id: servicoId, product_id: produto.id, qty: 5 })

      const ticketId = await abrirTicketVazio()
      await adicionarItemComanda(svc, tenantId, ticketId, { serviceId: servicoId, professionalId, qty: 1, discountCents: 0 })
      await fecharComanda(svc, tenantId, ticketId, 'cash')

      const { data: apósFechar } = await svc.from('products').select('stock_qty').eq('id', produto.id).single()
      expect(apósFechar?.stock_qty).toBe(45) // 50 - 5

      const cancelado = await cancelarComandaFechada(svc, tenantId, ticketId)
      expect(cancelado.status).toBe('canceled')

      const { data: apósEstorno } = await svc.from('products').select('stock_qty').eq('id', produto.id).single()
      expect(apósEstorno?.stock_qty).toBe(50) // devolveu tudo

      const { data: movimentos } = await svc.from('stock_moves').select('kind, qty').eq('product_id', produto.id).eq('source_id', ticketId).order('created_at')
      expect(movimentos).toHaveLength(2)
      expect(movimentos?.[0]).toMatchObject({ kind: 'out', qty: -5 }) // original intacto
      expect(movimentos?.[1]).toMatchObject({ kind: 'return', qty: 5 }) // compensação nova
    },
    30_000,
  )

  it(
    'não dá pra cancelar uma comanda que ainda está aberta',
    async () => {
      const ticketId = await abrirTicketVazio()
      await expect(cancelarComandaFechada(svc, tenantId, ticketId)).rejects.toMatchObject({ code: 'INVALID_TRANSITION' })
    },
    30_000,
  )

  it(
    'entrada manual de estoque recalcula a média móvel ponderada e soma a quantidade',
    async () => {
      const produto = await criarProduto('Óleo Cuticular', 10) // avg_cost_cents = 1000 (default do teste)

      const atualizado = await registrarEntradaEstoque(svc, tenantId, { productId: produto.id, qty: 10, unitCostCents: 2_000 })

      expect(atualizado.stock_qty).toBe(20)
      expect(atualizado.avg_cost_cents).toBe(1_500) // (10*1000 + 10*2000) / 20
    },
    30_000,
  )

  /*
   * `reorder_point` era lida em tres lugares e escrita em nenhum: nao havia formulario, rota nem
   * servico que a definisse. O alerta nao sumia — chegava tarde, porque "estoque <= ponto" com o
   * ponto travado em 0 so dispara com o produto ja acabado.
   */
  it(
    'define o ponto de pedido junto com a entrada',
    async () => {
      const produto = await criarProduto('Toalha com aviso', 10)
      expect(produto.reorder_point).toBe(0)

      const atualizado = await registrarEntradaEstoque(svc, tenantId, {
        productId: produto.id,
        qty: 5,
        unitCostCents: 500,
        reorderPoint: 4,
      })

      expect(atualizado.reorder_point).toBe(4)
      expect(atualizado.stock_qty).toBe(15)
    },
    30_000,
  )

  it(
    'entrada sem ponto de pedido PRESERVA o que ja estava definido',
    async () => {
      const produto = await criarProduto('Toalha que mantem o aviso', 10)
      await registrarEntradaEstoque(svc, tenantId, { productId: produto.id, qty: 1, unitCostCents: 500, reorderPoint: 7 })

      const atualizado = await registrarEntradaEstoque(svc, tenantId, { productId: produto.id, qty: 1, unitCostCents: 500 })

      expect(atualizado.reorder_point).toBe(7)
    },
    30_000,
  )

  it(
    'ponto de pedido ZERO desliga o aviso por quantidade — nao e tratado como ausencia',
    async () => {
      // O bug natural aqui e `entrada.reorderPoint ? ... : ...`, que trataria 0 como "nao mandou"
      // e tornaria impossivel DESLIGAR o aviso depois de liga-lo.
      const produto = await criarProduto('Toalha sem aviso', 10)
      await registrarEntradaEstoque(svc, tenantId, { productId: produto.id, qty: 1, unitCostCents: 500, reorderPoint: 6 })

      const atualizado = await registrarEntradaEstoque(svc, tenantId, { productId: produto.id, qty: 1, unitCostCents: 500, reorderPoint: 0 })

      expect(atualizado.reorder_point).toBe(0)
    },
    30_000,
  )
})
