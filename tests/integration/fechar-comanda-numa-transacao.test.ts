import { randomUUID } from 'node:crypto'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { fecharComanda } from '@/server/services/comanda'
import { executarOnboarding } from '@/server/services/onboarding'

import type { Database } from '@/server/db/types.gen'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) throw new Error('O teste do fechamento atômico precisa das chaves do Supabase local no .env.local.')

const svc = createClient<Database>(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })

/*
 * APR-033a (achados C-15, R-03, R-04): `aplicar_fechamento_de_comanda` fecha, grava a comissão de
 * cada item e baixa o estoque numa transação — ou nada. Exercitada com o JWT de um profissional, que
 * é o caso em que a baixa antiga falhava sempre (RLS de `products`).
 */
let tenantId: string
let produtoA: string
let produtoB: string
let servico: string
let cliente: string
const profs: { id: string; db: SupabaseClient<Database> }[] = []
const usuarios: string[] = []

async function profissional(nome: string) {
  const email = `apr033-${nome}-${randomUUID().slice(0, 6)}@ciclo.test`
  const senha = randomUUID()
  const u = await svc.auth.admin.createUser({ email, password: senha, email_confirm: true })
  usuarios.push(u.data.user!.id)
  await svc.from('memberships').insert({ tenant_id: tenantId, user_id: u.data.user!.id, role: 'professional' })
  const p = (await svc.from('professionals').insert({ tenant_id: tenantId, user_id: u.data.user!.id, display_name: nome }).select('id').single()).data!
  const db = createClient<Database>(SUPABASE_URL!, ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })
  await db.auth.signInWithPassword({ email, password: senha })
  return { id: p.id, db }
}

async function comandaAberta(professionalId: string) {
  const t = (await svc.from('tickets').insert({ tenant_id: tenantId, client_id: cliente, professional_id: professionalId }).select('id').single()).data!.id
  const item = (
    await svc
      .from('ticket_items')
      .insert({ tenant_id: tenantId, ticket_id: t, professional_id: professionalId, product_id: produtoA, description: 'Pomada', qty: 1, unit_price_cents: 3_500, total_cents: 3_500 })
      .select('id')
      .single()
  ).data!.id
  return { ticketId: t, itemId: item }
}

const campos = { subtotal_cents: 3_500, total_cents: 3_500, commission_cents: 350, material_cost_cents: 1_950, payment_method: 'pix', fixed_cost_cents: 0, fee_bps: 0, fee_cents: 0, profit_cents: 1_200 }
const estoque = async (id: string) => Number((await svc.from('products').select('stock_qty').eq('id', id).single()).data!.stock_qty)
const movimentos = async (ticketId: string) => (await svc.from('stock_moves').select('id', { count: 'exact', head: true }).eq('source_id', ticketId)).count

beforeAll(async () => {
  const marca = randomUUID().slice(0, 8)
  const { data } = await svc.auth.admin.createUser({ email: `apr033-dono-${marca}@ciclo.test`, password: randomUUID(), email_confirm: true })
  usuarios.push(data.user!.id)
  const { tenant } = await executarOnboarding(svc, { userId: data.user!.id, businessName: 'Fechamento Atômico', vertical: 'barber', slug: `apr033-${marca}`, timezone: 'America/Sao_Paulo' })
  tenantId = tenant.id
  produtoA = (await svc.from('products').insert({ tenant_id: tenantId, name: 'Pomada', stock_qty: 10, avg_cost_cents: 1_950 }).select('id').single()).data!.id
  produtoB = (await svc.from('products').insert({ tenant_id: tenantId, name: 'Shampoo', stock_qty: 10, avg_cost_cents: 900 }).select('id').single()).data!.id
  servico = (await svc.from('services').select('id').eq('tenant_id', tenantId).limit(1).single()).data!.id
  cliente = (await svc.from('clients').insert({ tenant_id: tenantId, name: 'Cliente APR-033' }).select('id').single()).data!.id
  profs.push(await profissional('Ana'), await profissional('Bia'))
  void servico
}, 60_000)

afterAll(async () => {
  await svc.from('tenants').delete().eq('id', tenantId)
  for (const u of usuarios) await svc.auth.admin.deleteUser(u)
}, 60_000)

