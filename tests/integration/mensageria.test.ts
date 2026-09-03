import { randomUUID } from 'node:crypto'

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { ErroDeEnvio, type MessagingProvider } from '@/server/providers/messaging/types'
import { executarOnboarding } from '@/server/services/onboarding'
import { enviarComFallback } from '@/server/services/mensageria'

import type { Database } from '@/server/db/types.gen'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error('O teste de mensageria precisa de NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local.')
}

const svc = createClient<Database>(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })

let tenantId: string
let clientId: string
let tenantDemoId: string
let clientDemoId: string
const tenants: string[] = []
const usuarios: string[] = []

beforeAll(async () => {
  const marca = randomUUID().slice(0, 8)
  const { data, error } = await svc.auth.admin.createUser({
    email: `msg-${marca}@ciclo.test`,
    password: randomUUID(),
    email_confirm: true,
    user_metadata: { full_name: 'Dona da Mensageria' },
  })
  if (error || !data.user) throw new Error(`seed falhou: ${error?.message}`)
  usuarios.push(data.user.id)

  const { tenant } = await executarOnboarding(svc, {
    userId: data.user.id,
    businessName: 'Salão da Mensageria',
    vertical: 'hair',
    slug: `msg-${marca}`,
    timezone: 'America/Sao_Paulo',
  })
  tenantId = tenant.id
  tenants.push(tenantId)

  const cliente = await svc
    .from('clients')
    .insert({ tenant_id: tenantId, name: 'Cliente da Mensageria', phone_e164: '+5511988990001' })
    .select('id')
    .single()
  clientId = cliente.data!.id
  // Conta de demonstração: `enviarComFallback` tem de barrar transporte real aqui, porque
  // `notificarProximoDaLista` e `/cycle/recover/send` chegam nele sem laço de tenant onde pular.
  const { tenant: td } = await executarOnboarding(svc, {
    userId: usuarios[0]!,
    businessName: 'Navalha de Ouro (exemplo)',
    vertical: 'hair',
    slug: 'demo-navalha-de-ouro',
    timezone: 'America/Sao_Paulo',
  })
  tenantDemoId = td.id
  tenants.push(tenantDemoId)
  const clienteDemo = await svc
    .from('clients')
    .insert({ tenant_id: tenantDemoId, name: 'Cliente da Demo', phone_e164: '+5511988990002' })
    .select('id')
    .single()
  clientDemoId = clienteDemo.data!.id
}, 60_000)

afterAll(async () => {
  for (const t of tenants) await svc.from('tenants').delete().eq('id', t)
  for (const u of usuarios) await svc.auth.admin.deleteUser(u)
}, 60_000)

function providerQueSempreFunciona(): MessagingProvider {
  return {
    sendTemplate: vi.fn(async () => ({ providerId: `wamid.${randomUUID()}` })),
    sendText: vi.fn(async () => ({ providerId: `wamid.${randomUUID()}` })),
    parseWebhook: vi.fn(),
  }
}

function providerQueFalhaNVezes(n: number, motivo: 'template_rejeitado' | 'falha_transitoria' = 'falha_transitoria'): {
  provider: MessagingProvider
  chamadas: { count: number }
} {
  const chamadas = { count: 0 }
  const sendTemplate = vi.fn(async () => {
    chamadas.count++
    if (chamadas.count <= n) throw new ErroDeEnvio('falha simulada', motivo)
    return { providerId: `wamid.${randomUUID()}` }
  })
  return { provider: { sendTemplate, sendText: vi.fn(), parseWebhook: vi.fn() }, chamadas }
}

function entradaBase(overrides: Partial<Parameters<typeof enviarComFallback>[1]> = {}) {
  return {
    tenantId,
    clientId,
    kind: 'reminder' as const,
    template: `lembrete_${randomUUID().slice(0, 8)}`,
    params: { nome: 'Cliente' },
    fallbackSubject: 'Lembrete do seu horário',
    fallbackBody: 'Seu horário é amanhã às 14h.',
    whatsappTo: '+5511988990001',
    emailTo: null,
    ...overrides,
  }
}

