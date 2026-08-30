import { randomUUID } from 'node:crypto'

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { criarProfissional } from '@/server/services/profissionais'
import { criarServico } from '@/server/services/servicos'
import { executarOnboarding } from '@/server/services/onboarding'
import { receitaAtribuidaAoCiclo } from '@/server/services/atribuicao'

import type { Database } from '@/server/db/types.gen'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error('O teste de atribuição precisa de NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local.')
}

const svc = createClient<Database>(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })

const TZ = 'America/Sao_Paulo'
let tenantId: string
let professionalId: string
let servicoId: string
let contadorTelefone = 0
const tenants: string[] = []
const usuarios: string[] = []

beforeAll(async () => {
  const marca = randomUUID().slice(0, 8)
  const { data, error } = await svc.auth.admin.createUser({
    email: `atribuicao-${marca}@ciclo.test`,
    password: randomUUID(),
    email_confirm: true,
    user_metadata: { full_name: 'Dona da Atribuição' },
  })
  if (error || !data.user) throw new Error(`seed falhou: ${error?.message}`)
  usuarios.push(data.user.id)

  const { tenant } = await executarOnboarding(svc, {
    userId: data.user.id,
    businessName: 'Salão da Atribuição',
    vertical: 'nails',
    slug: `atribuicao-${marca}`,
    timezone: TZ,
  })
  tenantId = tenant.id
  tenants.push(tenantId)

  const profissional = await criarProfissional(svc, tenantId, {
    displayName: 'Manicure',
    compModel: 'owner',
    commissionBps: 0,
    rentCents: 0,
    acceptsOnline: true,
  })
  professionalId = profissional.id

  const servico = await criarServico(svc, tenantId, {
    name: 'Esmaltação',
    description: null,
    durationMin: 60,
    bufferBeforeMin: 0,
    bufferAfterMin: 0,
    priceCents: 9_000,
    pricingModel: 'fixed',
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

async function criarCliente(nome: string) {
  contadorTelefone++
  const telefone = `+551198855${String(contadorTelefone).padStart(4, '0')}`
  const cliente = await svc.from('clients').insert({ tenant_id: tenantId, name: nome, phone_e164: telefone }).select('id').single()
  if (cliente.error) throw cliente.error
  return cliente.data.id
}

async function criarCampanhaEnviada(clientId: string, sentAtIso: string) {
  const { error } = await svc.from('messages').insert({
    tenant_id: tenantId,
    client_id: clientId,
    channel: 'whatsapp',
    kind: 'campaign',
    status: 'sent',
    sent_at: sentAtIso,
  })
  if (error) throw error
}

async function criarAgendamentoConcluido(clientId: string, createdAtIso: string, priceCents: number) {
  const inicio = new Date(createdAtIso)
  const { data, error } = await svc
    .from('appointments')
    .insert({
      tenant_id: tenantId,
      client_id: clientId,
      professional_id: professionalId,
      service_id: servicoId,
      starts_at: inicio.toISOString(),
      ends_at: new Date(inicio.getTime() + 3_600_000).toISOString(),
      created_at: createdAtIso,
      status: 'done',
      price_cents: priceCents,
    })
    .select('id')
    .single()
  if (error) throw error
  return data.id
}

describe('receitaAtribuidaAoCiclo', () => {
  it(
    'agendamento concluído depois de uma campanha, dentro do mês, entra na soma auditável',
    async () => {
      const cliente = await criarCliente('Voltou Depois da Campanha')
      await criarCampanhaEnviada(cliente, '2026-08-01T13:00:00Z')
      const agendamentoId = await criarAgendamentoConcluido(cliente, '2026-08-05T13:00:00Z', 9_000)

      const resultado = await receitaAtribuidaAoCiclo(svc, tenantId, TZ, '2026-08-01', '2026-08-31')

      expect(resultado.totalCents).toBeGreaterThanOrEqual(9_000)
      expect(resultado.items.some((i) => i.appointmentId === agendamentoId && i.valueCents === 9_000)).toBe(true)
    },
    30_000,
  )

  it(
    'agendamento concluído sem NENHUMA campanha antes não entra na soma',
    async () => {
      const cliente = await criarCliente('Nunca Recebeu Campanha')
      const agendamentoId = await criarAgendamentoConcluido(cliente, '2026-08-06T13:00:00Z', 9_000)

      const resultado = await receitaAtribuidaAoCiclo(svc, tenantId, TZ, '2026-08-01', '2026-08-31')

      expect(resultado.items.some((i) => i.appointmentId === agendamentoId)).toBe(false)
    },
    30_000,
  )

  it(
    'mês sem nenhum agendamento atribuível devolve zero, não erro',
    async () => {
      const resultado = await receitaAtribuidaAoCiclo(svc, tenantId, TZ, '2026-01-01', '2026-01-31')
      expect(resultado).toEqual({ totalCents: 0, count: 0, items: [] })
    },
    30_000,
  )
})
