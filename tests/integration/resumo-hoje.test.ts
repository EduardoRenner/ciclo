import { randomUUID } from 'node:crypto'

import { Temporal } from '@js-temporal/polyfill'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { criarProfissional } from '@/server/services/profissionais'
import { criarServico } from '@/server/services/servicos'
import { executarOnboarding } from '@/server/services/onboarding'
import { resumoDeHoje } from '@/server/services/resumo-hoje'

import type { Database } from '@/server/db/types.gen'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error('O teste de resumo do dia precisa de NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local.')
}

const svc = createClient<Database>(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })

const TZ = 'America/Sao_Paulo'
let tenantId: string
let professionalId: string
let servicoId: string
let clientId: string
const tenants: string[] = []
const usuarios: string[] = []

beforeAll(async () => {
  const marca = randomUUID().slice(0, 8)
  const { data, error } = await svc.auth.admin.createUser({
    email: `hoje-${marca}@ciclo.test`,
    password: randomUUID(),
    email_confirm: true,
    user_metadata: { full_name: 'Dona do Hoje' },
  })
  if (error || !data.user) throw new Error(`seed falhou: ${error?.message}`)
  usuarios.push(data.user.id)

  const { tenant } = await executarOnboarding(svc, {
    userId: data.user.id,
    businessName: 'Salão do Hoje',
    vertical: 'waxing',
    slug: `hoje-${marca}`,
    timezone: TZ,
  })
  tenantId = tenant.id
  tenants.push(tenantId)

  const profissional = await criarProfissional(svc, tenantId, {
    displayName: 'Esteticista de Teste',
    compModel: 'owner',
    commissionBps: 0,
    rentCents: 0,
    acceptsOnline: true,
  })
  professionalId = profissional.id

  const servico = await criarServico(svc, tenantId, {
    name: 'Depilação de Teste',
    description: null,
    durationMin: 30,
    bufferBeforeMin: 0,
    bufferAfterMin: 0,
    priceCents: 4000,
    cycleDays: 21,
    depositBps: 0,
    depositMinCents: 0,
    parallelCapacity: 1,
    requiresAnamnesis: false,
    bookableOnline: true,
    categoryId: null,
  })
  servicoId = servico.id

  const cliente = await svc.from('clients').insert({ tenant_id: tenantId, name: 'Cliente do Hoje', phone_e164: null }).select('id').single()
  clientId = cliente.data!.id
}, 60_000)

afterAll(async () => {
  for (const t of tenants) await svc.from('tenants').delete().eq('id', t)
  for (const u of usuarios) await svc.auth.admin.deleteUser(u)
}, 60_000)

/**
 * Achado ao rodar perto da meia-noite de São Paulo (madrugada real desta
 * sessão): `Date.now() + minutosDeAgora` é aritmética em UTC puro, sem noção
 * de fuso — "-120min de agora" pode cair em ONTEM no calendário de São Paulo
 * mesmo que `resumoDeHoje()` calcule "hoje" corretamente via Temporal no
 * fuso do tenant. É a mesma classe de armadilha que o CLAUDE.md do projeto
 * já avisa para geração de slot. `ancora` deixa o teste escolher: os que
 * comparam passado/futuro contra o `agora` real do sistema (próxima
 * cliente, alertas) continuam usando `Date.now()`; o de faturado (que só
 * confere status dentro de "hoje", não passado/futuro) ancora ao meio-dia
 * de hoje em TZ — longe o bastante da meia-noite pros offsets usados
 * (±240min) nunca cruzarem o limite do dia.
 */
async function inserirAgendamento(minutosDeAgora: number, status: string, ancora: Date = new Date()) {
  const inicio = new Date(ancora.getTime() + minutosDeAgora * 60_000)
  const fim = new Date(inicio.getTime() + 30 * 60_000)
  const { data, error } = await svc
    .from('appointments')
    .insert({
      tenant_id: tenantId,
      client_id: clientId,
      professional_id: professionalId,
      service_id: servicoId,
      starts_at: inicio.toISOString(),
      ends_at: fim.toISOString(),
      status: status as never,
      price_cents: 4000,
    })
    .select('id')
    .single()
  if (error) throw error
  return data.id
}

describe('resumoDeHoje', () => {
  it(
    'faturado hoje soma só o que já foi concluído (done), não o previsto',
    async () => {
      // Meio-dia de hoje em TZ, não `Date.now()`: este teste só confere status
      // dentro de "hoje" — não passado/futuro contra o agora real — então pode
      // ancorar num ponto seguro, longe da meia-noite (ver comentário de
      // `inserirAgendamento`).
      const meioDiaDeHoje = new Date(
        Temporal.Now.instant().toZonedDateTimeISO(TZ).toPlainDate().toZonedDateTime({ timeZone: TZ, plainTime: '12:00' }).epochMilliseconds,
      )
      await inserirAgendamento(-120, 'done', meioDiaDeHoje)
      await inserirAgendamento(-60, 'confirmed', meioDiaDeHoje) // não conta: ainda não foi concluído

      const resumo = await resumoDeHoje(svc, tenantId, TZ)
      expect(resumo.revenueTodayCents).toBeGreaterThanOrEqual(4000)
    },
    30_000,
  )

  it(
    'próxima cliente é o primeiro agendamento futuro ainda válido, ignorando os já passados',
    async () => {
      await svc.from('appointments').delete().eq('tenant_id', tenantId) // dia limpo para este caso

      await inserirAgendamento(-30, 'confirmed') // já passou, mas ninguém marcou o desfecho — não é "próxima"
      const idFutura = await inserirAgendamento(45, 'confirmed')
      await inserirAgendamento(90, 'pending')

      const resumo = await resumoDeHoje(svc, tenantId, TZ)
      expect(resumo.nextClient?.id).toBe(idFutura)
    },
    30_000,
  )

  it(
    'alerta é só pending que começa nas próximas 3 horas — confirmado não entra, mesmo que seja em breve',
    async () => {
      await svc.from('appointments').delete().eq('tenant_id', tenantId)

      const idAlerta = await inserirAgendamento(60, 'pending')
      await inserirAgendamento(120, 'confirmed') // pending vira alerta, confirmed não precisa de atenção
      await inserirAgendamento(240, 'pending') // pending, mas longe demais (fora da janela de 3h)

      const resumo = await resumoDeHoje(svc, tenantId, TZ)
      expect(resumo.alerts.map((a) => a.id)).toEqual([idAlerta])
    },
    30_000,
  )

  it(
    'resto do dia inclui tudo que ainda vem, na ordem, e não repete o passado',
    async () => {
      await svc.from('appointments').delete().eq('tenant_id', tenantId)

      await inserirAgendamento(-10, 'done')
      const id1 = await inserirAgendamento(30, 'confirmed')
      const id2 = await inserirAgendamento(90, 'pending')

      const resumo = await resumoDeHoje(svc, tenantId, TZ)
      expect(resumo.restOfDay.map((a) => a.id)).toEqual([id1, id2])
    },
    30_000,
  )

  it(
    'agendamento cancelado não aparece em nenhuma seção',
    async () => {
      await svc.from('appointments').delete().eq('tenant_id', tenantId)
      await inserirAgendamento(30, 'canceled')

      const resumo = await resumoDeHoje(svc, tenantId, TZ)
      expect(resumo.restOfDay).toEqual([])
      expect(resumo.nextClient).toBeNull()
      expect(resumo.alerts).toEqual([])
    },
    30_000,
  )
})