describe('enviarComFallback', () => {
  it(
    'sucesso de primeira: grava em messages com channel whatsapp e status sent',
    async () => {
      const resultado = await enviarComFallback(svc, entradaBase(), providerQueSempreFunciona())
      expect(resultado).toMatchObject({ channel: 'whatsapp', status: 'sent' })
      expect(resultado.providerId).toBeTruthy()

      const linha = await svc.from('messages').select('channel, status, provider_id').eq('provider_id', resultado.providerId!).single()
      expect(linha.data).toMatchObject({ channel: 'whatsapp', status: 'sent' })
    },
    30_000,
  )

  it(
    'falha 2 vezes e passa na 3ª: ainda conta como sucesso do WhatsApp, não cai pro fallback',
    async () => {
      const { provider, chamadas } = providerQueFalhaNVezes(2)
      const resultado = await enviarComFallback(svc, entradaBase(), provider)

      expect(chamadas.count).toBe(3)
      expect(resultado.channel).toBe('whatsapp')
      expect(resultado.status).toBe('sent')
    },
    30_000,
  )

  it(
    'falha as 3 tentativas: cai pro fallback (e-mail não configurado neste ambiente, então falha registrada)',
    async () => {
      const { provider, chamadas } = providerQueFalhaNVezes(5) // sempre falha
      const resultado = await enviarComFallback(svc, entradaBase(), provider)

      expect(chamadas.count).toBe(3) // TENTATIVAS_WHATSAPP, nunca mais que isso
      expect(resultado.status).toBe('failed')

      const ultima = await svc
        .from('messages')
        .select('status, error')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      expect(ultima.data?.status).toBe('failed')
      expect(ultima.data?.error).toMatch(/WhatsApp/)
    },
    30_000,
  )

  it(
    'template rejeitado não tenta de novo — pula direto pro fallback',
    async () => {
      const { provider, chamadas } = providerQueFalhaNVezes(5, 'template_rejeitado')
      await enviarComFallback(svc, entradaBase(), provider)

      // H108: template reprovado não melhora tentando de novo.
      expect(chamadas.count).toBe(1)
    },
    30_000,
  )

  it(
    'a mesma mensagem (appointment + kind + template) não duplica — dedupe do banco segura',
    async () => {
      const marca = randomUUID().slice(0, 8)

      // O tenant é da vertical 'hair', que não tem pack semeado de propósito
      // (TICKET-028: apply_vertical_pack tolera vertical sem catálogo) — sem
      // serviço/profissional prontos, este teste cria os dela mesmo, já que
      // o que importa aqui é só ter um appointment_id para o dedupe morder.
      const profissional = await svc
        .from('professionals')
        .insert({ tenant_id: tenantId, display_name: 'Profissional do Dedupe' })
        .select('id')
        .single()
      const servico = await svc
        .from('services')
        .insert({ tenant_id: tenantId, name: 'Serviço do Dedupe', duration_min: 30, price_cents: 5000 })
        .select('id')
        .single()

      const ag = await svc
        .from('appointments')
        .insert({
          tenant_id: tenantId,
          client_id: clientId,
          professional_id: profissional.data!.id,
          service_id: servico.data!.id,
          starts_at: new Date(Date.now() + 86_400_000).toISOString(),
          ends_at: new Date(Date.now() + 86_400_000 + 1_800_000).toISOString(),
        })
        .select('id')
        .single()

      const entrada = entradaBase({ appointmentId: ag.data!.id, template: `dedupe_${marca}` })
      const r1 = await enviarComFallback(svc, entrada, providerQueSempreFunciona())
      const r2 = await enviarComFallback(svc, entrada, providerQueSempreFunciona())

      expect(r1.status).toBe('sent')
      // A segunda chamada bate no unique index (23505) e não estoura — só não duplica.
      expect(r2.channel).toBe('whatsapp')

      const { count } = await svc
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('appointment_id', ag.data!.id)
        .eq('template', `dedupe_${marca}`)
      expect(count).toBe(1)
    },
    30_000,
  )

  it(
    'campanha para cliente com opt-out não chama o provider nenhuma vez',
    async () => {
      const optOut = await svc
        .from('clients')
        .insert({ tenant_id: tenantId, name: 'Optou Fora', phone_e164: '+5511988990099', whatsapp_opt_out: true })
        .select('id')
        .single()

      const provider = providerQueSempreFunciona()
      const resultado = await enviarComFallback(svc, entradaBase({ clientId: optOut.data!.id, kind: 'campaign' }), provider)

      expect(provider.sendTemplate).not.toHaveBeenCalled()
      expect(resultado.status).toBe('failed')
    },
    30_000,
  )

  it(
    'lembrete transacional ignora opt-out — H110: opt-out só bloqueia marketing',
    async () => {
      const optOut = await svc
        .from('clients')
        .insert({ tenant_id: tenantId, name: 'Optou Fora Mas Tem Horário', phone_e164: '+5511988990098', whatsapp_opt_out: true })
        .select('id')
        .single()

      const provider = providerQueSempreFunciona()
      const resultado = await enviarComFallback(svc, entradaBase({ clientId: optOut.data!.id, kind: 'reminder' }), provider)

      expect(provider.sendTemplate).toHaveBeenCalledTimes(1)
      expect(resultado.status).toBe('sent')
    },
    30_000,
  )
})

