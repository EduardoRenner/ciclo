import { randomUUID } from 'node:crypto'

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { processarMensagemRecebida, processarStatusDeEntrega } from '@/server/services/whatsapp-inbound'
import { executarOnboarding } from '@/server/services/onboarding'

import type { Database } from '@/server/db/types.gen'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error('Este teste precisa de NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local.')
}

const svc = createClient<Database>(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })

/**
 * T-01 (docs/60) — o webhook de entrada do WhatsApp. A parte que importa não é reconhecer a
 * palavra (isso é `tests/unit/core/palavra-de-acao.test.ts`) — é a CORRELAÇÃO: achar o agendamento
 * certo a partir só de um número de telefone, e recusar a agir quando não há certeza.
 */
let tenantId: string
let servicoId: string
let profissionalId: string
const tenants: string[] = []
const usuarios: string[] = []

beforeAll(async () => {
  const marca = randomUUID().slice(0, 8)
  const { data, error } = await svc.auth.admin.createUser({
    email: `wa-inbound-${marca}@ciclo.test`,
    password: randomUUID(),
    email_confirm: true,
  })
  if (error || !data.user) throw new Error(`seed falhou: ${error?.message}`)
  usuarios.push(data.user.id)

  const { tenant } = await executarOnboarding(svc, {
    userId: data.user.id,
    businessName: 'Salão do WhatsApp',
    vertical: 'barber',
    slug: `wa-inbound-${marca}`,
    timezone: 'America/Sao_Paulo',
  })
  tenantId = tenant.id
  tenants.push(tenantId)

  const { data: servico } = await svc.from('services').select('id').eq('tenant_id', tenantId).limit(1).single()
  servicoId = servico!.id

  const { data: profissional } = await svc.from('professionals').select('id').eq('tenant_id', tenantId).limit(1).maybeSingle()
  if (profissional) {
    profissionalId = profissional.id
  } else {
    const { data: criado, error } = await svc
      .from('professionals')
      .insert({ tenant_id: tenantId, display_name: 'Profissional de Teste', comp_model: 'owner', commission_bps: 0, rent_cents: 0, accepts_online: true })
      .select('id')
      .single()
    if (error) throw new Error(`seed de profissional falhou: ${error.message}`)
    profissionalId = criado!.id
  }
}, 60_000)

afterAll(async () => {
  for (const t of tenants) await svc.from('tenants').delete().eq('id', t)
  for (const u of usuarios) await svc.auth.admin.deleteUser(u)
}, 60_000)

function telefoneNovo(): string {
  return `+5511${String(90000000 + Math.floor(Math.random() * 9999999)).padStart(9, '0')}`
}

async function criarClienteComAgendamentoELembrete(telefone: string, statusAgendamento: 'pending' | 'confirmed' | 'canceled' = 'pending') {
  const { data: cliente } = await svc.from('clients').insert({ tenant_id: tenantId, name: `Cliente ${randomUUID().slice(0, 6)}`, phone_e164: telefone }).select('id').single()
  // Deslocamento aleatório: mesmo profissional em todos os casos, e sem isso todo teste cairia no
  // mesmo horário e colidiria com `appointments_no_overlap` (a trava de sobreposição é por design).
  const inicio = new Date(Date.now() + 86_400_000 + Math.floor(Math.random() * 200) * 3_600_000)
  const { data: agendamento, error: erroAg } = await svc
    .from('appointments')
    .insert({
      tenant_id: tenantId,
      client_id: cliente!.id,
      professional_id: profissionalId,
      service_id: servicoId,
      starts_at: inicio.toISOString(),
      ends_at: new Date(inicio.getTime() + 30 * 60_000).toISOString(),
      status: statusAgendamento,
      price_cents: 5000,
    })
    .select('id')
    .single()
  if (erroAg) throw new Error(`seed de agendamento falhou: ${erroAg.message}`)
  const providerId = `wamid.${randomUUID()}`
  await svc.from('messages').insert({
    tenant_id: tenantId,
    client_id: cliente!.id,
    appointment_id: agendamento!.id,
    channel: 'whatsapp',
    kind: 'reminder',
    status: 'sent',
    provider_id: providerId,
    sent_at: new Date().toISOString(),
  })
  return { clientId: cliente!.id, appointmentId: agendamento!.id, providerId }
}

