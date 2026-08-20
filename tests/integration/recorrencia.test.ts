import { randomUUID } from 'node:crypto'

import { Temporal } from '@js-temporal/polyfill'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { cancelarAgendamento } from '@/server/services/agendamentos'
import { criarProfissional } from '@/server/services/profissionais'
import { cancelarSerie, criarSerie, listarSeries } from '@/server/services/recorrencia'
import { criarServico } from '@/server/services/servicos'
import { executarOnboarding } from '@/server/services/onboarding'

import type { Database } from '@/server/db/types.gen'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error('O teste de recorrência precisa de NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local.')
}

const svc = createClient<Database>(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })

const TZ = 'America/Sao_Paulo'
let tenantId: string
let userId: string
let professionalId: string
let servicoId: string
let clientId: string
const tenants: string[] = []
const usuarios: string[] = []

/** Próxima ocorrência (YYYY-MM-DD, em UTC — só aritmética de calendário) de um weekday (0=domingo). */
function proximoDiaDaSemana(weekdayAlvo: number, apartirDeDias = 5): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + apartirDeDias)
  while (d.getUTCDay() !== weekdayAlvo) d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

function somarDias(data: string, dias: number): string {
  const d = new Date(`${data}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().slice(0, 10)
}

function instanteDaOcorrencia(data: string, horario: string): { startsAt: string; endsAt: string } {
  const [hh, mm] = horario.split(':').map(Number)
  const inicio = Temporal.PlainDate.from(data).toZonedDateTime({ timeZone: TZ, plainTime: { hour: hh, minute: mm } }).toInstant()
  return { startsAt: inicio.toString(), endsAt: inicio.add({ minutes: 60 }).toString() }
}

beforeAll(async () => {
  const marca = randomUUID().slice(0, 8)
  const { data, error } = await svc.auth.admin.createUser({
    email: `recorrencia-${marca}@ciclo.test`,
    password: randomUUID(),
    email_confirm: true,
    user_metadata: { full_name: 'Dona da Recorrência' },
  })
  if (error || !data.user) throw new Error(`seed falhou: ${error?.message}`)
  userId = data.user.id
  usuarios.push(userId)

  const { tenant } = await executarOnboarding(svc, {
    userId,
    businessName: 'Salão da Recorrência',
    vertical: 'barber',
    slug: `recorrencia-${marca}`,
    timezone: TZ,
  })
  tenantId = tenant.id
  tenants.push(tenantId)

  const profissional = await criarProfissional(svc, tenantId, {
    displayName: 'Profissional de Teste',
    compModel: 'owner',
    commissionBps: 0,
    rentCents: 0,
    acceptsOnline: true,
  })
  professionalId = profissional.id

  const servico = await criarServico(svc, tenantId, {
    name: 'Sessão de Teste',
    description: null,
    durationMin: 60,
    bufferBeforeMin: 0,
    bufferAfterMin: 0,
    priceCents: 8000,
    pricingModel: 'fixed',
    cycleDays: 7,
    depositBps: 0,
    depositMinCents: 0,
    parallelCapacity: 1,
    requiresAnamnesis: false,
    bookableOnline: true,
    categoryId: null,
  })
  servicoId = servico.id

  const { data: cliente, error: erroCliente } = await svc
    .from('clients')
    .insert({ tenant_id: tenantId, name: 'Cliente Recorrente', phone_e164: `+5511${Math.floor(1e8 + Math.random() * 9e8)}` })
    .select('id')
    .single()
  if (erroCliente || !cliente) throw new Error(`seed de cliente falhou: ${erroCliente?.message}`)
  clientId = cliente.id
}, 60_000)

afterAll(async () => {
  for (const t of tenants) await svc.from('tenants').delete().eq('id', t)
  for (const u of usuarios) await svc.auth.admin.deleteUser(u)
})

describe('criarSerie · geração de ocorrências (docs/09-PLATAFORMA.md §12)', () => {
  it('planta uma ocorrência por semana, com origin "recurring" e recurrence_id apontando pra série', async () => {
    const inicio = proximoDiaDaSemana(1) // segunda
    const { serie, ocorrencias } = await criarSerie(svc, tenantId, TZ, userId, {
      clientId,
      serviceId: servicoId,
      professionalId,
      tipo: 'semanal',
      weekday: 1,
      intervaloSemanas: 1,
      intervaloDias: null,
      ordinalNoMes: null,
      horario: '10:00',
      startsOn: inicio,
      endsOn: null,
      maxOcorrencias: 3,
      note: null,
      address: null,
    })

    expect(serie.status).toBe('active')
    expect(ocorrencias).toEqual([
      { data: inicio, status: 'agendada' },
      { data: somarDias(inicio, 7), status: 'agendada' },
      { data: somarDias(inicio, 14), status: 'agendada' },
    ])

    const { data: plantadas, error } = await svc.from('appointments').select('origin, recurrence_id, status').eq('recurrence_id', serie.id)
    if (error) throw error
    expect(plantadas).toHaveLength(3)
    for (const a of plantadas!) {
      expect(a.origin).toBe('recurring')
      expect(a.recurrence_id).toBe(serie.id)
      expect(a.status).toBe('pending')
    }

    const { data: serieAtualizada } = await svc.from('appointment_series').select('ocorrencias_geradas').eq('id', serie.id).single()
    expect(serieAtualizada!.ocorrencias_geradas).toBe(3)
  })

  it('pula (não desloca) a ocorrência que cai em cima de uma folga do profissional, e avisa qual', async () => {
    const inicio = proximoDiaDaSemana(2) // terça
    const ocorrenciaEmFolga = somarDias(inicio, 7)
    await svc.from('time_off').insert({
      tenant_id: tenantId,
      professional_id: professionalId,
      starts_at: `${ocorrenciaEmFolga}T00:00:00Z`,
      ends_at: `${ocorrenciaEmFolga}T23:59:59Z`,
      reason: 'Folga de teste',
    })

    const { serie, ocorrencias } = await criarSerie(svc, tenantId, TZ, userId, {
      clientId,
      serviceId: servicoId,
      professionalId,
      tipo: 'semanal',
      weekday: 2,
      intervaloSemanas: 1,
      intervaloDias: null,
      ordinalNoMes: null,
      horario: '11:00',
      startsOn: inicio,
      endsOn: null,
      maxOcorrencias: 3,
      note: null,
      address: null,
    })

    expect(ocorrencias).toEqual([
      { data: inicio, status: 'agendada' },
      { data: ocorrenciaEmFolga, status: 'pulada_folga' },
      { data: somarDias(inicio, 14), status: 'agendada' },
    ])

    const { data: plantadas } = await svc.from('appointments').select('id').eq('recurrence_id', serie.id)
    // só as 2 que não caíram em folga viram agendamento de verdade
    expect(plantadas).toHaveLength(2)
  })

  it('pula a ocorrência que colide com um agendamento já existente, sem derrubar o resto da série', async () => {
    const inicio = proximoDiaDaSemana(3) // quarta
    const ocorrenciaOcupada = somarDias(inicio, 7)
    const { startsAt, endsAt } = instanteDaOcorrencia(ocorrenciaOcupada, '12:00')
    await svc.from('appointments').insert({
      tenant_id: tenantId,
      client_id: clientId,
      professional_id: professionalId,
      service_id: servicoId,
      starts_at: startsAt,
      ends_at: endsAt,
      origin: 'app',
    })

    const { serie, ocorrencias } = await criarSerie(svc, tenantId, TZ, userId, {
      clientId,
      serviceId: servicoId,
      professionalId,
      tipo: 'semanal',
      weekday: 3,
      intervaloSemanas: 1,
      intervaloDias: null,
      ordinalNoMes: null,
      horario: '12:00',
      startsOn: inicio,
      endsOn: null,
      maxOcorrencias: 3,
      note: null,
      address: null,
    })

    expect(ocorrencias.map((o) => o.status)).toEqual(['agendada', 'pulada_conflito', 'agendada'])

    const { data: plantadas } = await svc.from('appointments').select('id').eq('recurrence_id', serie.id)
    expect(plantadas).toHaveLength(2) // a ocupada não gerou uma segunda linha
  })
})

describe('cancelarSerie · cancelar o contrato ≠ cancelar uma ocorrência (§12)', () => {
  it('cancela a série e as ocorrências futuras, mas preserva o que já foi concluído', async () => {
    const inicio = proximoDiaDaSemana(4) // quinta
    const { serie } = await criarSerie(svc, tenantId, TZ, userId, {
      clientId,
      serviceId: servicoId,
      professionalId,
      tipo: 'semanal',
      weekday: 4,
      intervaloSemanas: 1,
      intervaloDias: null,
      ordinalNoMes: null,
      horario: '13:00',
      startsOn: inicio,
      endsOn: null,
      maxOcorrencias: 3,
      note: null,
      address: null,
    })

    const { data: plantadas } = await svc.from('appointments').select('id, starts_at').eq('recurrence_id', serie.id).order('starts_at')
    const primeira = plantadas![0]!.id
    await svc.from('appointments').update({ status: 'done', completed_at: new Date().toISOString() }).eq('id', primeira)

    const resultado = await cancelarSerie(svc, tenantId, serie.id)
    expect(resultado.ocorrenciasCanceladas).toBe(2) // as 2 que ainda estavam pending

    const { data: serieFinal } = await svc.from('appointment_series').select('status, canceled_at').eq('id', serie.id).single()
    expect(serieFinal!.status).toBe('canceled')
    expect(serieFinal!.canceled_at).not.toBeNull()

    const { data: ocorrenciasFinais } = await svc.from('appointments').select('id, status').eq('recurrence_id', serie.id).order('starts_at')
    expect(ocorrenciasFinais![0]!.status).toBe('done') // não mexeu no histórico
    expect(ocorrenciasFinais![1]!.status).toBe('canceled')
    expect(ocorrenciasFinais![2]!.status).toBe('canceled')
  })

  it('cancelar uma ocorrência isolada não cancela a série nem as outras ocorrências', async () => {
    const inicio = proximoDiaDaSemana(5) // sexta
    const { serie } = await criarSerie(svc, tenantId, TZ, userId, {
      clientId,
      serviceId: servicoId,
      professionalId,
      tipo: 'semanal',
      weekday: 5,
      intervaloSemanas: 1,
      intervaloDias: null,
      ordinalNoMes: null,
      horario: '14:00',
      startsOn: inicio,
      endsOn: null,
      maxOcorrencias: 2,
      note: null,
      address: null,
    })

    const { data: plantadas } = await svc.from('appointments').select('id').eq('recurrence_id', serie.id).order('starts_at')
    await cancelarAgendamento(svc, tenantId, plantadas![0]!.id, { canceledBy: 'professional', reason: null })

    const { data: serieAinda } = await svc.from('appointment_series').select('status, ocorrencias_geradas').eq('id', serie.id).single()
    expect(serieAinda!.status).toBe('active')
    expect(serieAinda!.ocorrencias_geradas).toBe(2) // cancelar ocorrência não reescreve a série

    const { data: outraOcorrencia } = await svc.from('appointments').select('status').eq('id', plantadas![1]!.id).single()
    expect(outraOcorrencia!.status).toBe('pending')
  })

  it('cancelar a mesma série duas vezes dá erro em vez de duplicar o cancelamento', async () => {
    const inicio = proximoDiaDaSemana(6) // sábado
    const { serie } = await criarSerie(svc, tenantId, TZ, userId, {
      clientId,
      serviceId: servicoId,
      professionalId,
      tipo: 'a_cada_dias',
      weekday: null,
      intervaloSemanas: null,
      intervaloDias: 20,
      ordinalNoMes: null,
      horario: '15:00',
      startsOn: inicio,
      endsOn: null,
      maxOcorrencias: 2,
      note: null,
      address: null,
    })

    await cancelarSerie(svc, tenantId, serie.id)
    await expect(cancelarSerie(svc, tenantId, serie.id)).rejects.toThrow()
  })
})

describe('criarSerie · outros dois padrões do §12 (a cada N dias; enésimo dia do mês)', () => {
  it('a_cada_dias planta a partir do próprio dia de início, sem procurar weekday', async () => {
    const inicio = proximoDiaDaSemana(0, 40) // domingo, mais longe pra não colidir com as séries semanais acima
    const { ocorrencias } = await criarSerie(svc, tenantId, TZ, userId, {
      clientId,
      serviceId: servicoId,
      professionalId,
      tipo: 'a_cada_dias',
      weekday: null,
      intervaloSemanas: null,
      intervaloDias: 10,
      ordinalNoMes: null,
      horario: '16:00',
      startsOn: inicio,
      endsOn: null,
      maxOcorrencias: 2,
      note: null,
      address: null,
    })
    expect(ocorrencias).toEqual([
      { data: inicio, status: 'agendada' },
      { data: somarDias(inicio, 10), status: 'agendada' },
    ])
  })

  it('mensal_dia_semana ("primeira segunda do mês") não confunde com a série semanal', async () => {
    const inicio = proximoDiaDaSemana(1, 45) // segunda, bem à frente
    const { ocorrencias } = await criarSerie(svc, tenantId, TZ, userId, {
      clientId,
      serviceId: servicoId,
      professionalId,
      tipo: 'mensal_dia_semana',
      weekday: 1,
      intervaloSemanas: null,
      intervaloDias: null,
      ordinalNoMes: 1,
      horario: '17:00',
      startsOn: inicio,
      endsOn: null,
      maxOcorrencias: 1,
      note: null,
      address: null,
    })
    expect(ocorrencias).toHaveLength(1)
    expect(ocorrencias[0]!.status).toBe('agendada')
  })
})

describe('listarSeries (TICKET-081 — tela de gestão)', () => {
  it('lista a série recém-criada com nome da cliente, serviço, profissional e descrição em português', async () => {
    const inicio = proximoDiaDaSemana(2, 60) // terça, bem à frente pra não colidir com outras séries do arquivo
    const { serie } = await criarSerie(svc, tenantId, TZ, userId, {
      clientId,
      serviceId: servicoId,
      professionalId,
      tipo: 'semanal',
      weekday: 2,
      intervaloSemanas: 1,
      intervaloDias: null,
      ordinalNoMes: null,
      horario: '11:00',
      startsOn: inicio,
      endsOn: null,
      maxOcorrencias: 4,
      note: null,
      address: null,
    })

    const lista = await listarSeries(svc, tenantId)
    const linha = lista.find((s) => s.id === serie.id)
    expect(linha).toMatchObject({ status: 'active', descricao: 'Terça-feira, toda semana', maxOcorrencias: 4 })
    expect(linha?.clientName).toBeTruthy()
    expect(linha?.serviceName).toBeTruthy()
    expect(linha?.professionalName).toBeTruthy()
    expect(linha!.ocorrenciasGeradas).toBeGreaterThan(0)
  })

  it('série cancelada aparece com status canceled, sem sumir da lista', async () => {
    const inicio = proximoDiaDaSemana(3, 61) // quarta
    const { serie } = await criarSerie(svc, tenantId, TZ, userId, {
      clientId,
      serviceId: servicoId,
      professionalId,
      tipo: 'a_cada_dias',
      weekday: null,
      intervaloSemanas: null,
      intervaloDias: 10,
      ordinalNoMes: null,
      horario: '09:00',
      startsOn: inicio,
      endsOn: null,
      maxOcorrencias: 2,
      note: null,
      address: null,
    })
    await cancelarSerie(svc, tenantId, serie.id)

    const lista = await listarSeries(svc, tenantId)
    const linha = lista.find((s) => s.id === serie.id)
    expect(linha?.status).toBe('canceled')
    expect(linha?.descricao).toBe('A cada 10 dias')
  })

  it('não vaza série de outro tenant', async () => {
    const marca = randomUUID().slice(0, 8)
    const { data: outroUsuario, error: erroUsuario } = await svc.auth.admin.createUser({
      email: `recorrencia-outro-${marca}@ciclo.test`,
      password: randomUUID(),
      email_confirm: true,
    })
    if (erroUsuario || !outroUsuario.user) throw new Error('seed do outro tenant falhou')
    usuarios.push(outroUsuario.user.id)

    const { tenant: outroTenant } = await executarOnboarding(svc, {
      userId: outroUsuario.user.id,
      businessName: 'Outro Salão de Recorrência',
      vertical: 'barber',
      slug: `recorrencia-outro-${marca}`,
      timezone: TZ,
    })
    tenants.push(outroTenant.id)

    const lista = await listarSeries(svc, outroTenant.id)
    expect(lista).toEqual([])
  })
})
