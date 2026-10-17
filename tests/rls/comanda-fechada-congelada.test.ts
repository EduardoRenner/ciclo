import { randomUUID } from 'node:crypto'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { adicionarItemComanda, cancelarComandaFechada, fecharComanda, removerItemComanda } from '@/server/services/comanda'
import { executarOnboarding } from '@/server/services/onboarding'

import type { Database } from '@/server/db/types.gen'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) throw new Error('O teste da comanda congelada precisa das chaves do Supabase local no .env.local.')

const svc = createClient<Database>(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })

/**
 * APR-009 (achados E-04, G-01, G-55; correção R-02): qualquer membro, pela API REST com o próprio JWT,
 * editava a comissão de um item de comanda FECHADA e apagava comandas. A 0073 justificou a política
 * aberta dizendo que "as rotas usam service_role" — premissa falsa (`close/route.ts` usa o cliente do
 * usuário). Este arquivo foi visto REPROVANDO nos casos de congelamento antes da 0127, e passando nos
 * de controle (o fluxo normal da comanda, o cancelamento e a cascata do teardown).
 */
let tenantId: string
let servico: string
let cliente: string
let profId: string
const usuarios: string[] = []
let dono: SupabaseClient<Database>
let pro: SupabaseClient<Database>

async function login(nome: string) {
  const email = `apr009-${nome}-${randomUUID().slice(0, 6)}@ciclo.test`
  const senha = randomUUID()
  const u = await svc.auth.admin.createUser({ email, password: senha, email_confirm: true })
  usuarios.push(u.data.user!.id)
  const db = createClient<Database>(SUPABASE_URL!, ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })
  return { userId: u.data.user!.id, entrar: async () => (await db.auth.signInWithPassword({ email, password: senha }), db) }
}

/** Comanda da profissional, com um item, fechada pelo serviço de verdade. */
async function comandaFechada() {
  const ticketId = (await svc.from('tickets').insert({ tenant_id: tenantId, client_id: cliente, professional_id: profId }).select('id').single()).data!.id
  const item = await adicionarItemComanda(pro, tenantId, ticketId, { serviceId: servico, professionalId: profId, qty: 1, discountCents: 0 })
  await fecharComanda(pro, tenantId, ticketId, 'pix')
  return { ticketId, itemId: item.id }
}

beforeAll(async () => {
  const d = await login('dono')
  const { tenant } = await executarOnboarding(svc, { userId: d.userId, businessName: 'Comanda Congelada', vertical: 'barber', slug: `apr009-${randomUUID().slice(0, 8)}`, timezone: 'America/Sao_Paulo' })
  tenantId = tenant.id
  servico = (await svc.from('services').select('id').eq('tenant_id', tenantId).limit(1).single()).data!.id
  cliente = (await svc.from('clients').insert({ tenant_id: tenantId, name: 'Cliente APR-009' }).select('id').single()).data!.id
  const p = await login('pro')
  await svc.from('memberships').insert({ tenant_id: tenantId, user_id: p.userId, role: 'professional' })
  profId = (await svc.from('professionals').insert({ tenant_id: tenantId, user_id: p.userId, display_name: 'Pro' }).select('id').single()).data!.id
  dono = await d.entrar()
  pro = await p.entrar()
}, 60_000)

afterAll(async () => {
  // Controle da cascata (R-02): apagar o negócio com comandas fechadas continua funcionando.
  const { error } = await svc.from('tenants').delete().eq('id', tenantId)
  expect(error).toBeNull()
  for (const u of usuarios) await svc.auth.admin.deleteUser(u)
}, 60_000)

describe('comanda fechada congelada no banco (APR-009)', () => {
  it('a profissional NÃO muda a comissão do próprio item depois de fechar', async () => {
    const { itemId } = await comandaFechada()
    const antes = (await svc.from('ticket_items').select('commission_cents').eq('id', itemId).single()).data!.commission_cents
    const r = await pro.from('ticket_items').update({ commission_cents: antes + 99_999 }).eq('id', itemId).select('id')
    expect(r.error?.code, 'código próprio, não o 42501 de privilégio').toBe('55000')
    expect((await svc.from('ticket_items').select('commission_cents').eq('id', itemId).single()).data!.commission_cents).toBe(antes)
  })

  it('o dono também não muda total, taxa ou forma de comanda fechada', async () => {
    const { ticketId } = await comandaFechada()
    for (const campo of [{ total_cents: 1 }, { fee_cents: 12_345 }, { payment_method: 'cash' as const }, { profit_cents: -1 }]) {
      const r = await dono.from('tickets').update(campo).eq('id', ticketId).select('id')
      expect(r.error?.code, JSON.stringify(campo)).toBe('55000')
    }
  })

  it('ninguém apaga comanda: some o DELETE de `tickets`', async () => {
    const { ticketId } = await comandaFechada()
    const r = await dono.from('tickets').delete().eq('id', ticketId).select('id')
    expect(r.data ?? []).toEqual([])
    expect((await svc.from('tickets').select('id').eq('id', ticketId).maybeSingle()).data).not.toBeNull()
  })

  it('item de comanda fechada não se apaga', async () => {
    const { itemId } = await comandaFechada()
    const r = await dono.from('ticket_items').delete().eq('id', itemId).select('id')
    expect(r.data ?? []).toEqual([])
    expect((await svc.from('ticket_items').select('id').eq('id', itemId).maybeSingle()).data).not.toBeNull()
  })

  it('controle: na comanda aberta, lançar e remover item continua funcionando', async () => {
    const ticketId = (await svc.from('tickets').insert({ tenant_id: tenantId, client_id: cliente, professional_id: profId }).select('id').single()).data!.id
    const item = await adicionarItemComanda(pro, tenantId, ticketId, { serviceId: servico, professionalId: profId, qty: 1, discountCents: 0 })
    await removerItemComanda(pro, tenantId, ticketId, item.id)
    expect((await svc.from('ticket_items').select('id').eq('ticket_id', ticketId)).data).toEqual([])
  })

  it('controle: cancelar a comanda fechada (closed → canceled) passa, e a cancelada também fica congelada', async () => {
    const { ticketId } = await comandaFechada()
    const cancelada = await cancelarComandaFechada(dono, tenantId, ticketId)
    expect(cancelada.status).toBe('canceled')
    const r = await dono.from('tickets').update({ total_cents: 1 }).eq('id', ticketId).select('id')
    expect(r.error?.code).toBe('55000')
  })

  it('controle: mudar o que não é dinheiro (data de fechamento, cliente) segue livre', async () => {
    const { ticketId } = await comandaFechada()
    const r = await svc.from('tickets').update({ closed_at: new Date().toISOString(), client_id: null }).eq('id', ticketId).select('id')
    expect(r.error).toBeNull()
  })
})