describe('enviarComFallback — canal push (TICKET-056)', () => {
  it(
    'WhatsApp falha 3x e existe inscrição de push: cai pro push, não chega no e-mail',
    async () => {
      const cliente = await svc
        .from('clients')
        .insert({ tenant_id: tenantId, name: 'Cliente com push', phone_e164: '+5511988990077', user_id: usuarios[0]!, email: 'push@ciclo.test' })
        .select('id')
        .single()

      const inscricao = await svc
        .from('push_subscriptions')
        .insert({ tenant_id: tenantId, user_id: usuarios[0]!, endpoint: `https://push.exemplo.test/${randomUUID()}`, p256dh: 'x', auth: 'y' })
        .select('id')
        .single()

      const enviarPushFake = vi.fn(async () => ({ providerId: 'push.fake.1' }))
      const { provider } = providerQueFalhaNVezes(5)

      const resultado = await enviarComFallback(svc, entradaBase({ clientId: cliente.data!.id }), provider, enviarPushFake)

      expect(resultado).toMatchObject({ channel: 'push', status: 'sent', providerId: 'push.fake.1' })
      expect(enviarPushFake).toHaveBeenCalledTimes(1)

      await svc.from('push_subscriptions').delete().eq('id', inscricao.data!.id)
    },
    30_000,
  )

  it(
    'inscrição morta (404/410): apaga a linha e ainda cai pro e-mail',
    async () => {
      const cliente = await svc
        .from('clients')
        .insert({ tenant_id: tenantId, name: 'Cliente com push morto', phone_e164: '+5511988990078', user_id: usuarios[0]! })
        .select('id')
        .single()

      const inscricao = await svc
        .from('push_subscriptions')
        .insert({ tenant_id: tenantId, user_id: usuarios[0]!, endpoint: `https://push.exemplo.test/${randomUUID()}`, p256dh: 'x', auth: 'y' })
        .select('id')
        .single()

      const enviarPushFake = vi.fn(async () => {
        throw new ErroDeEnvio('inscrição morta', 'template_rejeitado')
      })
      const { provider } = providerQueFalhaNVezes(5)

      const resultado = await enviarComFallback(svc, entradaBase({ clientId: cliente.data!.id }), provider, enviarPushFake)

      // Sem e-mail configurado neste ambiente de teste, o resultado final ainda é falha —
      // o que importa aqui é que a inscrição morta some, não o canal final.
      expect(resultado.status).toBe('failed')

      const sobrou = await svc.from('push_subscriptions').select('id').eq('id', inscricao.data!.id).maybeSingle()
      expect(sobrou.data).toBeNull()
    },
    30_000,
  )


  it(
    'tenant de demonstração: não chama o provider e grava messages como demo-simulado',
    async () => {
      const provider = providerQueSempreFunciona()
      const resultado = await enviarComFallback(
        svc,
        entradaBase({ tenantId: tenantDemoId, clientId: clientDemoId, whatsappTo: '+5511988990002' }),
        provider,
      )

      expect(provider.sendTemplate).not.toHaveBeenCalled()
      expect(resultado).toMatchObject({ channel: 'whatsapp', status: 'sent', providerId: 'demo-simulado' })

      const linha = await svc
        .from('messages')
        .select('status, provider_id')
        .eq('client_id', clientDemoId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      expect(linha.data).toMatchObject({ status: 'sent', provider_id: 'demo-simulado' })
    },
    30_000,
  )
})
