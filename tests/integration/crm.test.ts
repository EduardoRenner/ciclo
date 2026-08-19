import { randomUUID } from 'node:crypto'

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { criarCliente } from '@/server/services/clientes'
import { EsquemaCampanha, fichaDoCliente, painelDaCarteira, publicoDaCampanha, registrarCampanha } from '@/server/services/crm'
import { listarModelos, MODELOS_PADRAO } from '@/server/services/mensagens-prontas'
import { executarOnboarding } from '@/server/services/onboarding'
import { criarProfissional } from '@/server/services/profissionais'
import { criarServico } from '@/server/services/servicos'

import type { Database } from '@/server/db/types.gen'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) throw new Error('CRM precisa de NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.')

const svc = createClient<Database>(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })

let tenantId: string
let userId: string
let servicoId: string
let profissionalId: string
let fielId: string
let optOutId: string
let semOptInId: string

beforeAll(async () => {
  const marca = randomUUID().slice(0, 8)
  const { data, error } = await svc.auth.admin.createUser({
    email: `crm-${marca}@ciclo.test`,
    password: randomUUID(),
    email_confirm: true,
    user_metadata: { full_name: 'Dono do CRM' },
  })
  if (error || !data.user) throw new Error(`seed falhou: ${error?.message}`)
  userId = data.user.id

  const { tenant } = await executarOnboarding(svc, {
    userId,
    businessName: 'Barbearia de Teste',
    vertical: 'barber',
    slug: `crm-${marca}`,
    timezone: 'America/Sao_Paulo',
  })
  tenantId = tenant.id

  const profissional = await criarProfissional(svc, tenantId, {
    displayName: 'Barbeiro',
    compModel: 'owner',
    commissionBps: 0,
    rentCents: 0,
    acceptsOnline: true,
  })
  profissionalId = profissional.id

  const servico = await criarServico(svc, tenantId, {
    name: 'Corte de Teste',
    description: null,
    durationMin: 30,
    bufferBeforeMin: 0,
    bufferAfterMin: 0,
    priceCents: 5000,
    cycleDays: 21,
    depositBps: 0,
    depositMinCents: 0,
    parallelCapacity: 1,
    requiresAnamnesis: false,
    bookableOnline: true,
    categoryId: null,
  })
  servicoId = servico.id

  const fiel = await criarCliente(svc, tenantId, {
    name: 'Cliente Fiel',
    phone: '11988770001',
    tags: ['fiel'],
    marketingOptIn: true,
    preferences: { maquina: '2', barba: 'navalha' },
  })
  fielId = fiel.id

  const optOut = await criarCliente(svc, tenantId, {
    name: 'Pediu Para Parar',
    phone: '11988770002',
    tags: [],
    marketingOptIn: true,
  })
  optOutId = optOut.id
  await svc.from('clients').update({ whatsapp_opt_out: true }).eq('id', optOutId)

  const semOptIn = await criarCliente(svc, tenantId, {
    name: 'Nunca Autorizou',
    phone: '11988770003',
    tags: [],
    marketingOptIn: false,
  })
  semOptInId = semOptIn.id

  // Dois atendimentos concluídos do cliente fiel, para a ficha ter métrica e histórico.
  const base = new Date()
  base.setUTCDate(base.getUTCDate() - 30)
  for (const diasAtras of [30, 10]) {
    const inicio = new Date()
    inicio.setUTCDate(inicio.getUTCDate() - diasAtras)
    inicio.setUTCHours(13, 0, 0, 0)
    const { error: erroAg } = await svc.from('appointments').insert({
      tenant_id: tenantId,
      client_id: fielId,
      professional_id: profissionalId,
      service_id: servicoId,
      starts_at: inicio.toISOString(),
      ends_at: new Date(inicio.getTime() + 30 * 60_000).toISOString(),
      status: 'done',
      price_cents: 5000,
      completed_at: inicio.toISOString(),
    })
    if (erroAg) throw new Error(`seed de agendamento falhou: ${erroAg.message}`)
  }

  // `visits_count`/`ltv_cents` são mantidos por job; aqui o teste escreve o que o job escreveria.
  await svc.from('clients').update({ visits_count: 2, ltv_cents: 10_000 }).eq('id', fielId)
}, 90_000)

afterAll(async () => {
  await svc.from('tenants').delete().eq('id', tenantId)
  await svc.auth.admin.deleteUser(userId)
}, 60_000)

