import { randomUUID } from 'node:crypto'

import { Temporal } from '@js-temporal/polyfill'

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

      // No fuso do SALÃO. Com `new Date().toISOString()` este teste ficava vermelho entre 00h e
      // 03h UTC — que é justamente a janela do defeito que o extrato passou a tratar.
      const hoje = Temporal.Now.plainDateISO(TZ).toString()
      const extrato = await extratoDeComissao(svc, tenantId, professionalId, TZ, hoje, hoje)

      expect(extrato.items).toHaveLength(1)
      expect(extrato.items[0]!.commissionCents).toBe(5_000)
      expect(extrato.totalCents).toBe(extrato.items.reduce((s, i) => s + i.commissionCents, 0))

      await svc.from('professionals').update({ commission_bps: 1_000 }).eq('id', professionalId)

      const extratoDeNovo = await extratoDeComissao(svc, tenantId, professionalId, TZ, hoje, hoje)
      expect(extratoDeNovo.totalCents).toBe(5_000) // continua o valor congelado, não recalcula com o novo percentual
    },
    30_000,
  )

  it(
    'comanda fechada fora do período pedido não entra no extrato',
    async () => {
      await fecharComandaDoProfissional()

      const extratoDeOutroDia = await extratoDeComissao(svc, tenantId, professionalId, TZ, '2020-01-01', '2020-01-31')
      expect(extratoDeOutroDia.items).toHaveLength(0)
      expect(extratoDeOutroDia.totalCents).toBe(0)
    },
    30_000,
  )
})


/**
 * Achado da auditoria de 2026-08-28. O extrato filtrava por
 * `closed_at >= '{desde}T00:00:00Z'` e `<= '{ate}T23:59:59Z'` — dia em UTC, e fim de dia por
 * `23:59:59`. Em Brasília, toda comanda fechada depois das 21h cai no dia seguinte em UTC: no
 * fechamento do mês ela sumia do mês trabalhado e reaparecia no seguinte. E o extrato aparece na
 * MESMA TELA que o caixa (`admin/caixa/page.tsx`), que já contava certo desde o TICKET-047 —
 * dois números do mesmo mês, lado a lado, contando dias diferentes.
 */
describe('o extrato conta o dia no fuso do salão', () => {
  it(
    'comanda fechada às 22h de Brasília pertence ao dia local, não ao dia seguinte em UTC',
    async () => {
      const fechada = await fecharComandaDoProfissional()

      // 2026-03-10 22:30 em São Paulo = 2026-03-11 01:30 UTC. O `closed_at` é reescrito à mão
      // porque `fecharComanda` carimba `now()` — o que importa aqui é o instante, não o caminho.
      const instante = Temporal.ZonedDateTime.from({ year: 2026, month: 3, day: 10, hour: 22, minute: 30, timeZone: TZ }).toInstant().toString()
      await svc.from('tickets').update({ closed_at: instante }).eq('id', fechada.id)

      const noDiaLocal = await extratoDeComissao(svc, tenantId, professionalId, TZ, '2026-03-10', '2026-03-10')
      expect(noDiaLocal.items, 'a comissão sumiu do dia em que o trabalho aconteceu').toHaveLength(1)
      expect(noDiaLocal.totalCents).toBe(5_000)

      const noDiaSeguinte = await extratoDeComissao(svc, tenantId, professionalId, TZ, '2026-03-11', '2026-03-11')
      expect(noDiaSeguinte.items, 'a comissão apareceu no dia seguinte — é o defeito de volta').toHaveLength(0)

      // E o mês fecha com ela dentro, que é o número que vira pagamento.
      const noMes = await extratoDeComissao(svc, tenantId, professionalId, TZ, '2026-03-01', '2026-03-31')
      expect(noMes.totalCents).toBe(5_000)
    },
    30_000,
  )

  it(
    'o último instante do dia entra no período — `23:59:59` deixava uma fresta sem dono',
    async () => {
      const fechada = await fecharComandaDoProfissional()

      // 23:59:59.500 local: com o corte antigo (`<= 23:59:59Z`), este instante não entrava neste
      // dia nem no seguinte, que começa em 00:00:00.
      const instante = Temporal.ZonedDateTime.from({
        year: 2026, month: 3, day: 10, hour: 23, minute: 59, second: 59, millisecond: 500, timeZone: TZ,
      }).toInstant().toString()
      await svc.from('tickets').update({ closed_at: instante }).eq('id', fechada.id)

      const noDia = await extratoDeComissao(svc, tenantId, professionalId, TZ, '2026-03-10', '2026-03-10')
      expect(noDia.items, 'meio segundo antes da meia-noite não pertencia a período nenhum').toHaveLength(1)
    },
    30_000,
  )
})
