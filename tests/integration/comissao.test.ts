import { randomUUID } from 'node:crypto'

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { criarProfissional } from '@/server/services/profissionais'
import { criarServico } from '@/server/services/servicos'
import { executarOnboarding } from '@/server/services/onboarding'
import { adicionarItemComanda, fecharComanda } from '@/server/services/comanda'
import { extratoDeComissao } from '@/server/services/comissao'

import type { Database } from '@/server/db/types.gen'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error('O teste de comissão precisa de NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local.')
}

const svc = createClient<Database>(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })

const TZ = 'America/Sao_Paulo'
let tenantId: string
let professionalId: string
let servicoId: string
const tenants: string[] = []
const usuarios: string[] = []

beforeAll(async () => {
  const marca = randomUUID().slice(0, 8)
  const { data, error } = await svc.auth.admin.createUser({
    email: `comissao-${marca}@ciclo.test`,
    password: randomUUID(),
    email_confirm: true,
    user_metadata: { full_name: 'Dona da Comissão' },
  })
  if (error || !data.user) throw new Error(`seed falhou: ${error?.message}`)
  usuarios.push(data.user.id)

  const { tenant } = await executarOnboarding(svc, {
    userId: data.user.id,
    businessName: 'Salão da Comissão',
    vertical: 'nails',
    slug: `comissao-${marca}`,
    timezone: TZ,
  })
  tenantId = tenant.id
  tenants.push(tenantId)

  const profissional = await criarProfissional(svc, tenantId, {
    displayName: 'Manicure',
    compModel: 'commission',
    commissionBps: 5_000, // 50%
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
    priceCents: 10_000,
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

async function fecharComandaDoProfissional() {
  const cliente = await svc.from('clients').insert({ tenant_id: tenantId, name: `Cliente ${randomUUID().slice(0, 6)}` }).select('id').single()
  const ticket = await svc.from('tickets').insert({ tenant_id: tenantId, client_id: cliente.data!.id, professional_id: professionalId }).select('id').single()
  const ticketId = ticket.data!.id
  await adicionarItemComanda(svc, tenantId, ticketId, { serviceId: servicoId, professionalId, qty: 1, discountCents: 0 })
  return fecharComanda(svc, tenantId, ticketId)
}

describe('extratoDeComissao', () => {
  it(
    'soma das linhas do extrato bate com o totalCents, e mudar o percentual depois não altera o extrato de um período já fechado',
    async () => {
      await fecharComandaDoProfissional() // 50% de 10.000 = 5.000

      const hoje = new Date().toISOString().slice(0, 10)
      const extrato = await extratoDeComissao(svc, tenantId, professionalId, hoje, hoje)

      expect(extrato.items).toHaveLength(1)
      expect(extrato.items[0]!.commissionCents).toBe(5_000)
      expect(extrato.totalCents).toBe(extrato.items.reduce((s, i) => s + i.commissionCents, 0))

      await svc.from('professionals').update({ commission_bps: 1_000 }).eq('id', professionalId)

      const extratoDeNovo = await extratoDeComissao(svc, tenantId, professionalId, hoje, hoje)
      expect(extratoDeNovo.totalCents).toBe(5_000) // continua o valor congelado, não recalcula com o novo percentual
    },
    30_000,
  )

  it(
    'comanda fechada fora do período pedido não entra no extrato',
    async () => {
      await fecharComandaDoProfissional()

      const extratoDeOutroDia = await extratoDeComissao(svc, tenantId, professionalId, '2020-01-01', '2020-01-31')
      expect(extratoDeOutroDia.items).toHaveLength(0)
      expect(extratoDeOutroDia.totalCents).toBe(0)
    },
    30_000,
  )
})
