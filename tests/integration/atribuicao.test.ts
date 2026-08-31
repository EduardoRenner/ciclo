import { randomUUID } from 'node:crypto'

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { criarProfissional } from '@/server/services/profissionais'
import { criarServico } from '@/server/services/servicos'
import { executarOnboarding } from '@/server/services/onboarding'
import { receitaAtribuidaAoCiclo, receitaPorCampanha } from '@/server/services/atribuicao'
import { registrarCampanha } from '@/server/services/crm'

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

async function criarCampanhaEnviada(clientId: string, sentAtIso: string, campaignId: string | null = null) {
  const { error } = await svc.from('messages').insert({
    tenant_id: tenantId,
    client_id: clientId,
    channel: 'whatsapp',
    kind: 'campaign',
    status: 'sent',
    sent_at: sentAtIso,
    campaign_id: campaignId,
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

describe('registrarCampanha + receitaPorCampanha (migration 0054)', () => {
  it(
    'registrarCampanha grava campaign_id na mensagem, e receitaPorCampanha acha o retorno certo',
    async () => {
      const cliente = await criarCliente('Voltou Por Esta Campanha')

      const campanha = await registrarCampanha(svc, tenantId, {
        name: 'Campanha de Teste 0054',
        segment: 'teste',
        template: 'Vem cá!',
        clientIds: [cliente],
      })

      const linhaMensagem = await svc.from('messages').select('campaign_id, sent_at').eq('tenant_id', tenantId).eq('client_id', cliente).eq('kind', 'campaign').single()
      expect(linhaMensagem.data?.campaign_id).toBe(campanha.id)

      await criarAgendamentoConcluido(cliente, new Date(Date.now() + 3_600_000).toISOString(), 12_000)

      const resultado = await receitaPorCampanha(svc, tenantId)
      expect(resultado.get(campanha.id)).toEqual({ bookedCount: 1, revenueCents: 12_000 })
    },
    30_000,
  )

  it(
    'duas campanhas diferentes: cada uma só conta o que ela mesma trouxe, nunca a soma das duas',
    async () => {
      const clienteA = await criarCliente('Cliente da Campanha A')
      const clienteB = await criarCliente('Cliente da Campanha B')

      const campanhaA = await registrarCampanha(svc, tenantId, { name: 'Campanha A 0054', segment: 'teste', template: 'A', clientIds: [clienteA] })
      const campanhaB = await registrarCampanha(svc, tenantId, { name: 'Campanha B 0054', segment: 'teste', template: 'B', clientIds: [clienteB] })

      await criarAgendamentoConcluido(clienteA, new Date(Date.now() + 3_600_000).toISOString(), 5_000)
      await criarAgendamentoConcluido(clienteB, new Date(Date.now() + 3_600_000).toISOString(), 7_000)

      const resultado = await receitaPorCampanha(svc, tenantId)
      expect(resultado.get(campanhaA.id)).toEqual({ bookedCount: 1, revenueCents: 5_000 })
      expect(resultado.get(campanhaB.id)).toEqual({ bookedCount: 1, revenueCents: 7_000 })
    },
    30_000,
  )

  it(
    'campanha sem ninguém voltando ainda não aparece no mapa — o cartão mostra "ninguém voltou" em vez de zero inventado',
    async () => {
      const cliente = await criarCliente('Ainda Não Voltou')
      const campanha = await registrarCampanha(svc, tenantId, { name: 'Campanha Sem Retorno 0054', segment: 'teste', template: 'X', clientIds: [cliente] })

      const resultado = await receitaPorCampanha(svc, tenantId)
      expect(resultado.has(campanha.id)).toBe(false)
    },
    30_000,
  )
})
