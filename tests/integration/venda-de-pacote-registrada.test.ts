import { randomUUID } from 'node:crypto'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { executarOnboarding } from '@/server/services/onboarding'

import type { Database } from '@/server/db/types.gen'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) throw new Error('O teste da venda de pacote precisa das chaves do Supabase local no .env.local.')

const svc = createClient<Database>(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })

/*
 * APR-016a: `registrar_venda_de_pacote` (0125) grava o pacote e o dinheiro da venda numa transação
 * só, com a RLS de quem vende. Antes, a venda só existia em `packages.paid_cents`.
 */
let tenantId: string
let servico: string
let cliente: string
const usuarios: string[] = []
let dono: SupabaseClient<Database>
let profissional: SupabaseClient<Database>

async function entrar(role: 'owner' | 'professional') {
  const email = `apr016-${role}-${randomUUID().slice(0, 6)}@ciclo.test`
  const senha = randomUUID()
  const u = await svc.auth.admin.createUser({ email, password: senha, email_confirm: true })
  usuarios.push(u.data.user!.id)
  return { userId: u.data.user!.id, email, senha }
}

async function cliente_(e: { email: string; senha: string }) {
  const db = createClient<Database>(SUPABASE_URL!, ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })
  await db.auth.signInWithPassword({ email: e.email, password: e.senha })
  return db
}

beforeAll(async () => {
  const d = await entrar('owner')
  const { tenant } = await executarOnboarding(svc, { userId: d.userId, businessName: 'Venda de Pacote', vertical: 'barber', slug: `apr016-${randomUUID().slice(0, 8)}`, timezone: 'America/Sao_Paulo' })
  tenantId = tenant.id
  servico = (await svc.from('services').select('id').eq('tenant_id', tenantId).limit(1).single()).data!.id
  cliente = (await svc.from('clients').insert({ tenant_id: tenantId, name: 'Cliente do Pacote' }).select('id').single()).data!.id
  const p = await entrar('professional')
  await svc.from('memberships').insert({ tenant_id: tenantId, user_id: p.userId, role: 'professional' })
  await svc.from('professionals').insert({ tenant_id: tenantId, user_id: p.userId, display_name: 'Pro' })
  dono = await cliente_(d)
  profissional = await cliente_(p)
}, 60_000)

afterAll(async () => {
  await svc.from('tenants').delete().eq('id', tenantId)
  for (const u of usuarios) await svc.auth.admin.deleteUser(u)
}, 60_000)

const venda = (extra: Partial<Database['public']['Functions']['registrar_venda_de_pacote']['Args']> = {}) => ({
  p_tenant: tenantId,
  p_client: cliente,
  p_service: servico,
  p_total_sessions: 4,
  p_paid_cents: 32_000,
  p_expires_on: null as unknown as string,
  p_method: 'pix' as const,
  p_fee_cents: 0,
  ...extra,
})

const pagamentosDo = async (packageId: string) => (await svc.from('payments').select('kind, method, status, amount_cents, fee_cents, net_cents, client_id, paid_at').eq('package_id', packageId)).data ?? []

describe('venda de pacote registrada como dinheiro (APR-016a)', () => {
  it('o dono vende R$ 320: um pacote e um pagamento pago, ligados', async () => {
    const r = await dono.rpc('registrar_venda_de_pacote', venda({ p_method: 'credit', p_fee_cents: 1_000 }))
    expect(r.error).toBeNull()
    const pacote = r.data as { id: string; paid_cents: number; total_sessions: number }
    expect(pacote.paid_cents).toBe(32_000)
    const pagamentos = await pagamentosDo(pacote.id)
    expect(pagamentos).toHaveLength(1)
    expect(pagamentos[0]).toMatchObject({ kind: 'package', method: 'credit', status: 'paid', amount_cents: 32_000, fee_cents: 1_000, net_cents: 31_000, client_id: cliente })
    expect(pagamentos[0]!.paid_at).not.toBeNull()
  })

  it('o profissional também vende — sem precisar ler `payments`, que é só de quem vê comissão', async () => {
    const r = await profissional.rpc('registrar_venda_de_pacote', venda())
    expect(r.error).toBeNull()
    expect(await pagamentosDo((r.data as { id: string }).id)).toHaveLength(1)
    // 0126 (APR-016b): a venda de pacote é lida por quem já vê o pacote; o resto de `payments` não.
    await svc.from('payments').insert({ tenant_id: tenantId, client_id: cliente, kind: 'deposit', method: 'pix', status: 'paid', amount_cents: 2_000 })
    const leitura = await profissional.from('payments').select('kind').eq('tenant_id', tenantId)
    const tipos = new Set((leitura.data ?? []).map((p) => p.kind))
    expect(tipos.has('package'), 'a venda de pacote fica visível como o pacote').toBe(true)
    expect(tipos.has('deposit'), 'o sinal continua só de quem vê comissão').toBe(false)
  })

  it('pacote de cortesia (R$ 0) não é dinheiro: sem pagamento', async () => {
    const r = await dono.rpc('registrar_venda_de_pacote', venda({ p_paid_cents: 0 }))
    expect(r.error).toBeNull()
    expect(await pagamentosDo((r.data as { id: string }).id)).toHaveLength(0)
  })

  it('forma que não é dinheiro novo (pacote, clube, vale) é recusada, e nada fica gravado', async () => {
    const antes = (await svc.from('packages').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId)).count
    for (const forma of ['package', 'club', 'voucher'] as const) {
      const r = await dono.rpc('registrar_venda_de_pacote', venda({ p_method: forma }))
      expect(r.error?.code).toBe('22023')
    }
    expect((await svc.from('packages').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId)).count).toBe(antes)
  })

  it('se o pagamento falha, o pacote também não fica', async () => {
    const antes = (await svc.from('packages').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId)).count
    // O pacote cabe (2^63 − 1024 é exato em double e menor que o teto do bigint); o `net_cents` do
    // pagamento (pago − taxa) estoura o bigint — a falha acontece DEPOIS de o pacote ser inserido.
    const r = await dono.rpc('registrar_venda_de_pacote', venda({ p_paid_cents: 9_223_372_036_854_774_784, p_fee_cents: -10_000 }))
    expect(r.error?.message).toMatch(/bigint out of range/)
    expect((await svc.from('packages').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId)).count).toBe(antes)

    // Controle: o mesmo pacote, sozinho, cabe na tabela — a falha foi mesmo no passo do pagamento.
    const sozinho = await svc.from('packages').insert({ tenant_id: tenantId, client_id: cliente, service_id: servico, total_sessions: 4, paid_cents: 9_223_372_036_854_774_784 }).select('id').single()
    expect(sozinho.error).toBeNull()
  })

  it('quem não é do negócio não vende', async () => {
    const e = await entrar('owner')
    const estranho = await cliente_(e)
    const r = await estranho.rpc('registrar_venda_de_pacote', venda())
    expect(r.error).not.toBeNull()
  })
})
