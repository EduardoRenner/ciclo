import { randomUUID } from 'node:crypto'

import { Temporal } from '@js-temporal/polyfill'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { fechamentoDiario, resumoMensal } from '@/server/services/caixa'
import { fichaDoCliente } from '@/server/services/crm'
import { executarOnboarding } from '@/server/services/onboarding'
import { venderPacote } from '@/server/services/pacotes'
import { resumoDeHoje } from '@/server/services/resumo-hoje'

import type { Database } from '@/server/db/types.gen'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) throw new Error('O teste do pacote no Entrou precisa das chaves do Supabase local no .env.local.')

const svc = createClient<Database>(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
const TZ = 'America/Sao_Paulo'

/*
 * APR-016b (C-02): vender um pacote de 4 sessões por R$ 320 e atender as 4 sessões. Antes, a venda
 * não entrava em lugar nenhum e cada sessão entrava a preço cheio. O aceite do ticket: o "Entrou"
 * somado é R$ 320 — no Caixa, no Mês, na Hoje e na Ficha, e para o gerente também.
 */
let tenantId: string
let cliente: string
let servico: string
const usuarios: string[] = []
let dono: SupabaseClient<Database>
let gerente: SupabaseClient<Database>
let pacoteId: string
const hoje = () => Temporal.Now.zonedDateTimeISO(TZ).toPlainDate().toString()

async function login(role: 'owner' | 'manager') {
  const email = `apr016b-${role}-${randomUUID().slice(0, 6)}@ciclo.test`
  const senha = randomUUID()
  const u = await svc.auth.admin.createUser({ email, password: senha, email_confirm: true })
  usuarios.push(u.data.user!.id)
  return { userId: u.data.user!.id, email, senha }
}

async function entrar(l: { email: string; senha: string }) {
  const db = createClient<Database>(SUPABASE_URL!, ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })
  await db.auth.signInWithPassword({ email: l.email, password: l.senha })
  return db
}

beforeAll(async () => {
  const d = await login('owner')
  const { tenant } = await executarOnboarding(svc, { userId: d.userId, businessName: 'Pacote no Entrou', vertical: 'barber', slug: `apr016b-${randomUUID().slice(0, 8)}`, timezone: TZ })
  tenantId = tenant.id
  servico = (await svc.from('services').select('id').eq('tenant_id', tenantId).limit(1).single()).data!.id
  cliente = (await svc.from('clients').insert({ tenant_id: tenantId, name: 'Cliente do Pacote' }).select('id').single()).data!.id
  const g = await login('manager')
  await svc.from('memberships').insert({ tenant_id: tenantId, user_id: g.userId, role: 'manager' })
  dono = await entrar(d)
  gerente = await entrar(g)

  pacoteId = (await venderPacote(dono, tenantId, { clientId: cliente, serviceId: servico, totalSessions: 4, paidCents: 32_000, paymentMethod: 'pix' })).id
  // As 4 sessões atendidas, fechadas com a forma `package` (o fechamento por pacote é da APR-017).
  const agora = new Date().toISOString()
  const { error } = await svc.from('tickets').insert(
    Array.from({ length: 4 }, () => ({ tenant_id: tenantId, client_id: cliente, status: 'closed' as const, payment_method: 'package' as const, subtotal_cents: 8_000, total_cents: 8_000, closed_at: agora })),
  )
  if (error) throw error
}, 60_000)

afterAll(async () => {
  await svc.from('tenants').delete().eq('id', tenantId)
  for (const u of usuarios) await svc.auth.admin.deleteUser(u)
}, 60_000)

describe('o pacote vendido entra no Entrou uma vez só (APR-016b)', () => {
  it('a venda gravou um pagamento de R$ 320 em pix', async () => {
    const { data } = await svc.from('payments').select('kind, method, status, amount_cents').eq('package_id', pacoteId)
    expect(data).toEqual([{ kind: 'package', method: 'pix', status: 'paid', amount_cents: 32_000 }])
  })

  it('Caixa do dia e Mês: R$ 320, não R$ 640 nem R$ 0', async () => {
    expect((await fechamentoDiario(dono, tenantId, TZ, hoje())).revenueCents).toBe(32_000)
    expect((await resumoMensal(dono, tenantId, TZ, hoje().slice(0, 7))).revenueCents).toBe(32_000)
  })

  it('o gerente, que não vê comissão, vê o mesmo Caixa', async () => {
    expect((await fechamentoDiario(gerente, tenantId, TZ, hoje())).revenueCents).toBe(32_000)
  })

  it('Hoje e Ficha: o mesmo número', async () => {
    expect((await resumoDeHoje(dono, tenantId, TZ)).numeroDoDia).toEqual({ rotulo: 'Entrou hoje', cents: 32_000 })
    const ficha = await fichaDoCliente(dono, tenantId, cliente, TZ)
    expect(ficha.metricas.valorDaFicha).toEqual({ rotulo: 'Entrou', cents: 32_000 })
    expect(ficha.metricas.ticketMedioCents, 'o atendimento vale R$ 80, não a venda de R$ 320').toBe(8_000)
  })

  it('venda desfeita (refunded, sem DELETE): o Entrou do dia volta a zero', async () => {
    await svc.from('payments').update({ status: 'refunded', refunded_at: new Date().toISOString() }).eq('package_id', pacoteId)
    expect((await fechamentoDiario(dono, tenantId, TZ, hoje())).revenueCents).toBe(0)
    await svc.from('payments').update({ status: 'paid', refunded_at: null }).eq('package_id', pacoteId)
  })
})
