import { randomUUID } from 'node:crypto'

import { Temporal } from '@js-temporal/polyfill'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { fechamentoDiario, resumoMensal } from '@/server/services/caixa'
import { adicionarItemComanda, atualizarDescontoEGorjeta, cancelarComandaFechada, fecharComanda } from '@/server/services/comanda'
import { fichaDoCliente } from '@/server/services/crm'
import { executarOnboarding } from '@/server/services/onboarding'
import { resumoDeHoje } from '@/server/services/resumo-hoje'

import type { Database } from '@/server/db/types.gen'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) throw new Error('O teste do "Entrou" precisa de NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local.')

const svc = createClient<Database>(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
const TZ = 'America/Sao_Paulo'

/*
 * APR-036a/b (achados C-26, G-28): o cenário único do plano — corte de R$ 100, −R$ 10 de desconto,
 * +R$ 5 de gorjeta. As telas mostravam R$ 100 (Hoje), 95, 90 e 85; e o estorno mudava o Caixa e não
 * a Hoje. Agora Hoje, Caixa do dia e Mês dizem o mesmo, e o estorno muda os três juntos.
 */
let tenantId: string
const usuarios: string[] = []

beforeAll(async () => {
  const marca = randomUUID().slice(0, 8)
  const { data } = await svc.auth.admin.createUser({ email: `apr036-${marca}@ciclo.test`, password: randomUUID(), email_confirm: true })
  usuarios.push(data.user!.id)
  const { tenant } = await executarOnboarding(svc, { userId: data.user!.id, businessName: 'Entrou', vertical: 'barber', slug: `apr036-${marca}`, timezone: TZ })
  tenantId = tenant.id
}, 60_000)

afterAll(async () => {
  await svc.from('tenants').delete().eq('id', tenantId)
  for (const u of usuarios) await svc.auth.admin.deleteUser(u)
}, 60_000)

describe('"quanto entrou" é um número só (APR-036a)', () => {
  it(
    'Hoje, Caixa do dia e Mês dizem R$ 95,00; depois do estorno, os três dizem zero',
    async () => {
      const servico = (await svc.from('services').select('id').eq('tenant_id', tenantId).limit(1).single()).data!.id
      const profissional = (await svc.from('professionals').select('id').eq('tenant_id', tenantId).limit(1).single()).data!.id
      const cliente = (await svc.from('clients').insert({ tenant_id: tenantId, name: 'Cliente do Cenário' }).select('id').single()).data!.id
      const ticket = (await svc.from('tickets').insert({ tenant_id: tenantId, client_id: cliente, professional_id: profissional }).select('id').single()).data!.id
      await adicionarItemComanda(svc, tenantId, ticket, { serviceId: servico, professionalId: profissional, qty: 1, unitPriceCents: 10_000, discountCents: 0 })
      await atualizarDescontoEGorjeta(svc, tenantId, ticket, { discountCents: 1_000, tipCents: 500 })
      await fecharComanda(svc, tenantId, ticket, 'pix')

      const hoje = Temporal.Now.zonedDateTimeISO(TZ).toPlainDate()
      const mes = hoje.toString().slice(0, 7)
      const telas = async () => ({
        hoje: (await resumoDeHoje(svc, tenantId, TZ)).numeroDoDia,
        caixa: (await fechamentoDiario(svc, tenantId, TZ, hoje.toString())).revenueCents,
        mes: (await resumoMensal(svc, tenantId, TZ, mes)).revenueCents,
        ficha: (await fichaDoCliente(svc, tenantId, cliente, TZ, { podeVerLucro: false })).metricas.valorDaFicha,
      })

      expect(await telas()).toEqual({ hoje: { rotulo: 'Entrou hoje', cents: 9_500 }, caixa: 9_500, mes: 9_500, ficha: { rotulo: 'Entrou', cents: 9_500 } })

      await cancelarComandaFechada(svc, tenantId, ticket)
      expect(await telas()).toEqual({ hoje: { rotulo: 'Entrou hoje', cents: 0 }, caixa: 0, mes: 0, ficha: { rotulo: 'Entrou', cents: 0 } })
    },
    60_000,
  )

  it(
    'negócio que não usa comanda continua vendo "Atendido hoje", não R$ 0,00',
    async () => {
      const marca = randomUUID().slice(0, 8)
      const { data } = await svc.auth.admin.createUser({ email: `apr036b-${marca}@ciclo.test`, password: randomUUID(), email_confirm: true })
      usuarios.push(data.user!.id)
      const { tenant } = await executarOnboarding(svc, { userId: data.user!.id, businessName: 'Sem Comanda', vertical: 'barber', slug: `apr036b-${marca}`, timezone: TZ })
      try {
        const servico = (await svc.from('services').select('id').eq('tenant_id', tenant.id).limit(1).single()).data!.id
        const profissional = (await svc.from('professionals').select('id').eq('tenant_id', tenant.id).limit(1).single()).data!.id
        const cliente = (await svc.from('clients').insert({ tenant_id: tenant.id, name: 'Só Concluiu' }).select('id').single()).data!.id
        const inicio = new Date(Date.now() - 2 * 3_600_000)
        await svc.from('appointments').insert({
          tenant_id: tenant.id,
          client_id: cliente,
          professional_id: profissional,
          service_id: servico,
          starts_at: inicio.toISOString(),
          ends_at: new Date(inicio.getTime() + 3_600_000).toISOString(),
          status: 'done',
          price_cents: 7_000,
        })
        const r = await resumoDeHoje(svc, tenant.id, TZ)
        // Antes das 2h da manhã do fuso, "hoje" pode não ter o horário de 2h atrás; o rótulo vale sempre.
        expect(r.numeroDoDia.rotulo).toBe('Atendido hoje')
        expect(r.numeroDoDia.cents).toBe(r.revenueTodayCents)
      } finally {
        await svc.from('tenants').delete().eq('id', tenant.id)
      }
    },
    60_000,
  )
})
