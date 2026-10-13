import { randomUUID } from 'node:crypto'

import { Temporal } from '@js-temporal/polyfill'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { receitaAtribuidaAoCiclo, receitaPorCampanha } from '@/server/services/atribuicao'
import { executarOnboarding } from '@/server/services/onboarding'

import type { Database } from '@/server/db/types.gen'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) throw new Error('O teste de atribuição precisa de NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local.')

const svc = createClient<Database>(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
const TZ = 'America/Sao_Paulo'
const N = 1_200
const PRECO = 5_000

/*
 * APR-012 (achado E-02): o PostgREST corta em `max_rows = 1000` SEM erro. Com mais de mil
 * mensagens ou atendimentos, "o Motor trouxe R$ X" e o resultado por campanha saíam menores, em
 * silêncio. Cenário: 1.200 pessoas, cada uma com a mensagem da campanha e, dois dias depois, um
 * atendimento concluído — todos atribuíveis. O oráculo é a conta direta: 1.200 × preço.
 */
let tenantId: string
let campanhaId: string
const usuarios: string[] = []

beforeAll(async () => {
  const marca = randomUUID().slice(0, 8)
  const { data } = await svc.auth.admin.createUser({ email: `apr012-${marca}@ciclo.test`, password: randomUUID(), email_confirm: true })
  usuarios.push(data.user!.id)
  const { tenant } = await executarOnboarding(svc, { userId: data.user!.id, businessName: 'Volume APR-012', vertical: 'barber', slug: `apr012-${marca}`, timezone: TZ })
  tenantId = tenant.id
  const servico = (await svc.from('services').select('id').eq('tenant_id', tenantId).limit(1).single()).data!.id
  const profissional = (await svc.from('professionals').select('id').eq('tenant_id', tenantId).limit(1).single()).data!.id
  campanhaId = (await svc.from('campaigns').insert({ tenant_id: tenantId, name: 'Volta', segment: {}, template: 'oi', status: 'sent' }).select('id').single()).data!.id

  const clientes: string[] = []
  for (let i = 0; i < N; i += 300) {
    const r = await svc.from('clients').insert(Array.from({ length: Math.min(300, N - i) }, (_, k) => ({ tenant_id: tenantId, name: `Pessoa ${i + k}` }))).select('id')
    if (r.error) throw r.error
    clientes.push(...r.data.map((c) => c.id))
  }
  const agora = Date.now()
  const mensagens = clientes.map((client_id, k) => ({
    tenant_id: tenantId,
    client_id,
    campaign_id: campanhaId,
    kind: 'campaign' as const,
    channel: 'whatsapp' as const,
    status: 'sent' as const,
    sent_at: new Date(agora - 6 * 86_400_000 + k * 1000).toISOString(),
  }))
  // Um atendimento por pessoa, criado dois dias depois da mensagem, em horários que não se sobrepõem.
  const atendimentos = clientes.map((client_id, k) => {
    const inicio = new Date(agora - 3 * 86_400_000 + k * 60 * 60_000)
    return {
      tenant_id: tenantId,
      client_id,
      professional_id: profissional,
      service_id: servico,
      starts_at: inicio.toISOString(),
      ends_at: new Date(inicio.getTime() + 30 * 60_000).toISOString(),
      status: 'done' as const,
      price_cents: PRECO,
      created_at: new Date(agora - 4 * 86_400_000 + k * 1000).toISOString(),
    }
  })
  for (let i = 0; i < N; i += 300) {
    const m = await svc.from('messages').insert(mensagens.slice(i, i + 300))
    if (m.error) throw m.error
    const a = await svc.from('appointments').insert(atendimentos.slice(i, i + 300))
    if (a.error) throw a.error
  }
}, 180_000)

afterAll(async () => {
  await svc.from('tenants').delete().eq('id', tenantId)
  for (const u of usuarios) await svc.auth.admin.deleteUser(u)
}, 120_000)

describe('atribuição sem corte de 1.000 linhas (APR-012)', () => {
  it(
    `${N} retornos atribuíveis: o mês e a campanha contam todos`,
    async () => {
      const hoje = Temporal.Now.zonedDateTimeISO(TZ).toPlainDate()
      const mes = await receitaAtribuidaAoCiclo(svc, tenantId, TZ, hoje.subtract({ days: 10 }).toString(), hoje.toString())
      expect(mes.count).toBe(N)
      expect(mes.totalCents).toBe(N * PRECO)

      const porCampanha = await receitaPorCampanha(svc, tenantId)
      expect(porCampanha.get(campanhaId)).toEqual({ bookedCount: N, revenueCents: N * PRECO })
    },
    120_000,
  )
})
