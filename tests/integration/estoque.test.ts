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

async function criarProduto(nome: string, estoqueInicial: number) {
  const produto = await svc.from('products').insert({ tenant_id: tenantId, name: nome, stock_qty: estoqueInicial, avg_cost_cents: 1_000 }).select('*').single()
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
      await fecharComanda(svc, tenantId, ticketId)

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
      const produto = await criarProduto('Esmaltinho de Revenda', 20)

      const ticketId = await abrirTicketVazio()
      await adicionarItemComanda(svc, tenantId, ticketId, { productId: produto.id, professionalId, qty: 3, discountCents: 0 })
      await fecharComanda(svc, tenantId, ticketId)

      const { data: produtoDepois } = await svc.from('products').select('stock_qty').eq('id', produto.id).single()
      expect(produtoDepois?.stock_qty).toBe(17) // 20 - 3
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
      await fecharComanda(svc, tenantId, ticketId)

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
})
