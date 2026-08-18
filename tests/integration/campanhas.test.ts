import { randomUUID } from 'node:crypto'

import { Temporal } from '@js-temporal/polyfill'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { criarServico } from '@/server/services/servicos'
import { executarOnboarding } from '@/server/services/onboarding'
import { executarCampanhaDiaria } from '@/server/services/campanhas'

import type { Database } from '@/server/db/types.gen'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error('O teste de campanhas precisa de NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local.')
}

const svc = createClient<Database>(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })

const TZ = 'America/Sao_Paulo'
// 10h local: dentro da janela 8h-21h e é a hora que o cron do TICKET-038 processa.
const AGORA_10H_LOCAL = Temporal.ZonedDateTime.from(`2026-08-18T10:30:00[${TZ}]`).toInstant()

let tenantId: string
let servicoId: string
let contadorTelefone = 0
const tenants: string[] = []
const usuarios: string[] = []

beforeAll(async () => {
  const marca = randomUUID().slice(0, 8)
  const { data, error } = await svc.auth.admin.createUser({
    email: `campanhas-${marca}@ciclo.test`,
    password: randomUUID(),
    email_confirm: true,
    user_metadata: { full_name: 'Dona das Campanhas' },
  })
  if (error || !data.user) throw new Error(`seed falhou: ${error?.message}`)
  usuarios.push(data.user.id)

  const { tenant } = await executarOnboarding(svc, {
    userId: data.user.id,
    businessName: 'Salão das Campanhas',
    vertical: 'nails',
    slug: `campanhas-${marca}`,
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
    priceCents: 8_000,
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

async function criarClienteEmCiclo(nome: string, opcoes: { state: Database['public']['Enums']['cycle_state']; optOut?: boolean }) {
  contadorTelefone++
  const telefone = `+551198877${String(contadorTelefone).padStart(4, '0')}`
  const cliente = await svc
    .from('clients')
    .insert({ tenant_id: tenantId, name: nome, phone_e164: telefone, whatsapp_opt_out: opcoes.optOut ?? false })
    .select('id')
    .single()
  if (cliente.error) throw cliente.error
  const clientId = cliente.data.id

  const { error } = await svc.from('client_cycles').insert({
    tenant_id: tenantId,
    client_id: clientId,
    service_id: servicoId,
    personal_cycle_days: 21,
    last_visit_on: '2026-07-01',
    predicted_on: '2026-07-22',
    late_days: 20,
    state: opcoes.state,
    value_at_risk_cents: 5_000,
  })
  if (error) throw error

  return clientId
}

vi.mock('@/server/providers/messaging/whatsapp', () => ({
  WhatsAppCloudProvider: class {
    sendTemplate = vi.fn(async () => ({ providerId: `wamid.${randomUUID()}` }))
    sendText = vi.fn(async () => ({ providerId: `wamid.${randomUUID()}` }))
    parseWebhook = vi.fn()
  },
}))

describe('executarCampanhaDiaria', () => {
  it(
    'sem candidato nenhum (ninguém due/late/at_risk/lost), não envia nada',
    async () => {
      const resultado = await executarCampanhaDiaria(svc, tenantId, TZ, AGORA_10H_LOCAL)
      expect(resultado).toEqual({ queued: 0, skipped: [] })
    },
    30_000,
  )

  it(
    'seleciona sozinho todo mundo elegível — sem escolha manual da profissional',
    async () => {
      const elegivel = await criarClienteEmCiclo('Some do Radar', { state: 'late' })
      const emOptOut = await criarClienteEmCiclo('Pediu Pra Sair', { state: 'at_risk', optOut: true })

      const resultado = await executarCampanhaDiaria(svc, tenantId, TZ, AGORA_10H_LOCAL)

      expect(resultado.queued).toBe(1)
      expect(resultado.skipped).toEqual([{ clientId: emOptOut, reason: 'opt_out' }])

      const linha = await svc.from('client_cycles').select('last_campaign_at').eq('tenant_id', tenantId).eq('client_id', elegivel).single()
      expect(linha.data?.last_campaign_at).not.toBeNull()
    },
    30_000,
  )

  it(
    'rodar de novo no mesmo dia não manda segunda vez pro mesmo cliente (7 dias)',
    async () => {
      const cliente = await criarClienteEmCiclo('Já Avisada Hoje', { state: 'due' })

      const primeira = await executarCampanhaDiaria(svc, tenantId, TZ, AGORA_10H_LOCAL)
      expect(primeira.skipped.find((s) => s.clientId === cliente)).toBeUndefined()

      const segunda = await executarCampanhaDiaria(svc, tenantId, TZ, AGORA_10H_LOCAL)
      expect(segunda.skipped.some((s) => s.clientId === cliente && s.reason === 'rate_limited')).toBe(true)
    },
    30_000,
  )
})
