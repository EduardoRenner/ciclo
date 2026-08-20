import { randomUUID } from 'node:crypto'

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  cancelarAgendamento,
  concluirAgendamento,
  confirmarAgendamento,
  criarAgendamento,
  marcarChegada,
  marcarFalta,
  remarcarAgendamento,
} from '@/server/services/agendamentos'
import { criarServico } from '@/server/services/servicos'
import { criarProfissional } from '@/server/services/profissionais'
import { definirExpediente } from '@/server/services/expediente'
import { executarOnboarding } from '@/server/services/onboarding'

import type { Database } from '@/server/db/types.gen'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error('O teste de agendamentos precisa de NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local.')
}

const svc = createClient<Database>(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })

let tenantId: string
let userId: string
let professionalId: string
let servicoId: string
const TZ = 'America/Sao_Paulo'
const tenants: string[] = []
const usuarios: string[] = []

/** Próxima terça-feira (dia útil estável), formatada YYYY-MM-DD, para o expediente de teste ter onde caber. */
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
    email: `agenda-${marca}@ciclo.test`,
    password: randomUUID(),
    email_confirm: true,
    user_metadata: { full_name: 'Dona da Agenda' },
  })
  if (error || !data.user) throw new Error(`seed falhou: ${error?.message}`)
  userId = data.user.id
  usuarios.push(userId)

  const { tenant } = await executarOnboarding(svc, {
    userId,
    businessName: 'Salão da Agenda',
    vertical: 'barber',
    slug: `agenda-${marca}`,
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
    durationMin: 60,
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

  await definirExpediente(svc, tenantId, {
    professionalId,
    // 2 = terça no Postgres (0=domingo). §weekday da 0001. Expediente longo
    // (até 22h) de propósito: vários testes deste arquivo compartilham o
    // mesmo profissional e alguns deixam o agendamento propositalmente
    // "pending" para sempre (testam transição ilegal) — folga de sobra evita
    // ficar caçando o único horário ainda livre no meio dos outros testes.
    blocos: [{ weekday: 2, opensAt: '09:00', closesAt: '22:00' }],
  })
}, 60_000)

afterAll(async () => {
  for (const t of tenants) await svc.from('tenants').delete().eq('id', t)
  for (const u of usuarios) await svc.auth.admin.deleteUser(u)
}, 60_000)

function horario(hhmm: string): string {
  // Terça no fuso de teste, sem transição de DST no período em que os testes rodam.
  return `${DIA}T${hhmm}:00-03:00`
}

