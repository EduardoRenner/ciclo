import { randomUUID } from 'node:crypto'

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { POST as confirmarPorToken } from '@/app/api/v1/public/appointments/confirm/[token]/route'
import { criarProfissional } from '@/server/services/profissionais'
import { criarServico } from '@/server/services/servicos'
import { executarOnboarding } from '@/server/services/onboarding'
import { enviarLembretesPendentes, identificarLembretesPendentes } from '@/server/services/lembretes'
import { gerarTokenConfirmacao } from '@/server/services/confirmacao-token'

import type { MessagingProvider } from '@/server/providers/messaging/types'
import type { Database } from '@/server/db/types.gen'

dotenv.config({ path: '.env.local' })

/**
 * F0/item A (`docs/25-ESTRATEGIA-E-EXECUCAO.md`): tenant de demonstração não recebe lembrete.
 * Mockado em vez de usar os slugs reais (`dom-rocha`, `ruivo-barber`) para não depender — nem
 * colidir — com os tenants de demonstração de produção. O que este teste prova é a COSTURA
 * (`identificarLembretesPendentes` chama `ehDemonstracao` e respeita o resultado), não a lista
 * em si — essa já tem seu próprio teste-guarda (`demonstracao-fora-do-indice.test.ts`).
 */
// `Math.random()`, não `randomUUID()`: `vi.hoisted()` roda antes até dos imports serem
// inicializados — referenciar um binding importado aqui estoura "Cannot access before initialization".
const { SLUG_DEMO_DO_TESTE } = vi.hoisted(() => ({
  SLUG_DEMO_DO_TESTE: `demo-teste-${Math.random().toString(36).slice(2, 10)}`,
}))
vi.mock('@/core/tenants/demonstracao', () => ({
  ehDemonstracao: (slug: string) => slug === SLUG_DEMO_DO_TESTE,
}))

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error('O teste de lembretes precisa de NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local.')
}

const svc = createClient<Database>(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })

const TZ = 'America/Sao_Paulo'
let tenantId: string
let professionalId: string
let servicoId: string
const tenants: string[] = []
const usuarios: string[] = []

// Data fixa e distante (nunca "agora" de verdade): o teste não pode depender
// da hora em que roda para decidir se D-1 18h já passou.
/**
 * Todos os testes deste arquivo compartilham o mesmo profissional — sem
 * horários distintos, dois agendamentos de teste colidiriam na constraint de
 * exclusão (a mesma que o TICKET-021 testa). Cada teste pega um `diasOffset`
 * próprio; os horários "agora" andam junto, preservando a relação D-1 18h /
 * D-0 T-3h em torno do novo dia.
 */
function horariosDoTeste(diasOffset: number) {
  const soma = (iso: string) => new Date(new Date(iso).getTime() + diasOffset * 86_400_000).toISOString()
  return {
    startsAt: soma('2026-11-10T14:00:00-03:00'), // terça, 14h
    antesDeTudo: soma('2026-11-01T10:00:00-03:00'),
    depoisDaConfirmacao: soma('2026-11-09T19:00:00-03:00'), // D-1 19h: já passou das 18h
    depoisDoLembrete: soma('2026-11-10T12:00:00-03:00'), // D-0 12h: já passou de T-3h (11h)
  }
}

