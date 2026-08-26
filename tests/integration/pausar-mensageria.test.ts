import { randomUUID } from 'node:crypto'

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { afterAll, describe, expect, it } from 'vitest'

import { criarProfissional } from '@/server/services/profissionais'
import { criarServico } from '@/server/services/servicos'
import { identificarLembretesPendentes } from '@/server/services/lembretes'
import { executarOnboarding } from '@/server/services/onboarding'
import { atualizarTenant, lerTenant } from '@/server/services/site'

import type { Database } from '@/server/db/types.gen'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error('O teste do interruptor de mensageria precisa de NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local.')
}

const svc = createClient<Database>(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })

const TZ = 'America/Sao_Paulo'
const tenants: string[] = []
const usuarios: string[] = []

async function criarTenant(nome: string) {
  const marca = randomUUID().slice(0, 8)
  const { data, error } = await svc.auth.admin.createUser({
    email: `pausar-msg-${marca}@ciclo.test`,
    password: randomUUID(),
    email_confirm: true,
  })
  if (error || !data.user) throw new Error(`seed falhou: ${error?.message}`)
  usuarios.push(data.user.id)

  const slug = `pausar-msg-${marca}`
  const { tenant } = await executarOnboarding(svc, { userId: data.user.id, businessName: nome, vertical: 'barber', slug, timezone: TZ })
  tenants.push(tenant.id)
  return tenant.id
}

afterAll(async () => {
  for (const t of tenants) await svc.from('tenants').delete().eq('id', t)
  for (const u of usuarios) await svc.auth.admin.deleteUser(u)
}, 60_000)

/**
 * F0 (`docs/25-ESTRATEGIA-E-EXECUCAO.md`): interruptor manual por tenant, contra o banco de
 * verdade — mesmo namespace `settings.messaging` que `settings.site` já usava, e a mesma classe
 * de bug que quase existiu na escrita: atualizar SÓ um dos dois não pode apagar o outro.
 */
describe('interruptor de mensageria — settings.messaging, contra o banco real', () => {
  it(
    'liga o interruptor e o lê de volta',
    async () => {
      const tenantId = await criarTenant('Barbearia do Interruptor')

      expect((await lerTenant(svc, tenantId)).messaging.paused).toBe(false)

      await atualizarTenant(svc, tenantId, { messaging: { paused: true } })
      expect((await lerTenant(svc, tenantId)).messaging.paused).toBe(true)

      await atualizarTenant(svc, tenantId, { messaging: { paused: false } })
      expect((await lerTenant(svc, tenantId)).messaging.paused).toBe(false)
    },
    30_000,
  )

  it(
    'atualizar SÓ o site não apaga um messaging.paused já gravado (e vice-versa)',
    async () => {
      const tenantId = await criarTenant('Barbearia dos Dois Namespaces')

      await atualizarTenant(svc, tenantId, { messaging: { paused: true } })
      await atualizarTenant(svc, tenantId, { site: { accent: '#2563eb' } })

      const depois = await lerTenant(svc, tenantId)
      expect(depois.messaging.paused).toBe(true)
      expect(depois.site.accent).toBe('#2563eb')

      await atualizarTenant(svc, tenantId, { messaging: { paused: false } })
      const final = await lerTenant(svc, tenantId)
      expect(final.messaging.paused).toBe(false)
      expect(final.site.accent).toBe('#2563eb')
    },
    30_000,
  )

  it(
    'tenant pausado não aparece em identificarLembretesPendentes, mesmo com agendamento elegível',
    async () => {
      const tenantId = await criarTenant('Barbearia Pausada')
      await atualizarTenant(svc, tenantId, { messaging: { paused: true } })

      const profissional = await criarProfissional(svc, tenantId, {
        displayName: 'Barbeiro Pausado',
        compModel: 'owner',
        commissionBps: 0,
        rentCents: 0,
        acceptsOnline: true,
      })
      const servico = await criarServico(svc, tenantId, {
        name: 'Corte do Interruptor',
        description: null,
        durationMin: 30,
        bufferBeforeMin: 0,
        bufferAfterMin: 0,
        priceCents: 4_000,
        pricingModel: 'fixed',
        cycleDays: 21,
        depositBps: 0,
        depositMinCents: 0,
        parallelCapacity: 1,
        requiresAnamnesis: false,
        bookableOnline: true,
        categoryId: null,
      })
      const cliente = await svc
        .from('clients')
        .insert({ tenant_id: tenantId, name: 'Cliente da Barbearia Pausada', phone_e164: '+5511988990033' })
        .select('id')
        .single()

      // Datas fixas, distantes (nunca "agora" de verdade) — mesmo padrão de `lembretes.test.ts`:
      // o teste não pode depender da hora em que roda pra decidir se D-1 18h já passou.
      const startsAt = '2026-11-10T14:00:00-03:00' // terça, 14h
      const depoisDaConfirmacao = '2026-11-09T19:00:00-03:00' // D-1 19h: já passou das 18h

      const ag = await svc
        .from('appointments')
        .insert({
          tenant_id: tenantId,
          client_id: cliente.data!.id,
          professional_id: profissional.id,
          service_id: servico.id,
          starts_at: startsAt,
          ends_at: new Date(new Date(startsAt).getTime() + 1_800_000).toISOString(),
          status: 'pending',
          price_cents: 4_000,
        })
        .select('id')
        .single()

      const pendentes = await identificarLembretesPendentes(svc, depoisDaConfirmacao)
      expect(pendentes.find((p) => p.appointmentId === ag.data!.id)).toBeUndefined()

      // Confirma que o motivo é o interruptor, não outra coisa: religando, o mesmo agendamento aparece.
      await atualizarTenant(svc, tenantId, { messaging: { paused: false } })
      const pendentesDepois = await identificarLembretesPendentes(svc, depoisDaConfirmacao)
      expect(pendentesDepois.find((p) => p.appointmentId === ag.data!.id && p.kind === 'confirmation')).toBeTruthy()
    },
    30_000,
  )
})
