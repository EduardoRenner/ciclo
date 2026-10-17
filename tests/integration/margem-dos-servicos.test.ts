import { randomUUID } from 'node:crypto'

import { Temporal } from '@js-temporal/polyfill'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { margemPorServico, type ComandaFechada } from '@/core/caixa/margem-do-servico'
import { margemDosServicos } from '@/server/services/caixa'
import { executarOnboarding } from '@/server/services/onboarding'

import type { Database } from '@/server/db/types.gen'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error('O teste da margem dos serviços precisa de NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local.')
}

const svc = createClient<Database>(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
const TZ = 'America/Sao_Paulo'
const COMANDAS = 250

/*
 * APR-010 (achado B-00b): com ~220 comandas fechadas em 90 dias, `margemDosServicos` montava
 * `.in('ticket_id', <todos os ids>)`, a URL passava do limite do gateway (414) e o Mês e os Serviços
 * abriam em "Não consegui carregar esta tela". O cenário tem 250 — acima do limite medido — e o
 * oráculo é a conta do core sobre o que foi inserido, sem passar pelo banco.
 */
let tenantId: string
const usuarios: string[] = []
const esperadas: ComandaFechada[] = []

beforeAll(async () => {
  const marca = randomUUID().slice(0, 8)
  const { data, error } = await svc.auth.admin.createUser({ email: `apr010-${marca}@ciclo.test`, password: randomUUID(), email_confirm: true })
  if (error || !data.user) throw new Error(`seed falhou: ${error?.message}`)
  usuarios.push(data.user.id)
  const { tenant } = await executarOnboarding(svc, { userId: data.user.id, businessName: 'Salão APR-010', vertical: 'barber', slug: `apr010-${marca}`, timezone: TZ })
  tenantId = tenant.id

  const servicos = (await svc.from('services').select('id').eq('tenant_id', tenantId).limit(3)).data!.map((s) => s.id)
  const cliente = (await svc.from('clients').insert({ tenant_id: tenantId, name: 'Cliente APR-010' }).select('id').single()).data!.id

  const tickets: Database['public']['Tables']['tickets']['Insert'][] = []
  const itens: Database['public']['Tables']['ticket_items']['Insert'][] = []
  for (let i = 0; i < COMANDAS; i++) {
    const id = randomUUID()
    const servico = servicos[i % servicos.length]!
    const total = 4_000 + (i % 7) * 500
    const custo = (i % 5) * 100
    const comissao = Math.round(total * 0.4)
    const desconto = i % 9 === 0 ? 500 : 0
    const taxa = i % 4 === 0 ? Math.round(total * 0.0349) : 0
    const fechadaEm = new Date(Date.now() - ((i % 80) + 1) * 86_400_000).toISOString()
    tickets.push({ id, tenant_id: tenantId, client_id: cliente, status: 'closed', subtotal_cents: total, discount_cents: desconto, fee_cents: taxa, total_cents: total - desconto, closed_at: fechadaEm })
    itens.push({ tenant_id: tenantId, ticket_id: id, service_id: servico, description: 'Serviço', qty: 1, unit_price_cents: total, total_cents: total, cost_cents: custo, commission_cents: comissao })
    esperadas.push({ itens: [{ serviceId: servico, totalCents: total, costCents: custo, commissionCents: comissao }], discountCents: desconto, feeCents: taxa })
  }
  for (let i = 0; i < tickets.length; i += 100) {
    const r = await svc.from('tickets').insert(tickets.slice(i, i + 100))
    if (r.error) throw r.error
  }
  for (let i = 0; i < itens.length; i += 100) {
    const r = await svc.from('ticket_items').insert(itens.slice(i, i + 100))
    if (r.error) throw r.error
  }
}, 120_000)

afterAll(async () => {
  await svc.from('tenants').delete().eq('id', tenantId)
  for (const u of usuarios) await svc.auth.admin.deleteUser(u)
}, 60_000)

const hoje = () => Temporal.Now.zonedDateTimeISO(TZ).toPlainDate().toString()

describe('margem dos serviços com muitas comandas (APR-010)', () => {
  it(
    `${COMANDAS} comandas em 90 dias: abre, e bate com a conta do core sobre o que foi gravado`,
    async () => {
      const margens = await margemDosServicos(svc, tenantId, TZ, hoje())
      const ordenar = (m: { serviceId: string }[]) => [...m].sort((a, b) => a.serviceId.localeCompare(b.serviceId))
      expect(ordenar(margens)).toEqual(ordenar(margemPorServico(esperadas)))
      expect(margens.length).toBeGreaterThan(0)
    },
    60_000,
  )

  it(
    'negócio sem comanda: lista vazia, sem erro',
    async () => {
      const marca = randomUUID().slice(0, 8)
      const { data } = await svc.auth.admin.createUser({ email: `apr010-vazio-${marca}@ciclo.test`, password: randomUUID(), email_confirm: true })
      usuarios.push(data.user!.id)
      const { tenant } = await executarOnboarding(svc, { userId: data.user!.id, businessName: 'Vazio', vertical: 'barber', slug: `apr010-vazio-${marca}`, timezone: TZ })
      try {
        expect(await margemDosServicos(svc, tenant.id, TZ, hoje())).toEqual([])
      } finally {
        await svc.from('tenants').delete().eq('id', tenant.id)
      }
    },
    60_000,
  )
})