describe('fechar a comanda numa transação só (APR-033a)', () => {
  it(
    'profissional fecha a PRÓPRIA comanda: fecha, grava a comissão e baixa os dois produtos',
    async () => {
      const ana = profs[0]!
      const { ticketId, itemId } = await comandaAberta(ana.id)
      const [antesA, antesB] = [await estoque(produtoA), await estoque(produtoB)]
      const r = await ana.db.rpc('aplicar_fechamento_de_comanda', {
        p_tenant: tenantId,
        p_ticket: ticketId,
        p_itens: [{ id: itemId, commission_bps: 1_000, commission_cents: 350 }],
        p_ticket_campos: campos,
        p_consumo: [{ product_id: produtoA, qty: 1 }, { product_id: produtoB, qty: 0.5 }],
      })
      expect(r.error).toBeNull()
      expect((r.data as { status: string }).status).toBe('closed')
      expect(await estoque(produtoA)).toBe(antesA - 1)
      expect(await estoque(produtoB)).toBe(antesB - 0.5)
      expect(await movimentos(ticketId)).toBe(2)
      const item = (await svc.from('ticket_items').select('commission_cents').eq('id', itemId).single()).data!
      expect(item.commission_cents).toBe(350)
    },
    30_000,
  )

  it(
    'falha no 2º produto: a comanda continua ABERTA, sem movimento e sem estoque mexido',
    async () => {
      const ana = profs[0]!
      const { ticketId, itemId } = await comandaAberta(ana.id)
      const antesA = await estoque(produtoA)
      const r = await ana.db.rpc('aplicar_fechamento_de_comanda', {
        p_tenant: tenantId,
        p_ticket: ticketId,
        p_itens: [{ id: itemId, commission_bps: 1_000, commission_cents: 350 }],
        p_ticket_campos: campos,
        p_consumo: [{ product_id: produtoA, qty: 1 }, { product_id: randomUUID(), qty: 1 }],
      })
      expect(r.error).not.toBeNull()
      const ticket = (await svc.from('tickets').select('status').eq('id', ticketId).single()).data!
      expect(ticket.status).toBe('open')
      expect(await movimentos(ticketId)).toBe(0)
      expect(await estoque(produtoA)).toBe(antesA)
    },
    30_000,
  )

  it(
    'comanda da COLEGA: recusada, e nada muda',
    async () => {
      const [ana, bia] = [profs[0]!, profs[1]!]
      const { ticketId, itemId } = await comandaAberta(bia.id)
      const r = await ana.db.rpc('aplicar_fechamento_de_comanda', {
        p_tenant: tenantId,
        p_ticket: ticketId,
        p_itens: [{ id: itemId, commission_bps: 0, commission_cents: 0 }],
        p_ticket_campos: campos,
        p_consumo: [{ product_id: produtoA, qty: 1 }],
      })
      expect(r.error?.code).toBe('42501')
      expect((await svc.from('tickets').select('status').eq('id', ticketId).single()).data!.status).toBe('open')
    },
    30_000,
  )

  it(
    'fechar duas vezes: a segunda é recusada e o estoque não desce em dobro',
    async () => {
      const ana = profs[0]!
      const { ticketId, itemId } = await comandaAberta(ana.id)
      const chamada = () =>
        ana.db.rpc('aplicar_fechamento_de_comanda', {
          p_tenant: tenantId,
          p_ticket: ticketId,
          p_itens: [{ id: itemId, commission_bps: 0, commission_cents: 0 }],
          p_ticket_campos: campos,
          p_consumo: [{ product_id: produtoA, qty: 1 }],
        })
      const antes = await estoque(produtoA)
      const [a, b] = await Promise.all([chamada(), chamada()])
      expect([a.error, b.error].filter(Boolean)).toHaveLength(1)
      expect(await estoque(produtoA)).toBe(antes - 1)
      expect(await movimentos(ticketId)).toBe(1)
    },
    30_000,
  )

  it('anon não executa a função', async () => {
    const anon = createClient<Database>(SUPABASE_URL!, ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })
    const r = await anon.rpc('aplicar_fechamento_de_comanda', { p_tenant: tenantId, p_ticket: randomUUID(), p_itens: [], p_ticket_campos: campos, p_consumo: [] })
    expect(r.error).not.toBeNull()
  })

  /*
   * APR-033b: o MESMO cenário pelo serviço que a rota chama. Antes, a comanda ficava `closed` com o
   * estoque pela metade e a nova tentativa dizia "já foi fechada" (C-15).
   */
  it(
    'fecharComanda: falha no 2º produto deixa tudo como estava; corrigido, fecha uma vez',
    async () => {
      const ana = profs[0]!
      const { ticketId } = await comandaAberta(ana.id)
      // Produto de OUTRO negócio enfiado direto no banco: a baixa dele falha dentro da transação.
      const marca = randomUUID().slice(0, 8)
      const outroDono = await svc.auth.admin.createUser({ email: `apr033-outro-${marca}@ciclo.test`, password: randomUUID(), email_confirm: true })
      usuarios.push(outroDono.data.user!.id)
      const { tenant: outro } = await executarOnboarding(svc, { userId: outroDono.data.user!.id, businessName: 'Outro', vertical: 'barber', slug: `apr033-outro-${marca}`, timezone: 'America/Sao_Paulo' })
      const alheio = (await svc.from('products').insert({ tenant_id: outro.id, name: 'Alheio', stock_qty: 5, avg_cost_cents: 100 }).select('id').single()).data!.id
      const ruim = (await svc.from('ticket_items').insert({ tenant_id: tenantId, ticket_id: ticketId, professional_id: ana.id, product_id: alheio, description: 'Alheio', qty: 1, unit_price_cents: 1_000, total_cents: 1_000 }).select('id').single()).data!.id
      const antesA = await estoque(produtoA)

      await expect(fecharComanda(ana.db, tenantId, ticketId, 'pix')).rejects.toBeDefined()
      expect((await svc.from('tickets').select('status').eq('id', ticketId).single()).data!.status).toBe('open')
      expect(await movimentos(ticketId)).toBe(0)
      expect(await estoque(produtoA)).toBe(antesA)

      await svc.from('ticket_items').delete().eq('id', ruim)
      await svc.from('tenants').delete().eq('id', outro.id)
      const fechada = await fecharComanda(ana.db, tenantId, ticketId, 'pix')
      expect(fechada.status).toBe('closed')
      expect(await estoque(produtoA)).toBe(antesA - 1)
      expect(await movimentos(ticketId)).toBe(1)
    },
    60_000,
  )
})
