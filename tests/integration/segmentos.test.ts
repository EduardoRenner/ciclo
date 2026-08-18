import { randomUUID } from 'node:crypto'

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { criarProfissional } from '@/server/services/profissionais'
import { criarServico } from '@/server/services/servicos'
import { executarOnboarding } from '@/server/services/onboarding'
import { recalcularSegmentosDoTenant, listarClientesPorSegmento } from '@/server/services/segmentos'

import type { Database } from '@/server/db/types.gen'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error('O teste de segmentos precisa de NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local.')
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
    email: `segmentos-${marca}@ciclo.test`,
    password: randomUUID(),
    email_confirm: true,
    user_metadata: { full_name: 'Dona dos Segmentos' },
  })
  if (error || !data.user) throw new Error(`seed falhou: ${error?.message}`)
  usuarios.push(data.user.id)

  const { tenant } = await executarOnboarding(svc, {
    userId: data.user.id,
    businessName: 'Salão dos Segmentos',
    vertical: 'nails',
    slug: `segmentos-${marca}`,
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

async function criarCliente(nome: string, birthDate: string | null = null) {
  contadorTelefone++
  const telefone = `+551198844${String(contadorTelefone).padStart(4, '0')}`
  const cliente = await svc.from('clients').insert({ tenant_id: tenantId, name: nome, phone_e164: telefone, birth_date: birthDate }).select('id').single()
  if (cliente.error) throw cliente.error
  return cliente.data.id
}

async function criarAgendamentoConcluido(clientId: string, diasAtras: number, priceCents: number) {
  const inicio = new Date(Date.now() - diasAtras * 86_400_000)
  const { error } = await svc.from('appointments').insert({
    tenant_id: tenantId,
    client_id: clientId,
    professional_id: professionalId,
    service_id: servicoId,
    starts_at: inicio.toISOString(),
    ends_at: new Date(inicio.getTime() + 3_600_000).toISOString(),
    status: 'done',
    price_cents: priceCents,
  })
  if (error) throw error
}

async function criarAgendamentoFuturo(clientId: string) {
  const inicio = new Date(Date.now() + 5 * 86_400_000)
  const { error } = await svc.from('appointments').insert({
    tenant_id: tenantId,
    client_id: clientId,
    professional_id: professionalId,
    service_id: servicoId,
    starts_at: inicio.toISOString(),
    ends_at: new Date(inicio.getTime() + 3_600_000).toISOString(),
    status: 'pending',
    price_cents: 10_000,
  })
  if (error) throw error
}

describe('recalcularSegmentosDoTenant + listarClientesPorSegmento', () => {
  it(
    'preenche visits_count/ltv_cents/last_visit_at a partir de atendimentos concluídos',
    async () => {
      const cliente = await criarCliente('Cliente Fiel')
      await criarAgendamentoConcluido(cliente, 40, 10_000)
      await criarAgendamentoConcluido(cliente, 10, 10_000)

      await recalcularSegmentosDoTenant(svc, tenantId)

      const linha = await svc.from('clients').select('visits_count, ltv_cents, last_visit_at').eq('id', cliente).single()
      expect(linha.data?.visits_count).toBe(2)
      expect(linha.data?.ltv_cents).toBe(20_000)
      expect(linha.data?.last_visit_at).not.toBeNull()
    },
    30_000,
  )

  it(
    'primeira_visita_sem_retorno: só quem tem exatamente 1 visita e nenhum agendamento futuro',
    async () => {
      const semRetorno = await criarCliente('Veio Uma Vez Só')
      await criarAgendamentoConcluido(semRetorno, 20, 10_000)

      const comFuturoAgendado = await criarCliente('Veio Uma Vez Mas Já Remarcou')
      await criarAgendamentoConcluido(comFuturoAgendado, 20, 10_000)
      await criarAgendamentoFuturo(comFuturoAgendado)

      const comDuasVisitas = await criarCliente('Já Voltou De Verdade')
      await criarAgendamentoConcluido(comDuasVisitas, 40, 10_000)
      await criarAgendamentoConcluido(comDuasVisitas, 10, 10_000)

      await recalcularSegmentosDoTenant(svc, tenantId)

      const lista = await listarClientesPorSegmento(svc, tenantId, 'primeira_visita_sem_retorno')
      const ids = lista.map((c) => c.id)
      expect(ids).toContain(semRetorno)
      expect(ids).not.toContain(comFuturoAgendado)
      expect(ids).not.toContain(comDuasVisitas)
    },
    30_000,
  )

  it(
    'aniversariante: nasceu neste mês, em qualquer ano',
    async () => {
      const mesAtual = String(new Date().getMonth() + 1).padStart(2, '0')
      const aniversariante = await criarCliente('Faz Aniver Este Mês', `1990-${mesAtual}-15`)
      const naoAniversariante = await criarCliente('Não Faz Aniver Agora', '1990-01-01')

      await recalcularSegmentosDoTenant(svc, tenantId)

      const lista = await listarClientesPorSegmento(svc, tenantId, 'aniversariante')
      const ids = lista.map((c) => c.id)
      expect(ids).toContain(aniversariante)
      if (mesAtual !== '01') expect(ids).not.toContain(naoAniversariante)
    },
    30_000,
  )

  it(
    'ticket_alto: quem tem LTV no topo do tenant',
    async () => {
      const ticketBaixo = await criarCliente('Gasta Pouco')
      await criarAgendamentoConcluido(ticketBaixo, 5, 1_000)

      const ticketAlto = await criarCliente('Gasta Muito')
      for (let i = 0; i < 5; i++) await criarAgendamentoConcluido(ticketAlto, 5 + i, 10_000)

      await recalcularSegmentosDoTenant(svc, tenantId)

      const lista = await listarClientesPorSegmento(svc, tenantId, 'ticket_alto')
      const ids = lista.map((c) => c.id)
      expect(ids).toContain(ticketAlto)
    },
    30_000,
  )
})