describe('fichaDoCliente', () => {
  it(
    'devolve métricas, preferências e histórico juntos',
    async () => {
      const ficha = await fichaDoCliente(svc, tenantId, fielId)

      expect(ficha.cliente.name).toBe('Cliente Fiel')
      expect(ficha.cliente.preferences).toEqual({ maquina: '2', barba: 'navalha' })
      expect(ficha.metricas.visitas).toBe(2)
      expect(ficha.metricas.ltvCents).toBe(10_000)
      // Ticket médio é derivado, não guardado: 10000 / 2.
      expect(ficha.metricas.ticketMedioCents).toBe(5_000)
      expect(ficha.historico).toHaveLength(2)
      expect(ficha.historico[0]!.serviceName).toBe('Corte de Teste')
    },
    30_000,
  )

  it(
    'cliente que nunca veio não quebra o ticket médio com divisão por zero',
    async () => {
      const ficha = await fichaDoCliente(svc, tenantId, semOptInId)
      expect(ficha.metricas.visitas).toBe(0)
      expect(ficha.metricas.ticketMedioCents).toBe(0)
      expect(ficha.historico).toEqual([])
    },
    30_000,
  )

  it(
    'id de outro tenant devolve NOT_FOUND, não a ficha alheia',
    async () => {
      const erro = await fichaDoCliente(svc, randomUUID(), fielId).catch((e: unknown) => e)
      expect(erro).toMatchObject({ code: 'NOT_FOUND' })
    },
    30_000,
  )
})

describe('publicoDaCampanha', () => {
  it(
    'nunca inclui quem pediu para não receber nem quem não deu opt-in de marketing',
    async () => {
      const alvos = await publicoDaCampanha(svc, tenantId, 'todos')
      const ids = alvos.map((a) => a.id)

      expect(ids).toContain(fielId)
      expect(ids).not.toContain(optOutId)
      expect(ids).not.toContain(semOptInId)
    },
    30_000,
  )

  it(
    'segmento sem ninguém devolve lista vazia em vez de trazer a carteira toda',
    async () => {
      // Ninguém está atrasado neste tenant recém-criado (nem há `client_cycles`).
      expect(await publicoDaCampanha(svc, tenantId, 'sumidos')).toEqual([])
    },
    30_000,
  )
})

describe('registrarCampanha', () => {
  it(
    'grava a campanha e uma mensagem por pessoa — é o que a atribuição de receita procura',
    async () => {
      const campanha = await registrarCampanha(svc, tenantId, {
        name: 'Teste de campanha',
        segment: 'todos',
        template: 'Agradecer',
        clientIds: [fielId],
      })

      expect(campanha.sent_count).toBe(1)
      // Conversão nasce zerada: quem preenche é a atribuição, não quem disparou.
      expect(campanha.booked_count).toBe(0)
      expect(campanha.revenue_cents).toBe(0)

      const { data: mensagens } = await svc
        .from('messages')
        .select('client_id, kind, status')
        .eq('tenant_id', tenantId)
        .eq('kind', 'campaign')

      expect(mensagens).toHaveLength(1)
      expect(mensagens![0]).toMatchObject({ client_id: fielId, kind: 'campaign', status: 'sent' })
    },
    30_000,
  )

  it('campanha sem ninguém é barrada no esquema, antes de virar linha no banco', () => {
    const vazia = EsquemaCampanha.safeParse({ name: 'Vazia', segment: 'todos', template: 'x', clientIds: [] })
    expect(vazia.success).toBe(false)

    const comGente = EsquemaCampanha.safeParse({
      name: 'Cheia',
      segment: 'todos',
      template: 'x',
      clientIds: [randomUUID()],
    })
    expect(comGente.success).toBe(true)
  })
})

describe('painelDaCarteira', () => {
  it(
    'conta a carteira e calcula ticket médio e taxa de retorno pela view agregada',
    async () => {
      const painel = await painelDaCarteira(svc, tenantId)

      // O onboarding não cria cliente; os três são os do seed deste teste.
      expect(painel.total).toBe(3)
      expect(painel.novosNoMes).toBe(3)
      // Só o fiel tem visita: 10000 centavos / 2 visitas.
      expect(painel.ticketMedioCents).toBe(5_000)
      // 1 de 3 clientes voltou mais de uma vez = 3333 bps.
      expect(painel.taxaRetornoBps).toBe(3_333)
    },
    30_000,
  )
})

describe('listarModelos', () => {
  it(
    'na primeira vez semeia a biblioteca padrão, e não duplica na segunda',
    async () => {
      const primeira = await listarModelos(svc, tenantId)
      expect(primeira).toHaveLength(MODELOS_PADRAO.length)

      const segunda = await listarModelos(svc, tenantId)
      expect(segunda).toHaveLength(MODELOS_PADRAO.length)
      expect(segunda.map((m) => m.slug).sort()).toEqual(primeira.map((m) => m.slug).sort())
    },
    30_000,
  )
})