describe('criarAgendamento', () => {
  it(
    'cria com sucesso dentro do expediente',
    async () => {
      const ag = await criarAgendamento(
        svc,
        tenantId,
        TZ,
        userId,
        {
          clientDraft: { name: 'Cliente Nova', phone: '11987650001' },
          serviceId: servicoId,
          professionalId,
          startsAt: horario('10:00'),
          origin: 'app',
        },
        {},
      )
      expect(ag.status).toBe('pending')
      expect(ag.price_cents).toBe(5000)
    },
    30_000,
  )

  it(
    'conflito real devolve SLOT_TAKEN com até 3 alternativas',
    async () => {
      const primeiro = await criarAgendamento(
        svc,
        tenantId,
        TZ,
        userId,
        {
          clientDraft: { name: 'Primeira', phone: '11987650002' },
          serviceId: servicoId,
          professionalId,
          startsAt: horario('11:00'),
          origin: 'app',
        },
        {},
      )
      expect(primeiro.status).toBe('pending')

      const erro = await criarAgendamento(
        svc,
        tenantId,
        TZ,
        userId,
        {
          clientDraft: { name: 'Segunda', phone: '11987650003' },
          serviceId: servicoId,
          professionalId,
          startsAt: horario('11:00'),
          origin: 'app',
        },
        {},
      ).catch((e: unknown) => e)

      expect(erro).toMatchObject({ code: 'SLOT_TAKEN', status: 409 })
      const alternativas = (erro as { details: { alternatives: string[] } }).details.alternatives
      expect(alternativas.length).toBeGreaterThan(0)
      expect(alternativas.length).toBeLessThanOrEqual(3)
      // Nenhuma alternativa é o próprio horário que colidiu.
      expect(alternativas).not.toContain(new Date(horario('11:00')).toISOString())
    },
    30_000,
  )

  it(
    // docs/09-PLATAFORMA.md §10 (P9): a sugestão de alternativas do 409 nunca lia o buffer do
    // serviço — só o booking público fazia isso (achado ao investigar deslocamento avançado).
    // Profissional dedicado, isolado dos outros testes deste arquivo: buffer não bloqueia o
    // INSERT em si (não faz parte da constraint de sobreposição), só a sugestão de alternativas
    // — então este teste precisa de uma colisão de horário de verdade pra chegar no 409, sem
    // qualquer chance de um horário usado por outro teste interferir.
    'alternativas do SLOT_TAKEN respeitam o buffer do serviço, não só a duração',
    async () => {
      const outroProfissional = await criarProfissional(svc, tenantId, {
        displayName: 'Profissional do Buffer',
        compModel: 'owner',
        commissionBps: 0,
        rentCents: 0,
        acceptsOnline: true,
      })
      await definirExpediente(svc, tenantId, { professionalId: outroProfissional.id, blocos: [{ weekday: 2, opensAt: '09:00', closesAt: '22:00' }] })

      // bufferBeforeMin (não bufferAfterMin): `available-slots.ts` aplica o buffer à janela do
      // PRÓPRIO candidato ([candidato-bufferBefore, fim+bufferAfter]) — é o candidato que precisa
      // de silêncio ao redor dele, não o agendamento anterior que "reserva" silêncio pra depois.
      // Testado (available-slots.test.ts): bufferBeforeMin é o que bloqueia um candidato de
      // nascer cedo demais depois de um agendamento vizinho.
      const servicoComBuffer = await criarServico(svc, tenantId, {
        name: 'Serviço com preparo',
        description: null,
        durationMin: 30,
        bufferBeforeMin: 45,
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

      await criarAgendamento(
        svc,
        tenantId,
        TZ,
        userId,
        { clientDraft: { name: 'Cliente Buffer 1', phone: '11987650100' }, serviceId: servicoComBuffer.id, professionalId: outroProfissional.id, startsAt: horario('09:00'), origin: 'app' },
        {},
      )
      // Um candidato do mesmo serviço precisa de 45min de silêncio antes dele — o primeiro
      // horário livre depois do agendamento das 09:00–09:30 é só 10:15 (09:30 + 45min).

      const erro = await criarAgendamento(
        svc,
        tenantId,
        TZ,
        userId,
        { clientDraft: { name: 'Cliente Buffer 2', phone: '11987650101' }, serviceId: servicoComBuffer.id, professionalId: outroProfissional.id, startsAt: horario('09:00'), origin: 'app' },
        {},
      ).catch((e: unknown) => e)

      expect(erro).toMatchObject({ code: 'SLOT_TAKEN' })
      const alternativas = (erro as { details: { alternatives: string[] } }).details.alternatives
      expect(alternativas.length).toBeGreaterThan(0)
      for (const alt of alternativas) {
        const minutosLocal = new Date(alt).toLocaleString('en-US', { timeZone: TZ, hour12: false, hour: '2-digit', minute: '2-digit' })
        // Nenhuma alternativa cai dentro da janela de buffer (09:15–10:00) — só 10:15 em diante.
        expect(['09:15', '09:30', '09:45', '10:00'].includes(minutosLocal)).toBe(false)
      }
    },
    30_000,
  )

  it(
    'duas requisições simultâneas pelo mesmo horário: só uma vira agendamento',
    async () => {
      const entrada = (sufixo: string) => ({
        clientDraft: { name: `Corrida ${sufixo}`, phone: `1197765${sufixo}` },
        serviceId: servicoId,
        professionalId,
        startsAt: horario('14:00'),
        origin: 'app' as const,
      })

      const resultados = await Promise.allSettled([
        criarAgendamento(svc, tenantId, TZ, userId, entrada('0001'), {}),
        criarAgendamento(svc, tenantId, TZ, userId, entrada('0002'), {}),
      ])

      const sucesso = resultados.filter((r) => r.status === 'fulfilled')
      const falha = resultados.filter((r) => r.status === 'rejected')
      expect(sucesso).toHaveLength(1)
      expect(falha).toHaveLength(1)

      const { count } = await svc
        .from('appointments')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('professional_id', professionalId)
        .gte('starts_at', horario('14:00'))
        .lt('starts_at', horario('14:01'))
      expect(count).toBe(1)
    },
    30_000,
  )
})

describe('máquina de estados via API', () => {
  async function novoAgendamento(hhmm: string) {
    return criarAgendamento(
      svc,
      tenantId,
      TZ,
      userId,
      {
        // DDD 11 + 9 (celular) + 8 dígitos aleatórios com zero à esquerda preservado = 11 dígitos certos.
        clientDraft: { name: 'Ciclo de Estado', phone: `119${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}` },
        serviceId: servicoId,
        professionalId,
        startsAt: horario(hhmm),
        origin: 'app',
      },
      {},
    )
  }

  it(
    'confirmar → chegar → concluir gera a comanda',
    async () => {
      const ag = await novoAgendamento('12:00')

      const confirmado = await confirmarAgendamento(svc, tenantId, ag.id)
      expect(confirmado.status).toBe('confirmed')

      const chegou = await marcarChegada(svc, tenantId, ag.id)
      expect(chegou.status).toBe('arrived')

      const { appointment, ticket } = await concluirAgendamento(svc, tenantId, ag.id)
      expect(appointment.status).toBe('done')
      expect(ticket.id).toBeTruthy()

      const ticketNoBanco = await svc.from('tickets').select('appointment_id, status').eq('id', ticket.id).single()
      expect(ticketNoBanco.data).toMatchObject({ appointment_id: ag.id, status: 'open' })
    },
    30_000,
  )

  it(
    'concluir duas vezes não cria duas comandas — idempotente pelo appointment_id',
    async () => {
      const ag = await novoAgendamento('12:30')
      await confirmarAgendamento(svc, tenantId, ag.id)
      await marcarChegada(svc, tenantId, ag.id)

      const primeira = await concluirAgendamento(svc, tenantId, ag.id)
      const segunda = await concluirAgendamento(svc, tenantId, ag.id).catch((e: unknown) => e)

      // A segunda tentativa esbarra na transição (done → done é ilegal), mas
      // se o ticket já existisse duplicado seria o sintoma real do bug.
      const { count } = await svc.from('tickets').select('id', { count: 'exact', head: true }).eq('appointment_id', ag.id)
      expect(count).toBe(1)
      expect(primeira.ticket.id).toBeTruthy()
      expect(segunda).toMatchObject({ code: 'INVALID_TRANSITION' })
    },
    30_000,
  )

  it(
    'transição ilegal (pending → arrived, pulando confirmed) devolve 422 INVALID_TRANSITION',
    async () => {
      const ag = await novoAgendamento('13:00')
      const erro = await marcarChegada(svc, tenantId, ag.id).catch((e: unknown) => e)
      expect(erro).toMatchObject({ code: 'INVALID_TRANSITION', status: 422 })
    },
    30_000,
  )

  it(
    'no-show só a partir de confirmed (E68)',
    async () => {
      const ag = await novoAgendamento('15:00')
      const cedoDemais = await marcarFalta(svc, tenantId, ag.id).catch((e: unknown) => e)
      expect(cedoDemais).toMatchObject({ code: 'INVALID_TRANSITION' })

      await confirmarAgendamento(svc, tenantId, ag.id)
      const marcado = await marcarFalta(svc, tenantId, ag.id)
      expect(marcado.status).toBe('no_show')
    },
    30_000,
  )

  it(
    'depois de arrived não dá para cancelar — só done',
    async () => {
      const ag = await novoAgendamento('20:00')
      await confirmarAgendamento(svc, tenantId, ag.id)
      await marcarChegada(svc, tenantId, ag.id)

      const erro = await cancelarAgendamento(svc, tenantId, ag.id, { canceledBy: 'client' }).catch((e: unknown) => e)
      expect(erro).toMatchObject({ code: 'INVALID_TRANSITION' })
    },
    30_000,
  )
})

describe('cancelar', () => {
  it(
    'registra canceled_by e motivo, nunca apaga a linha',
    async () => {
      const ag = await criarAgendamento(
        svc,
        tenantId,
        TZ,
        userId,
        {
          clientDraft: { name: 'Vai Cancelar', phone: '11976541234' },
          serviceId: servicoId,
          professionalId,
          startsAt: horario('16:00'),
          origin: 'app',
        },
        {},
      )

      const cancelado = await cancelarAgendamento(svc, tenantId, ag.id, { canceledBy: 'client', reason: 'Imprevisto' })
      expect(cancelado).toMatchObject({ status: 'canceled', canceled_by: 'client', cancel_reason: 'Imprevisto' })

      const aindaExiste = await svc.from('appointments').select('id, status').eq('id', ag.id).single()
      expect(aindaExiste.data).toMatchObject({ id: ag.id, status: 'canceled' })
    },
    30_000,
  )
})

describe('remarcar', () => {
  it(
    'revalida disponibilidade — remarcar para um horário já ocupado dá SLOT_TAKEN',
    async () => {
      const ocupante = await criarAgendamento(
        svc,
        tenantId,
        TZ,
        userId,
        {
          clientDraft: { name: 'Ocupa o Horário', phone: '11987651111' },
          serviceId: servicoId,
          professionalId,
          startsAt: horario('17:00'),
          origin: 'app',
        },
        {},
      )
      expect(ocupante.status).toBe('pending')

      const outro = await criarAgendamento(
        svc,
        tenantId,
        TZ,
        userId,
        {
          clientDraft: { name: 'Vai Tentar Remarcar', phone: '11987652222' },
          serviceId: servicoId,
          professionalId,
          startsAt: horario('09:00'),
          origin: 'app',
        },
        {},
      )

      const erro = await remarcarAgendamento(svc, tenantId, TZ, outro.id, { startsAt: horario('17:00') }, {}).catch(
        (e: unknown) => e,
      )
      expect(erro).toMatchObject({ code: 'SLOT_TAKEN' })

      // O agendamento original não deve ter mudado de horário.
      const confirmado = await svc.from('appointments').select('starts_at').eq('id', outro.id).single()
      expect(new Date(confirmado.data!.starts_at).getTime()).toBe(new Date(horario('09:00')).getTime())
    },
    30_000,
  )

  it(
    'remarcar para um horário livre funciona',
    async () => {
      // Profissional próprio, com a agenda inteira do dia livre: os outros
      // casos deste arquivo já ocupam boa parte de `professionalId` — isolar
      // aqui evita caçar um horário livre no meio de todo mundo.
      const outroProfissional = await criarProfissional(svc, tenantId, {
        displayName: 'Só Para Remarcar',
        compModel: 'owner',
        commissionBps: 0,
        rentCents: 0,
        acceptsOnline: true,
      })
      await definirExpediente(svc, tenantId, {
        professionalId: outroProfissional.id,
        blocos: [{ weekday: 2, opensAt: '09:00', closesAt: '18:00' }],
      })

      const ag = await criarAgendamento(
        svc,
        tenantId,
        TZ,
        userId,
        {
          clientDraft: { name: 'Vai Remarcar de Verdade', phone: '11987653333' },
          serviceId: servicoId,
          professionalId: outroProfissional.id,
          startsAt: horario('09:00'),
          origin: 'app',
        },
        {},
      )

      const remarcado = await remarcarAgendamento(svc, tenantId, TZ, ag.id, { startsAt: horario('09:30') }, {})
      expect(new Date(remarcado.starts_at).getTime()).toBe(new Date(horario('09:30')).getTime())
    },
    30_000,
  )
})
