import { randomUUID } from 'node:crypto'

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { criarAgendamento } from '@/server/services/agendamentos'
import { criarProfissional } from '@/server/services/profissionais'
import { criarServico } from '@/server/services/servicos'
import { executarOnboarding } from '@/server/services/onboarding'
import { entrarNaLista, notificarProximoDaLista, reivindicarEncaixe } from '@/server/services/lista-espera'

import type { MessagingProvider } from '@/server/providers/messaging/types'
import type { Database } from '@/server/db/types.gen'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error('O teste de lista de espera precisa de NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local.')
}

const svc = createClient<Database>(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })

const TZ = 'America/Sao_Paulo'
let tenantId: string
let professionalId: string
let servicoId: string
const tenants: string[] = []
const usuarios: string[] = []

function proximaTerca(): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + 1)
  while (d.getUTCDay() !== 2) d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}
const DIA = proximaTerca()
function horario(hhmm: string): string {
  return `${DIA}T${hhmm}:00-03:00`
}

beforeAll(async () => {
  const marca = randomUUID().slice(0, 8)
  const { data, error } = await svc.auth.admin.createUser({
    email: `waitlist-${marca}@ciclo.test`,
    password: randomUUID(),
    email_confirm: true,
    user_metadata: { full_name: 'Dona da Lista' },
  })
  if (error || !data.user) throw new Error(`seed falhou: ${error?.message}`)
  usuarios.push(data.user.id)

  const { tenant } = await executarOnboarding(svc, {
    userId: data.user.id,
    businessName: 'Salão da Lista de Espera',
    vertical: 'nails',
    slug: `waitlist-${marca}`,
    timezone: TZ,
  })
  tenantId = tenant.id
  tenants.push(tenantId)

  const profissional = await criarProfissional(svc, tenantId, {
    displayName: 'Manicure da Lista',
    compModel: 'owner',
    commissionBps: 0,
    rentCents: 0,
    acceptsOnline: true,
  })
  professionalId = profissional.id

  const servico = await criarServico(svc, tenantId, {
    name: 'Esmaltação em Gel',
    description: null,
    durationMin: 60,
    bufferBeforeMin: 0,
    bufferAfterMin: 0,
    priceCents: 7000,
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

async function criarCliente(nome: string, opts: Partial<{ optOut: boolean }> = {}) {
  const c = await svc
    .from('clients')
    .insert({
      tenant_id: tenantId,
      name: nome,
      phone_e164: `+5511${Math.floor(1e8 + Math.random() * 9e7)}`,
      whatsapp_opt_out: opts.optOut ?? false,
    })
    .select('id')
    .single()
  return c.data!.id
}

function providerFalso(): MessagingProvider {
  return {
    sendTemplate: vi.fn(async () => ({ providerId: `wamid.${randomUUID()}` })),
    sendText: vi.fn(),
    parseWebhook: vi.fn(),
  }
}

describe('lista de espera', () => {
  it(
    'avisa só a primeira pessoa da fila, na ordem de entrada',
    async () => {
      const cliente1 = await criarCliente('Primeira na Fila')
      const cliente2 = await criarCliente('Segunda na Fila')

      await entrarNaLista(svc, tenantId, { clientId: cliente1, serviceId: servicoId })
      await new Promise((r) => setTimeout(r, 10)) // garante created_at distinto
      await entrarNaLista(svc, tenantId, { clientId: cliente2, serviceId: servicoId })

      const provider = providerFalso()
      const resultado = await notificarProximoDaLista(
        svc,
        tenantId,
        { serviceId: servicoId, professionalId, startsAt: horario('10:00'), timezone: TZ },
        'https://ciclo.test',
        provider,
      )

      expect(resultado.notificado).toBe(true)
      expect(provider.sendTemplate).toHaveBeenCalledTimes(1)

      const notificado = await svc.from('waitlist').select('client_id, notified_at').eq('id', resultado.waitlistId!).single()
      expect(notificado.data?.client_id).toBe(cliente1)
      expect(notificado.data?.notified_at).not.toBeNull()

      const segunda = await svc.from('waitlist').select('notified_at').eq('client_id', cliente2).single()
      expect(segunda.data?.notified_at).toBeNull()
    },
    30_000,
  )

  it(
    'cliente com whatsapp_opt_out não é elegível',
    async () => {
      const optOut = await criarCliente('Optou Fora da Lista', { optOut: true })
      await entrarNaLista(svc, tenantId, { clientId: optOut, serviceId: servicoId })

      const provider = providerFalso()
      const resultado = await notificarProximoDaLista(
        svc,
        tenantId,
        { serviceId: servicoId, professionalId, startsAt: horario('11:00'), timezone: TZ },
        'https://ciclo.test',
        provider,
      )

      // Pode ter notificado outra pessoa elegível de teste anterior, mas nunca essa.
      if (resultado.waitlistId) {
        const linha = await svc.from('waitlist').select('client_id').eq('id', resultado.waitlistId).single()
        expect(linha.data?.client_id).not.toBe(optOut)
      }
    },
    30_000,
  )

  it(
    'profissional preferido diferente do horário liberado não é elegível',
    async () => {
      const outroProfissional = await criarProfissional(svc, tenantId, {
        displayName: 'Outra Manicure',
        compModel: 'owner',
        commissionBps: 0,
        rentCents: 0,
        acceptsOnline: true,
      })

      const cliente = await criarCliente('Só Com a Outra')
      await entrarNaLista(svc, tenantId, { clientId: cliente, serviceId: servicoId, professionalId: outroProfissional.id })

      const provider = providerFalso()
      const resultado = await notificarProximoDaLista(
        svc,
        tenantId,
        { serviceId: servicoId, professionalId, startsAt: horario('12:00'), timezone: TZ }, // profissional ERRADO pra essa cliente
        'https://ciclo.test',
        provider,
      )

      if (resultado.waitlistId) {
        const linha = await svc.from('waitlist').select('client_id').eq('id', resultado.waitlistId).single()
        expect(linha.data?.client_id).not.toBe(cliente)
      }
    },
    30_000,
  )

  it(
    'reivindicar pelo link cria o agendamento e marca a entrada como atendida',
    async () => {
      const cliente = await criarCliente('Vai Reivindicar')
      await entrarNaLista(svc, tenantId, { clientId: cliente, serviceId: servicoId })

      const provider = providerFalso()
      await notificarProximoDaLista(
        svc,
        tenantId,
        { serviceId: servicoId, professionalId, startsAt: horario('13:00'), timezone: TZ },
        'https://ciclo.test',
        provider,
      )

      const chamada = vi.mocked(provider.sendTemplate).mock.calls.at(-1)
      const link = chamada![0].params.link!
      const token = link.split('/lista-espera/')[1]!

      const agendamento = await reivindicarEncaixe(svc, token)
      expect(agendamento.status).toBe('pending')

      const naAgenda = await svc.from('appointments').select('id, origin').eq('id', agendamento.id).single()
      expect(naAgenda.data?.origin).toBe('waitlist')
    },
    30_000,
  )

  it(
    'reivindicar duas vezes o mesmo link falha na segunda — o encaixe já foi usado',
    async () => {
      const cliente = await criarCliente('Vai Tentar Duas Vezes')
      await entrarNaLista(svc, tenantId, { clientId: cliente, serviceId: servicoId })

      const provider = providerFalso()
      await notificarProximoDaLista(
        svc,
        tenantId,
        { serviceId: servicoId, professionalId, startsAt: horario('15:00'), timezone: TZ },
        'https://ciclo.test',
        provider,
      )

      const link = vi.mocked(provider.sendTemplate).mock.calls.at(-1)![0].params.link!
      const token = link.split('/lista-espera/')[1]!

      await reivindicarEncaixe(svc, token)
      const erro = await reivindicarEncaixe(svc, token).catch((e: unknown) => e)
      expect(erro).toMatchObject({ code: 'NOT_FOUND' })
    },
    30_000,
  )

  it(
    'cancelar um agendamento real avisa a lista de espera daquele serviço',
    async () => {
      const clienteDoAgendamento = await criarCliente('Vai Cancelar')
      const clienteDaFila = await criarCliente('Está na Fila Esperando')

      const ag = await criarAgendamento(
        svc,
        tenantId,
        TZ,
        null,
        {
          clientId: clienteDoAgendamento,
          serviceId: servicoId,
          professionalId,
          startsAt: horario('17:00'),
          origin: 'app',
        },
        {},
      )

      await entrarNaLista(svc, tenantId, { clientId: clienteDaFila, serviceId: servicoId })

      // Simula o que a rota DELETE faz depois de cancelar: avisa a lista
      // para o horário que acabou de esvaziar.
      const provider = providerFalso()
      const resultado = await notificarProximoDaLista(
        svc,
        tenantId,
        { serviceId: servicoId, professionalId, startsAt: ag.starts_at, timezone: TZ },
        'https://ciclo.test',
        provider,
      )

      expect(resultado.notificado).toBe(true)
      const avisado = await svc.from('waitlist').select('client_id').eq('id', resultado.waitlistId!).single()
      expect(avisado.data?.client_id).toBe(clienteDaFila)
    },
    30_000,
  )
})