describe('processarMensagemRecebida', () => {
  it(
    'CONFIRMAR confirma o único agendamento pendente correlacionado por telefone',
    async () => {
      const telefone = telefoneNovo()
      const { appointmentId } = await criarClienteComAgendamentoELembrete(telefone)

      const resultado = await processarMensagemRecebida(svc, { kind: 'inbound', from: telefone, body: 'Confirmar', receivedAt: new Date().toISOString() })
      expect(resultado).toMatchObject({ resultado: 'agiu', acao: 'confirmar', appointmentId })

      const { data } = await svc.from('appointments').select('status').eq('id', appointmentId).single()
      expect(data!.status).toBe('confirmed')
    },
    30_000,
  )

  it(
    'CANCELAR cancela um agendamento confirmado',
    async () => {
      const telefone = telefoneNovo()
      const { appointmentId } = await criarClienteComAgendamentoELembrete(telefone, 'confirmed')

      const resultado = await processarMensagemRecebida(svc, { kind: 'inbound', from: telefone, body: 'cancelar', receivedAt: new Date().toISOString() })
      expect(resultado).toMatchObject({ resultado: 'agiu', acao: 'cancelar', appointmentId })

      const { data } = await svc.from('appointments').select('status').eq('id', appointmentId).single()
      expect(data!.status).toBe('canceled')
    },
    30_000,
  )

  it(
    'texto fora do vocabulário não aciona nada, mesmo com correlação perfeita',
    async () => {
      const telefone = telefoneNovo()
      const { appointmentId } = await criarClienteComAgendamentoELembrete(telefone)

      const resultado = await processarMensagemRecebida(svc, { kind: 'inbound', from: telefone, body: 'oi, tudo bem?', receivedAt: new Date().toISOString() })
      expect(resultado).toEqual({ resultado: 'nao_reconhecido' })

      const { data } = await svc.from('appointments').select('status').eq('id', appointmentId).single()
      expect(data!.status, 'agendamento mudou de estado sem a palavra certa').toBe('pending')
    },
    30_000,
  )

  it(
    'telefone sem nenhum lembrete enviado não aciona nada — não adivinha por agendamento futuro solto',
    async () => {
      const telefoneOrfao = telefoneNovo()
      const resultado = await processarMensagemRecebida(svc, { kind: 'inbound', from: telefoneOrfao, body: 'confirmar', receivedAt: new Date().toISOString() })
      expect(resultado).toEqual({ resultado: 'sem_correlacao' })
    },
    30_000,
  )

  it(
    'DOIS agendamentos abertos pro mesmo telefone: ambíguo, não escolhe nenhum',
    async () => {
      const telefone = telefoneNovo()
      const a = await criarClienteComAgendamentoELembrete(telefone)
      // Segundo agendamento, MESMO telefone (cliente com dois horários marcados). Deslocamento
      // aleatório pelo mesmo motivo do primeiro — evitar colidir com `appointments_no_overlap`.
      const inicio2 = new Date(Date.now() + 172_800_000 + Math.floor(Math.random() * 200) * 3_600_000)
      const { data: agendamento2, error: erroAg2 } = await svc
        .from('appointments')
        .insert({
          tenant_id: tenantId,
          client_id: a.clientId,
          professional_id: profissionalId,
          service_id: servicoId,
          starts_at: inicio2.toISOString(),
          ends_at: new Date(inicio2.getTime() + 30 * 60_000).toISOString(),
          status: 'pending',
          price_cents: 5000,
        })
        .select('id')
        .single()
      if (erroAg2) throw new Error(`seed de agendamento 2 falhou: ${erroAg2.message}`)
      await svc.from('messages').insert({
        tenant_id: tenantId,
        client_id: a.clientId,
        appointment_id: agendamento2!.id,
        channel: 'whatsapp',
        kind: 'reminder',
        status: 'sent',
        provider_id: `wamid.${randomUUID()}`,
        sent_at: new Date().toISOString(),
      })

      const resultado = await processarMensagemRecebida(svc, { kind: 'inbound', from: telefone, body: 'confirmar', receivedAt: new Date().toISOString() })
      expect(resultado).toEqual({ resultado: 'ambiguo', candidatos: 2 })

      const { data: statusA } = await svc.from('appointments').select('status').eq('id', a.appointmentId).single()
      const { data: statusB } = await svc.from('appointments').select('status').eq('id', agendamento2!.id).single()
      expect(statusA!.status, 'agiu no primeiro apesar da ambiguidade').toBe('pending')
      expect(statusB!.status, 'agiu no segundo apesar da ambiguidade').toBe('pending')
    },
    30_000,
  )

  it(
    'DOIS LEMBRETES do MESMO agendamento não é ambiguidade — é o mesmo destino contado duas vezes',
    async () => {
      const telefone = telefoneNovo()
      const { appointmentId, clientId } = await criarClienteComAgendamentoELembrete(telefone)
      // Segundo lembrete (D0), MESMO agendamento — cenário real de confirmação D-1 + lembrete D0.
      await svc.from('messages').insert({
        tenant_id: tenantId,
        client_id: clientId,
        appointment_id: appointmentId,
        channel: 'whatsapp',
        kind: 'reminder',
        status: 'sent',
        provider_id: `wamid.${randomUUID()}`,
        sent_at: new Date().toISOString(),
      })

      const resultado = await processarMensagemRecebida(svc, { kind: 'inbound', from: telefone, body: 'confirmar', receivedAt: new Date().toISOString() })
      expect(resultado).toMatchObject({ resultado: 'agiu', acao: 'confirmar', appointmentId })
    },
    30_000,
  )

  it(
    'CONFIRMAR de novo depois de já confirmado não lança erro — idempotente por estado',
    async () => {
      const telefone = telefoneNovo()
      const { appointmentId } = await criarClienteComAgendamentoELembrete(telefone, 'confirmed')

      const resultado = await processarMensagemRecebida(svc, { kind: 'inbound', from: telefone, body: 'confirmar', receivedAt: new Date().toISOString() })
      expect(resultado).toEqual({ resultado: 'ja_estava_nesse_estado', tenantId, appointmentId })
    },
    30_000,
  )
})

describe('processarStatusDeEntrega', () => {
  it(
    'atualiza o status da mensagem pelo provider_id',
    async () => {
      const telefone = telefoneNovo()
      const { providerId } = await criarClienteComAgendamentoELembrete(telefone)

      const resultado = await processarStatusDeEntrega(svc, { kind: 'status', providerId, status: 'read' })
      expect(resultado).toEqual({ atualizado: true })

      const { data } = await svc.from('messages').select('status').eq('provider_id', providerId).single()
      expect(data!.status).toBe('read')
    },
    30_000,
  )

  it(
    'provider_id desconhecido não atualiza nada e não lança',
    async () => {
      const resultado = await processarStatusDeEntrega(svc, { kind: 'status', providerId: `wamid.${randomUUID()}`, status: 'delivered' })
      expect(resultado).toEqual({ atualizado: false })
    },
    30_000,
  )
})
