import { randomUUID } from 'node:crypto'

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { buscarComanda } from '@/server/services/comanda'
import { criarProduto, registrarEntradaEstoque } from '@/server/services/estoque'
import { executarOnboarding } from '@/server/services/onboarding'
import { criarProfissional } from '@/server/services/profissionais'
import { venderProduto } from '@/server/services/venda-de-produto'

import type { Database } from '@/server/db/types.gen'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error('O teste de venda de produto precisa de NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local.')
}

const svc = createClient<Database>(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })

let tenantId: string
let vendedorId: string
let outraId: string
const tenants: string[] = []
const usuarios: string[] = []

beforeAll(async () => {
  const marca = randomUUID().slice(0, 8)
  const { data, error } = await svc.auth.admin.createUser({
    email: `venda-${marca}@ciclo.test`,
    password: randomUUID(),
    email_confirm: true,
    user_metadata: { full_name: 'Dona da Venda' },
  })
  if (error || !data.user) throw new Error(`seed falhou: ${error?.message}`)
  usuarios.push(data.user.id)

  const { tenant } = await executarOnboarding(svc, {
    userId: data.user.id,
    businessName: 'Salão da Venda',
    vertical: 'nails',
    slug: `venda-${marca}`,
    timezone: 'America/Sao_Paulo',
  })
  tenantId = tenant.id
  tenants.push(tenantId)

  const nova = (displayName: string, commissionBps: number) =>
    criarProfissional(svc, tenantId, { displayName, compModel: 'commission', commissionBps, rentCents: 0, acceptsOnline: true })
  vendedorId = (await nova('Quem vendeu', 4_000)).id
  outraId = (await nova('Outra pessoa', 1_000)).id
}, 60_000)

afterAll(async () => {
  for (const t of tenants) await svc.from('tenants').delete().eq('id', t)
  for (const u of usuarios) await svc.auth.admin.deleteUser(u)
}, 60_000)

async function produtoComEstoque(entrada: { priceCents: number | null; isRetail: boolean; estoque: number }) {
  const produto = await criarProduto(svc, tenantId, {
    name: `Produto ${randomUUID().slice(0, 6)}`,
    unit: 'un',
    avgCostCents: 0,
    priceCents: entrada.priceCents,
    isRetail: entrada.isRetail,
    reorderPoint: 0,
  })
  if (entrada.estoque > 0) await registrarEntradaEstoque(svc, tenantId, { productId: produto.id, qty: entrada.estoque, unitCostCents: 0 })
  return produto
}

async function estoqueDe(productId: string): Promise<number> {
  const { data } = await svc.from('products').select('stock_qty').eq('tenant_id', tenantId).eq('id', productId).single()
  return Number(data!.stock_qty)
}

describe('venda de produto no balcão', () => {
  it(
    'baixa o estoque e põe a comissão no nome de quem vendeu, não de outra pessoa',
    async () => {
      const produto = await produtoComEstoque({ priceCents: 5_000, isRetail: true, estoque: 10 })

      const venda = await venderProduto(svc, tenantId, produto.id, { professionalId: vendedorId, qty: 2, paymentMethod: 'pix' })

      expect(venda.totalCents).toBe(10_000)
      expect(venda.stockQty).toBe(8)
      expect(await estoqueDe(produto.id)).toBe(8)

      const { ticket, items } = await buscarComanda(svc, tenantId, venda.ticketId)
      expect(ticket.status).toBe('closed')
      expect(items).toHaveLength(1)
      expect(items[0]!.professional_id).toBe(vendedorId)
      // Produto paga a comissão de PRODUTO do negócio (padrão 10%), nunca a de serviço da pessoa (40%
      // aqui): a regra é do negócio (F80), e a venda de balcão não abre exceção.
      expect(items[0]!.commission_bps).toBe(1_000)
      expect(items[0]!.commission_cents).toBe(1_000)
      expect(outraId).not.toBe(vendedorId)
    },
    30_000,
  )

  it(
    'recusa insumo sem preço, e não deixa comanda aberta nem estoque mexido',
    async () => {
      const insumo = await produtoComEstoque({ priceCents: null, isRetail: false, estoque: 5 })

      await expect(venderProduto(svc, tenantId, insumo.id, { professionalId: vendedorId, qty: 1, paymentMethod: 'pix' })).rejects.toThrow()

      expect(await estoqueDe(insumo.id)).toBe(5)
      const { data: abertas } = await svc.from('tickets').select('id').eq('tenant_id', tenantId).eq('status', 'open')
      expect(abertas ?? [], 'a venda recusada deixou uma comanda aberta no caixa').toHaveLength(0)
    },
    30_000,
  )

  it(
    'recusa quem não é da equipe deste negócio',
    async () => {
      const produto = await produtoComEstoque({ priceCents: 3_000, isRetail: true, estoque: 3 })

      await expect(venderProduto(svc, tenantId, produto.id, { professionalId: randomUUID(), qty: 1, paymentMethod: 'pix' })).rejects.toThrow()

      expect(await estoqueDe(produto.id)).toBe(3)
    },
    30_000,
  )
})
