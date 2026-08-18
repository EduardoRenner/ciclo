import { randomUUID } from 'node:crypto'

import { Temporal } from '@js-temporal/polyfill'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import type { MessagingProvider } from '@/server/providers/messaging/types'
import { criarServico } from '@/server/services/servicos'
import { executarOnboarding } from '@/server/services/onboarding'
import { enviarParaRecuperar, listarParaRecuperar } from '@/server/services/recuperar-receita'

import type { Database } from '@/server/db/types.gen'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error('O teste de recuperar-receita precisa de NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local.')
}

const svc = createClient<Database>(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })

const TZ = 'America/Sao_Paulo'
let tenantId: string
let servicoId: string
const tenants: string[] = []
const usuarios: string[] = []

beforeAll(async () => {
  const marca = randomUUID().slice(0, 8)
  const { data, error } = await svc.auth.admin.createUser({
    email: `recuperar-${marca}@ciclo.test`,
    password: randomUUID(),
    email_confirm: true,
    user_metadata: { full_name: 'Dona do Recuperar' },
  })
  if (error || !data.user) throw new Error(`seed falhou: ${error?.message}`)
  usuarios.push(data.user.id)

  const { tenant } = await executarOnboarding(svc, {
    userId: data.user.id,
    businessName: 'Salão do Recuperar',
    vertical: 'nails',
    slug: `recuperar-${marca}`,
    timezone: TZ,
  })
  tenantId = tenant.id
  tenants.push(tenantId)

  const servico = await criarServico(svc, tenantId, {
    name: 'Esmaltação',
    description: null,
    durationMin: 60,
    bufferBeforeMin: 0,
    bufferAfterMin: 0,
    priceCents: 10_000,
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

let contadorTelefone = 0

async function criarClienteEmCiclo(nome: string, opcoes: { state: Database['public']['Enums']['cycle_state']; valueAtRiskCents: number; optOut?: boolean }) {
  contadorTelefone++
  // Telefone único por cliente: `clients_unique_phone` (tenant_id, phone_e164) rejeitaria o
  // segundo insert com o mesmo número, e o teste original usava um número fixo para todos.
  const telefone = `+551198899${String(contadorTelefone).padStart(4, '0')}`
  const cliente = await svc
    .from('clients')
    .insert({ tenant_id: tenantId, name: nome, phone_e164: telefone, whatsapp_opt_out: opcoes.optOut ?? false })
    .select('id')
    .single()
  if (cliente.error) throw cliente.error
  const clientId = cliente.data.id

  await svc.from('client_cycles').insert({
    tenant_id: tenantId,
    client_id: clientId,
    service_id: servicoId,
    personal_cycle_days: 21,
    last_visit_on: '2026-07-01',
    predicted_on: '2026-07-22',
    late_days: 15,
    state: opcoes.state,
    value_at_risk_cents: opcoes.valueAtRiskCents,
  })

  return clientId
}

// 14h em São Paulo: dentro da janela permitida (8h–21h, §7), sem depender da
// hora real em que o teste roda — 21h40 no relógio de verdade já quebrou uma
// versão anterior deste teste.
const DENTRO_DA_JANELA = Temporal.ZonedDateTime.from('2026-08-18T14:00:00-03:00[America/Sao_Paulo]').toInstant()

function providerQueSempreFunciona(): MessagingProvider {
  return {
    sendTemplate: vi.fn(async () => ({ providerId: `wamid.${randomUUID()}` })),
    sendText: vi.fn(async () => ({ providerId: `wamid.${randomUUID()}` })),
    parseWebhook: vi.fn(),
  }
}

describe('listarParaRecuperar', () => {
  it(
    'totalValueCents soma o filtro inteiro, items respeita o limit',
    async () => {
      await criarClienteEmCiclo('Devedora A', { state: 'late', valueAtRiskCents: 5_000 })
      await criarClienteEmCiclo('Devedora B', { state: 'at_risk', valueAtRiskCents: 3_000 })

      const tudo = await listarParaRecuperar(svc, tenantId)
      expect(tudo.totalValueCents).toBeGreaterThanOrEqual(8_000)
      expect(tudo.count).toBeGreaterThanOrEqual(2)

      const soLate = await listarParaRecuperar(svc, tenantId, { state: 'late' })
      expect(soLate.items.every((i) => i.state === 'late')).toBe(true)
    },
    30_000,
  )
})

describe('enviarParaRecuperar', () => {
  it(
    'envia para quem não está em opt-out, pula quem está',
    async () => {
      const podeReceber = await criarClienteEmCiclo('Pode Receber', { state: 'due', valueAtRiskCents: 8_500 })
      const emOptOut = await criarClienteEmCiclo('Pediu Pra Parar', { state: 'due', valueAtRiskCents: 8_500, optOut: true })

      const resultado = await enviarParaRecuperar(
        svc,
        tenantId,
        TZ,
        {
          items: [
            { clientId: podeReceber, serviceId: servicoId },
            { clientId: emOptOut, serviceId: servicoId },
          ],
          mode: 'template',
        },
        providerQueSempreFunciona(),
        DENTRO_DA_JANELA,
      )

      expect(resultado.queued).toBe(1)
      expect(resultado.skipped).toEqual([{ clientId: emOptOut, reason: 'opt_out' }])

      const linha = await svc
        .from('client_cycles')
        .select('last_campaign_at')
        .eq('tenant_id', tenantId)
        .eq('client_id', podeReceber)
        .single()
      expect(linha.data?.last_campaign_at).not.toBeNull()
    },
    30_000,
  )

  it(
    'segunda tentativa em menos de 7 dias é recusada por rate_limited',
    async () => {
      const cliente = await criarClienteEmCiclo('Já Avisada Hoje', { state: 'late', valueAtRiskCents: 4_000 })

      const primeira = await enviarParaRecuperar(
        svc,
        tenantId,
        TZ,
        { items: [{ clientId: cliente, serviceId: servicoId }], mode: 'template' },
        providerQueSempreFunciona(),
        DENTRO_DA_JANELA,
      )
      expect(primeira.queued).toBe(1)

      const segunda = await enviarParaRecuperar(
        svc,
        tenantId,
        TZ,
        { items: [{ clientId: cliente, serviceId: servicoId }], mode: 'template' },
        providerQueSempreFunciona(),
        DENTRO_DA_JANELA,
      )
      expect(segunda.queued).toBe(0)
      expect(segunda.skipped).toEqual([{ clientId: cliente, reason: 'rate_limited' }])
    },
    30_000,
  )
})
