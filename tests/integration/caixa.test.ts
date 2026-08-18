import { randomUUID } from 'node:crypto'

import { Temporal } from '@js-temporal/polyfill'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { fechamentoDiario, resumoMensal } from '@/server/services/caixa'
import { executarOnboarding } from '@/server/services/onboarding'

import type { Database } from '@/server/db/types.gen'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error('O teste de caixa precisa de NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local.')
}

const svc = createClient<Database>(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })

const TZ = 'America/Sao_Paulo'
let tenantId: string
const tenants: string[] = []
const usuarios: string[] = []

beforeAll(async () => {
  const marca = randomUUID().slice(0, 8)
  const { data, error } = await svc.auth.admin.createUser({
    email: `caixa-${marca}@ciclo.test`,
    password: randomUUID(),
    email_confirm: true,
    user_metadata: { full_name: 'Dona do Caixa' },
  })
  if (error || !data.user) throw new Error(`seed falhou: ${error?.message}`)
  usuarios.push(data.user.id)

  const { tenant } = await executarOnboarding(svc, {
    userId: data.user.id,
    businessName: 'Salão do Caixa',
    vertical: 'nails',
    slug: `caixa-${marca}`,
    timezone: TZ,
  })
  tenantId = tenant.id
  tenants.push(tenantId)
}, 60_000)

afterAll(async () => {
  for (const t of tenants) await svc.from('tenants').delete().eq('id', t)
  for (const u of usuarios) await svc.auth.admin.deleteUser(u)
}, 60_000)

async function inserirTicketFechado(closedAtIso: string, totais: { total: number; material: number; fee: number; commission: number; profit: number }) {
  await svc.from('tickets').insert({
    tenant_id: tenantId,
    status: 'closed',
    total_cents: totais.total,
    material_cost_cents: totais.material,
    fee_cents: totais.fee,
    commission_cents: totais.commission,
    profit_cents: totais.profit,
    closed_at: closedAtIso,
  })
}

describe('fechamentoDiario', () => {
  it(
    'soma só os tickets closed/paid do dia, ignora open',
    async () => {
      const dia = '2026-03-10'
      await inserirTicketFechado(`${dia}T14:00:00-03:00`, { total: 10_000, material: 1_000, fee: 300, commission: 2_000, profit: 6_700 })
      await inserirTicketFechado(`${dia}T18:00:00-03:00`, { total: 5_000, material: 500, fee: 150, commission: 1_000, profit: 3_350 })
      await svc.from('tickets').insert({ tenant_id: tenantId, status: 'open', total_cents: 99_999 })

      const resumo = await fechamentoDiario(svc, tenantId, TZ, dia)
      expect(resumo.ticketsCount).toBe(2)
      expect(resumo.revenueCents).toBe(15_000)
      expect(resumo.profitCents).toBe(10_050)
    },
    30_000,
  )

  it(
    'fechamento às 23h30 no fuso do tenant conta para o dia LOCAL, não o dia UTC seguinte',
    async () => {
      const dia = '2026-04-05'
      // 23h30 em São Paulo (-03:00) é 02h30 UTC do dia seguinte — a view
      // v_daily_cash (date_trunc em UTC) erraria isso; a implementação usa
      // limites calculados no fuso do tenant e não deve.
      await inserirTicketFechado(`${dia}T23:30:00-03:00`, { total: 7_000, material: 700, fee: 0, commission: 0, profit: 6_300 })

      const doDiaCerto = await fechamentoDiario(svc, tenantId, TZ, dia)
      expect(doDiaCerto.ticketsCount).toBe(1)
      expect(doDiaCerto.revenueCents).toBe(7_000)

      const diaSeguinteUTC = Temporal.PlainDate.from(dia).add({ days: 1 }).toString()
      const doDiaErrado = await fechamentoDiario(svc, tenantId, TZ, diaSeguinteUTC)
      expect(doDiaErrado.ticketsCount).toBe(0)
    },
    30_000,
  )

  it(
    'dia sem nenhum ticket devolve zeros, não erro',
    async () => {
      const resumo = await fechamentoDiario(svc, tenantId, TZ, '2020-01-01')
      expect(resumo).toMatchObject({ ticketsCount: 0, revenueCents: 0, profitCents: 0 })
    },
    30_000,
  )
})

describe('resumoMensal', () => {
  it(
    'soma tickets de dias diferentes dentro do mesmo mês',
    async () => {
      await inserirTicketFechado('2026-05-02T10:00:00-03:00', { total: 3_000, material: 0, fee: 0, commission: 0, profit: 3_000 })
      await inserirTicketFechado('2026-05-28T10:00:00-03:00', { total: 4_000, material: 0, fee: 0, commission: 0, profit: 4_000 })
      // Fora do mês — não pode entrar na soma de maio.
      await inserirTicketFechado('2026-06-01T10:00:00-03:00', { total: 99_999, material: 0, fee: 0, commission: 0, profit: 0 })

      const resumo = await resumoMensal(svc, tenantId, TZ, '2026-05')
      expect(resumo.ticketsCount).toBe(2)
      expect(resumo.revenueCents).toBe(7_000)
    },
    30_000,
  )
})
