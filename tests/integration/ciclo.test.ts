import { randomUUID } from 'node:crypto'

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { criarProfissional } from '@/server/services/profissionais'
import { criarServico } from '@/server/services/servicos'
import { executarOnboarding } from '@/server/services/onboarding'
import { concluirAgendamento, confirmarAgendamento, criarAgendamento, marcarChegada } from '@/server/services/agendamentos'
import { recomputarCiclosDoTenant } from '@/server/services/ciclo'

import type { Database } from '@/server/db/types.gen'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error('O teste de ciclo precisa de NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local.')
}

const svc = createClient<Database>(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })

const TZ = 'America/Sao_Paulo'
let tenantId: string
let professionalId: string
let servicoId: string
const tenants: string[] = []
const usuarios: string[] = []

beforeAll(async () => {
  const marca = randomUUID().slice(0, 8)
  const { data, error } = await svc.auth.admin.createUser({
    email: `ciclo-${marca}@ciclo.test`,
    password: randomUUID(),
    email_confirm: true,
    user_metadata: { full_name: 'Dona do Ciclo' },
  })
  if (error || !data.user) throw new Error(`seed falhou: ${error?.message}`)
  usuarios.push(data.user.id)

  const { tenant } = await executarOnboarding(svc, {
    userId: data.user.id,
    businessName: 'Salão do Ciclo',
    vertical: 'nails',
    slug: `ciclo-${marca}`,
    timezone: TZ,
  })
  tenantId = tenant.id
  tenants.push(tenantId)

  const profissional = await criarProfissional(svc, tenantId, {
    displayName: 'Manicure do Ciclo',
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
    priceCents: 6000,
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
  const c = await svc.from('clients').insert({ tenant_id: tenantId, name: nome }).select('id').single()
  return c.data!.id
}

async function inserirAtendimentoConcluido(clientId: string, diasAtras: number) {
  const inicio = new Date(Date.now() - diasAtras * 86_400_000)
  const { error } = await svc.from('appointments').insert({
    tenant_id: tenantId,
    client_id: clientId,
    professional_id: professionalId,
    service_id: servicoId,
    starts_at: inicio.toISOString(),
    ends_at: new Date(inicio.getTime() + 3_600_000).toISOString(),
    status: 'done',
    price_cents: 6000,
  })
  if (error) throw error
}

describe('recomputarCiclosDoTenant', () => {
  it(
    'cliente sem retorno esperado ainda vira due/late — grava em client_cycles',
    async () => {
      const cliente = await criarCliente('Sumiu Há 30 Dias')
      await inserirAtendimentoConcluido(cliente, 30) // ciclo padrão 21, 30 dias atrás = 9 dias de atraso → late

      await recomputarCiclosDoTenant(svc, tenantId, TZ, new Date().toISOString().slice(0, 10))

      const linha = await svc
        .from('client_cycles')
        .select('state, late_days, value_at_risk_cents')
        .eq('tenant_id', tenantId)
        .eq('client_id', cliente)
        .single()
      expect(linha.data?.state).toBe('late')
      // §5.3: preço do serviço (6000 centavos) × probabilidade de 'late' (0,65), arredondado para baixo.
      expect(linha.data?.value_at_risk_cents).toBe(3900)
    },
    30_000,
  )

  it(
    'cliente com agendamento futuro fica on_track mesmo atrasadíssimo',
    async () => {
      const cliente = await criarCliente('Atrasadíssima Mas Já Remarcou')
      await inserirAtendimentoConcluido(cliente, 90)

      await criarAgendamento(
        svc,
        tenantId,
        TZ,
        null,
        {
          clientId: cliente,
          serviceId: servicoId,
          professionalId,
          startsAt: new Date(Date.now() + 5 * 86_400_000).toISOString(),
          origin: 'app',
        },
        {},
      )

      await recomputarCiclosDoTenant(svc, tenantId, TZ, new Date().toISOString().slice(0, 10))

      const linha = await svc.from('client_cycles').select('state').eq('tenant_id', tenantId).eq('client_id', cliente).single()
      expect(linha.data?.state).toBe('on_track')
    },
    30_000,
  )

  it(
    'idempotente: rodar duas vezes seguidas dá o mesmo resultado, sem duplicar linha',
    async () => {
      const cliente = await criarCliente('Roda Duas Vezes')
      await inserirAtendimentoConcluido(cliente, 15)

      const hoje = new Date().toISOString().slice(0, 10)
      await recomputarCiclosDoTenant(svc, tenantId, TZ, hoje)
      await recomputarCiclosDoTenant(svc, tenantId, TZ, hoje)

      const { count } = await svc
        .from('client_cycles')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('client_id', cliente)
      expect(count).toBe(1)
    },
    30_000,
  )

  it(
    'concluir um atendimento recalcula o ciclo daquela combinação em tempo real, sem esperar o job',
    async () => {
      const cliente = await criarCliente('Recalcula na Hora')

      const ag = await criarAgendamento(
        svc,
        tenantId,
        TZ,
        null,
        {
          clientId: cliente,
          serviceId: servicoId,
          professionalId,
          startsAt: new Date(Date.now() + 3_600_000).toISOString(),
          origin: 'app',
        },
        {},
      )
      await confirmarAgendamento(svc, tenantId, ag.id)
      await marcarChegada(svc, tenantId, ag.id)
      await concluirAgendamento(svc, tenantId, ag.id)

      // Sem chamar recomputarCiclosDoTenant — só concluir já deve ter criado a linha.
      const linha = await svc.from('client_cycles').select('state').eq('tenant_id', tenantId).eq('client_id', cliente).single()
      expect(linha.data).not.toBeNull()
    },
    30_000,
  )
})

describe('recomputarCiclosDoTenant — performance', () => {
  it(
    '10 mil clientes recalculam em menos de 60s',
    async () => {
      const TOTAL = 10_000
      const clientes = Array.from({ length: TOTAL }, (_, i) => ({ tenant_id: tenantId, name: `Cliente Perf ${i}` }))

      const idsClientes: string[] = []
      for (let inicio = 0; inicio < TOTAL; inicio += 1000) {
        const lote = clientes.slice(inicio, inicio + 1000)
        const { data, error } = await svc.from('clients').insert(lote).select('id')
        if (error) throw error
        idsClientes.push(...data.map((c) => c.id))
      }

      const inicioBase = Date.now() - 15 * 86_400_000
      const agendamentos = idsClientes.map((clientId, i) => ({
        tenant_id: tenantId,
        client_id: clientId,
        professional_id: professionalId,
        service_id: servicoId,
        starts_at: new Date(inicioBase - i * 1000).toISOString(),
        ends_at: new Date(inicioBase - i * 1000 + 3_600_000).toISOString(),
        status: 'done' as const,
        price_cents: 6000,
      }))
      for (let inicio = 0; inicio < agendamentos.length; inicio += 1000) {
        const { error } = await svc.from('appointments').insert(agendamentos.slice(inicio, inicio + 1000))
        if (error) throw error
      }

      const t0 = Date.now()
      const processados = await recomputarCiclosDoTenant(svc, tenantId, TZ, new Date().toISOString().slice(0, 10))
      const duracao = Date.now() - t0

      expect(processados).toBeGreaterThanOrEqual(TOTAL)
      expect(duracao).toBeLessThan(60_000)
    },
    120_000,
  )
})
