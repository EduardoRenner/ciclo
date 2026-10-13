import { randomUUID } from 'node:crypto'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { exigirComandaPropria, fecharComanda } from '@/server/services/comanda'
import { executarOnboarding } from '@/server/services/onboarding'

import type { Database } from '@/server/db/types.gen'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) {
  throw new Error('O teste da comanda do profissional precisa de NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY no .env.local.')
}

const svc = createClient<Database>(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })

/*
 * APR-038 (achado R-04): o profissional tem `comanda:own` e fecha a própria comanda pela rota com o
 * PRÓPRIO JWT. A baixa de estoque atualizava `products.stock_qty` com esse JWT, e a RLS de
 * `products_update` só deixa dono e gerente: 0 linhas, o CAS tentava 5 vezes e lançava `INTERNAL`
 * DEPOIS de a comanda já estar `closed`. Os testes de comanda usam `service_role` e não viam.
 *
 * Aqui o cliente é o do USUÁRIO profissional, como na rota.
 */
let tenantId: string
let produtoId: string
let servicoId: string
let clienteId: string
const profissionais: { userId: string; professionalId: string; db: SupabaseClient<Database> }[] = []
const usuarios: string[] = []

async function novoProfissional(nome: string) {
  const email = `apr038-${nome}-${randomUUID().slice(0, 8)}@ciclo.test`
  const senha = randomUUID()
  const { data, error } = await svc.auth.admin.createUser({ email, password: senha, email_confirm: true })
  if (error || !data.user) throw new Error(`seed falhou: ${error?.message}`)
  usuarios.push(data.user.id)
  const m = await svc.from('memberships').insert({ tenant_id: tenantId, user_id: data.user.id, role: 'professional' })
  if (m.error) throw m.error
  const p = await svc.from('professionals').insert({ tenant_id: tenantId, user_id: data.user.id, display_name: nome }).select('id').single()
  if (p.error) throw p.error
  const db = createClient<Database>(SUPABASE_URL!, ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })
  const login = await db.auth.signInWithPassword({ email, password: senha })
  if (login.error) throw login.error
  profissionais.push({ userId: data.user.id, professionalId: p.data.id, db })
  return profissionais[profissionais.length - 1]!
}

beforeAll(async () => {
  const marca = randomUUID().slice(0, 8)
  const { data, error } = await svc.auth.admin.createUser({ email: `apr038-dono-${marca}@ciclo.test`, password: randomUUID(), email_confirm: true })
  if (error || !data.user) throw new Error(`seed falhou: ${error?.message}`)
  usuarios.push(data.user.id)
  const { tenant } = await executarOnboarding(svc, { userId: data.user.id, businessName: 'Salão APR-038', vertical: 'barber', slug: `apr038-${marca}`, timezone: 'America/Sao_Paulo' })
  tenantId = tenant.id

  produtoId = (await svc.from('products').insert({ tenant_id: tenantId, name: 'Pomada', stock_qty: 10, avg_cost_cents: 1_950 }).select('id').single()).data!.id
  // O pacote da vertical já semeia o catálogo; qualquer serviço dele serve.
  servicoId = (await svc.from('services').select('id').eq('tenant_id', tenantId).limit(1).single()).data!.id
  clienteId = (await svc.from('clients').insert({ tenant_id: tenantId, name: 'Cliente APR-038' }).select('id').single()).data!.id

  await novoProfissional('Ana')
  await novoProfissional('Bia')
}, 60_000)

afterAll(async () => {
  await svc.from('tenants').delete().eq('id', tenantId)
  for (const u of usuarios) await svc.auth.admin.deleteUser(u)
}, 60_000)

async function comandaComProduto(professionalId: string, qtyProduto = 1) {
  const ticket = await svc.from('tickets').insert({ tenant_id: tenantId, client_id: clienteId, professional_id: professionalId }).select('id').single()
  if (ticket.error) throw ticket.error
  const itens = await svc.from('ticket_items').insert([
    { tenant_id: tenantId, ticket_id: ticket.data.id, professional_id: professionalId, service_id: servicoId, description: 'Corte', qty: 1, unit_price_cents: 5_000, total_cents: 5_000 },
    { tenant_id: tenantId, ticket_id: ticket.data.id, professional_id: professionalId, product_id: produtoId, description: 'Pomada', qty: qtyProduto, unit_price_cents: 3_500, total_cents: 3_500 * qtyProduto },
  ])
  if (itens.error) throw itens.error
  await svc.from('tickets').update({ subtotal_cents: 5_000 + 3_500 * qtyProduto, total_cents: 5_000 + 3_500 * qtyProduto }).eq('id', ticket.data.id)
  return ticket.data.id
}

async function estoque() {
  return (await svc.from('products').select('stock_qty').eq('id', produtoId).single()).data!.stock_qty
}

describe('profissional fecha a própria comanda com produto (APR-038)', () => {
  it(
    'com o JWT do profissional: fecha, grava 1 movimento e baixa o estoque, sem erro',
    async () => {
      const ana = profissionais[0]!
      const ticketId = await comandaComProduto(ana.professionalId)
      const antes = await estoque()

      await exigirComandaPropria(ana.db, tenantId, ticketId)
      const fechada = await fecharComanda(ana.db, tenantId, ticketId, 'pix')
      expect(fechada.status).toBe('closed')

      // Só o produto vendido: o serviço do pacote pode ter ficha de consumo e baixar outro produto junto.
      const movimentos = await svc.from('stock_moves').select('qty').eq('tenant_id', tenantId).eq('source_id', ticketId).eq('product_id', produtoId)
      expect(movimentos.data).toEqual([{ qty: -1 }])
      expect(await estoque()).toBe(antes - 1)
    },
    30_000,
  )

  it(
    'a comanda de OUTRO profissional é recusada antes de fechar',
    async () => {
      const [ana, bia] = [profissionais[0]!, profissionais[1]!]
      const ticketDaBia = await comandaComProduto(bia.professionalId)
      await expect(exigirComandaPropria(ana.db, tenantId, ticketDaBia)).rejects.toMatchObject({ code: 'FORBIDDEN' })
      const ticket = await svc.from('tickets').select('status').eq('id', ticketDaBia).single()
      expect(ticket.data!.status).toBe('open')
    },
    30_000,
  )

  it(
    'produto sem saldo: fecha mesmo assim e o estoque fica negativo (alerta, não bloqueia)',
    async () => {
      const ana = profissionais[0]!
      await svc.from('products').update({ stock_qty: 0 }).eq('id', produtoId)
      const ticketId = await comandaComProduto(ana.professionalId, 2)
      const fechada = await fecharComanda(ana.db, tenantId, ticketId, 'cash')
      expect(fechada.status).toBe('closed')
      expect(await estoque()).toBe(-2)
    },
    30_000,
  )
})
