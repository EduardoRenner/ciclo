import { randomUUID } from 'node:crypto'

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { criarAgendamento } from '@/server/services/agendamentos'
import { gerarTokenConfirmacao } from '@/server/services/confirmacao-token'
import { criarProfissional } from '@/server/services/profissionais'
import { definirExpediente } from '@/server/services/expediente'
import { criarServico } from '@/server/services/servicos'
import { executarOnboarding } from '@/server/services/onboarding'

import { POST as cancelarPorToken } from '@/app/api/v1/public/appointments/cancel/[token]/route'
import { POST as confirmarPorToken } from '@/app/api/v1/public/appointments/confirm/[token]/route'

import type { Database } from '@/server/db/types.gen'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error('O teste de confirmação/cancelamento precisa de NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local.')
}

const svc = createClient<Database>(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })

const TZ = 'America/Sao_Paulo'
let tenantId: string
let slug: string
let professionalId: string
let servicoId: string
let clientId: string
const tenants: string[] = []
const usuarios: string[] = []

function proximaTerca(): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + 1)
  while (d.getUTCDay() !== 2) d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}
const DIA = proximaTerca()

beforeAll(async () => {
  const marca = randomUUID().slice(0, 8)
  const { data, error } = await svc.auth.admin.createUser({
    email: `conf-${marca}@ciclo.test`,
    password: randomUUID(),
    email_confirm: true,
    user_metadata: { full_name: 'Dona da Confirmação' },
  })
  if (error || !data.user) throw new Error(`seed falhou: ${error?.message}`)
  usuarios.push(data.user.id)

  slug = `conf-${marca}`
  const { tenant } = await executarOnboarding(svc, {
    userId: data.user.id,
    businessName: 'Salão da Confirmação',
    vertical: 'barber',
    slug,
    timezone: TZ,
  })
  tenantId = tenant.id
  tenants.push(tenantId)

  const profissional = await criarProfissional(svc, tenantId, {
    displayName: 'Barbeiro de Teste',
    compModel: 'owner',
    commissionBps: 0,
    rentCents: 0,
    acceptsOnline: true,
  })
  professionalId = profissional.id

  const servico = await criarServico(svc, tenantId, {
    name: 'Corte de Teste',
    description: null,
    durationMin: 30,
    bufferBeforeMin: 0,
    bufferAfterMin: 0,
    priceCents: 4000,
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

  await definirExpediente(svc, tenantId, {
    professionalId,
    blocos: [{ weekday: 2, opensAt: '09:00', closesAt: '18:00' }],
  })

  const cliente = await svc.from('clients').insert({ tenant_id: tenantId, name: 'Cliente do Token', phone_e164: null }).select('id').single()
  clientId = cliente.data!.id
}, 60_000)

afterAll(async () => {
  for (const t of tenants) await svc.from('tenants').delete().eq('id', t)
  for (const u of usuarios) await svc.auth.admin.deleteUser(u)
}, 60_000)

async function novoAgendamento(hhmm: string) {
  return criarAgendamento(
    svc,
    tenantId,
    TZ,
    null,
    {
      clientId,
      serviceId: servicoId,
      professionalId,
      startsAt: `${DIA}T${hhmm}:00-03:00`,
      origin: 'app',
      note: null,
    },
    {},
  )
}

function req(token: string, path: 'confirm' | 'cancel'): Request {
  return new Request(`https://interno/api/v1/public/appointments/${path}/${token}`, { method: 'POST' })
}
function ctx(token: string) {
  return { params: Promise.resolve({ token }) }
}

describe('cancelar por token público (G12, docs/09-PLATAFORMA.md)', () => {
  it(
    'cancela um agendamento pending e devolve o slug do tenant pra remarcar',
    async () => {
      const agendamento = await novoAgendamento('09:00')
      const token = gerarTokenConfirmacao(agendamento.id)

      const r = await cancelarPorToken(req(token, 'cancel'), ctx(token))
      expect(r.status).toBe(200)
      const json = (await r.json()) as { data: { status: string; slug: string | null } }
      expect(json.data.status).toBe('canceled')
      expect(json.data.slug).toBe(slug)

      const linha = await svc.from('appointments').select('status, canceled_by').eq('id', agendamento.id).single()
      expect(linha.data).toMatchObject({ status: 'canceled', canceled_by: 'client' })
    },
    30_000,
  )

  it(
    'cancela um agendamento confirmed também — não só pending',
    async () => {
      const agendamento = await novoAgendamento('10:00')
      await svc.from('appointments').update({ status: 'confirmed', confirmed_at: new Date().toISOString() }).eq('id', agendamento.id)

      const token = gerarTokenConfirmacao(agendamento.id)
      const r = await cancelarPorToken(req(token, 'cancel'), ctx(token))
      expect(r.status).toBe(200)
      const json = (await r.json()) as { data: { status: string } }
      expect(json.data.status).toBe('canceled')
    },
    30_000,
  )

  it(
    'clicar duas vezes no link não quebra — devolve o mesmo estado, sem erro',
    async () => {
      const agendamento = await novoAgendamento('11:00')
      const token = gerarTokenConfirmacao(agendamento.id)

      const r1 = await cancelarPorToken(req(token, 'cancel'), ctx(token))
      expect(r1.status).toBe(200)

      const r2 = await cancelarPorToken(req(token, 'cancel'), ctx(token))
      expect(r2.status).toBe(200)
      const json2 = (await r2.json()) as { data: { status: string } }
      expect(json2.data.status).toBe('canceled')
    },
    30_000,
  )

  it(
    'agendamento já concluído não pode ser cancelado pelo link — responde 200 com o status real, não erro',
    async () => {
      const agendamento = await novoAgendamento('12:00')
      await svc.from('appointments').update({ status: 'done', completed_at: new Date().toISOString() }).eq('id', agendamento.id)

      const token = gerarTokenConfirmacao(agendamento.id)
      const r = await cancelarPorToken(req(token, 'cancel'), ctx(token))
      expect(r.status).toBe(200)
      const json = (await r.json()) as { data: { status: string } }
      expect(json.data.status).toBe('done')

      // E não virou 'canceled' no banco por engano.
      const linha = await svc.from('appointments').select('status').eq('id', agendamento.id).single()
      expect(linha.data?.status).toBe('done')
    },
    30_000,
  )

  it(
    'token inválido/adulterado é recusado, tanto pra confirmar quanto pra cancelar',
    async () => {
      const rCancel = await cancelarPorToken(req('token-forjado-xyz', 'cancel'), ctx('token-forjado-xyz'))
      expect(rCancel.status).toBe(404)

      const rConfirm = await confirmarPorToken(req('token-forjado-xyz', 'confirm'), ctx('token-forjado-xyz'))
      expect(rConfirm.status).toBe(404)
    },
    30_000,
  )
})