beforeAll(async () => {
  const marca = randomUUID().slice(0, 8)
  const { data, error } = await svc.auth.admin.createUser({
    email: `lembrete-${marca}@ciclo.test`,
    password: randomUUID(),
    email_confirm: true,
    user_metadata: { full_name: 'Dona dos Lembretes' },
  })
  if (error || !data.user) throw new Error(`seed falhou: ${error?.message}`)
  usuarios.push(data.user.id)

  const { tenant } = await executarOnboarding(svc, {
    userId: data.user.id,
    businessName: 'Salão dos Lembretes',
    vertical: 'aesthetics',
    slug: `lembrete-${marca}`,
    timezone: TZ,
  })
  tenantId = tenant.id
  tenants.push(tenantId)

  const profissional = await criarProfissional(svc, tenantId, {
    displayName: 'Esteticista dos Lembretes',
    compModel: 'owner',
    commissionBps: 0,
    rentCents: 0,
    acceptsOnline: true,
  })
  professionalId = profissional.id

  const servico = await criarServico(svc, tenantId, {
    name: 'Limpeza de Pele',
    description: null,
    durationMin: 60,
    bufferBeforeMin: 0,
    bufferAfterMin: 0,
    priceCents: 8000,
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

async function criarCliente(nome: string, opts: Partial<{ phone: string; whatsappOptOut: boolean }> = {}) {
  const c = await svc
    .from('clients')
    .insert({
      tenant_id: tenantId,
      name: nome,
      phone_e164: opts.phone ?? `+5511${Math.floor(1e8 + Math.random() * 9e7)}`,
      whatsapp_opt_out: opts.whatsappOptOut ?? false,
    })
    .select('id')
    .single()
  return c.data!.id
}

async function criarAgendamento(clientId: string, startsAtIso: string, status: 'pending' | 'confirmed' = 'pending') {
  const ag = await svc
    .from('appointments')
    .insert({
      tenant_id: tenantId,
      client_id: clientId,
      professional_id: professionalId,
      service_id: servicoId,
      starts_at: startsAtIso,
      ends_at: new Date(new Date(startsAtIso).getTime() + 3_600_000).toISOString(),
      status,
      price_cents: 8000,
    })
    .select('id')
    .single()
  return ag.data!.id
}

function providerFalso(): MessagingProvider {
  return {
    sendTemplate: vi.fn(async () => ({ providerId: `wamid.${randomUUID()}` })),
    sendText: vi.fn(),
    parseWebhook: vi.fn(),
  }
}

describe('identificarLembretesPendentes', () => {
  it(
    'nada pendente antes da janela — muito cedo para D-1 18h ou D-0 T-3h',
    async () => {
      const h = horariosDoTeste(0)
      const cliente = await criarCliente('Cedo Demais')
      const agId = await criarAgendamento(cliente, h.startsAt)

      const pendentes = await identificarLembretesPendentes(svc, h.antesDeTudo)
      expect(pendentes.find((p) => p.appointmentId === agId)).toBeUndefined()
    },
    30_000,
  )

  it(
    'acha a confirmação (D-1 18h) depois que esse horário passa',
    async () => {
      const h = horariosDoTeste(1)
      const cliente = await criarCliente('Precisa Confirmar')
      const agId = await criarAgendamento(cliente, h.startsAt)

      const pendentes = await identificarLembretesPendentes(svc, h.depoisDaConfirmacao)
      expect(pendentes.find((p) => p.appointmentId === agId && p.kind === 'confirmation')).toBeTruthy()
    },
    30_000,
  )

  it(
    'cliente com whatsapp_opt_out não aparece',
    async () => {
      const h = horariosDoTeste(2)
      const cliente = await criarCliente('Optou Fora', { whatsappOptOut: true })
      const agId = await criarAgendamento(cliente, h.startsAt)

      const pendentes = await identificarLembretesPendentes(svc, h.depoisDaConfirmacao)
      expect(pendentes.find((p) => p.appointmentId === agId)).toBeUndefined()
    },
    30_000,
  )

  it(
    'depois de enviado, o mesmo lembrete não aparece de novo (nunca duas vezes)',
    async () => {
      const h = horariosDoTeste(3)
      const cliente = await criarCliente('Já Recebeu')
      const agId = await criarAgendamento(cliente, h.startsAt)

      await enviarLembretesPendentes(svc, h.depoisDaConfirmacao, 'https://ciclo.test', providerFalso())

      const pendentes = await identificarLembretesPendentes(svc, h.depoisDaConfirmacao)
      expect(pendentes.find((p) => p.appointmentId === agId && p.kind === 'confirmation')).toBeUndefined()

      const { count } = await svc.from('messages').select('id', { count: 'exact', head: true }).eq('appointment_id', agId)
      expect(count).toBe(1)
    },
    30_000,
  )

  it(
    'tenant de demonstração não aparece — mesmo com agendamento que seria elegível',
    async () => {
      const marca = randomUUID().slice(0, 8)
      const { data: userDemo, error: erroUser } = await svc.auth.admin.createUser({
        email: `lembrete-demo-${marca}@ciclo.test`,
        password: randomUUID(),
        email_confirm: true,
        user_metadata: { full_name: 'Dono da Demonstração' },
      })
      if (erroUser || !userDemo.user) throw new Error(`seed falhou: ${erroUser?.message}`)
      usuarios.push(userDemo.user.id)

      const { tenant: tenantDemo } = await executarOnboarding(svc, {
        userId: userDemo.user.id,
        businessName: 'Salão de Demonstração',
        vertical: 'aesthetics',
        slug: SLUG_DEMO_DO_TESTE,
        timezone: TZ,
      })
      tenants.push(tenantDemo.id)

      const profissionalDemo = await criarProfissional(svc, tenantDemo.id, {
        displayName: 'Esteticista da Demonstração',
        compModel: 'owner',
        commissionBps: 0,
        rentCents: 0,
        acceptsOnline: true,
      })
      const servicoDemo = await criarServico(svc, tenantDemo.id, {
        name: 'Serviço da Demonstração',
        description: null,
        durationMin: 60,
        bufferBeforeMin: 0,
        bufferAfterMin: 0,
        priceCents: 8000,
        pricingModel: 'fixed',
        cycleDays: 21,
        depositBps: 0,
        depositMinCents: 0,
        parallelCapacity: 1,
        requiresAnamnesis: false,
        bookableOnline: true,
        categoryId: null,
      })

      const h = horariosDoTeste(8)
      const clienteDemo = await svc
        .from('clients')
        .insert({ tenant_id: tenantDemo.id, name: 'Cliente da Demonstração', phone_e164: `+5511${Math.floor(1e8 + Math.random() * 9e7)}` })
        .select('id')
        .single()
      const agDemo = await svc
        .from('appointments')
        .insert({
          tenant_id: tenantDemo.id,
          client_id: clienteDemo.data!.id,
          professional_id: profissionalDemo.id,
          service_id: servicoDemo.id,
          starts_at: h.startsAt,
          ends_at: new Date(new Date(h.startsAt).getTime() + 3_600_000).toISOString(),
          status: 'pending',
          price_cents: 8000,
        })
        .select('id')
        .single()

      // Mesma janela que faria QUALQUER outro tenant deste arquivo aparecer (ver o teste
      // "acha a confirmação" acima) — a única diferença é o slug de demonstração.
      const pendentes = await identificarLembretesPendentes(svc, h.depoisDaConfirmacao)
      expect(pendentes.find((p) => p.appointmentId === agDemo.data!.id)).toBeUndefined()
    },
    30_000,
  )

  it(
    'no dia, depois de T-3h, acha o lembrete final — e a confirmação já enviada não repete',
    async () => {
      const h = horariosDoTeste(4)
      const cliente = await criarCliente('Vai Receber os Dois')
      const agId = await criarAgendamento(cliente, h.startsAt)

      await enviarLembretesPendentes(svc, h.depoisDaConfirmacao, 'https://ciclo.test', providerFalso())

      const pendentesNoDia = await identificarLembretesPendentes(svc, h.depoisDoLembrete)
      const doAgendamento = pendentesNoDia.filter((p) => p.appointmentId === agId)

      expect(doAgendamento).toHaveLength(1)
      expect(doAgendamento[0]?.kind).toBe('reminder')
    },
    30_000,
  )
})

describe('enviarLembretesPendentes', () => {
  it(
    'manda pelo provider e grava em messages com o link de confirmação',
    async () => {
      const h = horariosDoTeste(5)
      const cliente = await criarCliente('Vai Receber Lembrete')
      const agId = await criarAgendamento(cliente, h.startsAt)

      const provider = providerFalso()
      const resultado = await enviarLembretesPendentes(svc, h.depoisDaConfirmacao, 'https://ciclo.test', provider)

      expect(resultado.enviados).toBeGreaterThan(0)
      expect(provider.sendTemplate).toHaveBeenCalled()

      const chamada = vi.mocked(provider.sendTemplate).mock.calls.find((c) => c[0].template === 'confirmacao_d1')
      expect(chamada?.[0].params.link).toContain('https://ciclo.test/confirmar/')

      const mensagem = await svc.from('messages').select('status, channel').eq('appointment_id', agId).single()
      expect(mensagem.data).toMatchObject({ status: 'sent', channel: 'whatsapp' })
    },
    30_000,
  )
})

describe('POST /api/v1/public/appointments/confirm/:token — botão sem login', () => {
  function req(token: string): Request {
    return new Request(`https://interno/api/v1/public/appointments/confirm/${token}`, { method: 'POST' })
  }
  function ctx(token: string) {
    return { params: Promise.resolve({ token }) }
  }

  it(
    'token válido confirma o agendamento pending → confirmed',
    async () => {
      const h = horariosDoTeste(6)
      const cliente = await criarCliente('Vai Clicar No Link')
      const agId = await criarAgendamento(cliente, h.startsAt)

      const token = gerarTokenConfirmacao(agId)
      const r = await confirmarPorToken(req(token), ctx(token))
      const json = (await r.json()) as { data: { status: string } }

      expect(r.status).toBe(200)
      expect(json.data.status).toBe('confirmed')

      const linha = await svc.from('appointments').select('status').eq('id', agId).single()
      expect(linha.data?.status).toBe('confirmed')
    },
    30_000,
  )

  it(
    'clicar duas vezes não estoura — a segunda vez só confirma que já está confirmado',
    async () => {
      const h = horariosDoTeste(7)
      const cliente = await criarCliente('Vai Clicar Duas Vezes')
      const agId = await criarAgendamento(cliente, h.startsAt)
      const token = gerarTokenConfirmacao(agId)

      const r1 = await confirmarPorToken(req(token), ctx(token))
      const r2 = await confirmarPorToken(req(token), ctx(token))

      expect(r1.status).toBe(200)
      expect(r2.status).toBe(200)
      const json2 = (await r2.json()) as { data: { status: string } }
      expect(json2.data.status).toBe('confirmed')
    },
    30_000,
  )

  it(
    'token forjado (assinatura errada) é recusado com NOT_FOUND',
    async () => {
      const tokenForjado = Buffer.from(`${randomUUID()}.${Date.now() + 1_000_000}.assinaturafalsa`).toString('base64url')
      const r = await confirmarPorToken(req(tokenForjado), ctx(tokenForjado))
      expect(r.status).toBe(404)
    },
    30_000,
  )
})
