import { randomUUID } from 'node:crypto'

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { definirExpediente } from '@/server/services/expediente'
import { executarOnboarding } from '@/server/services/onboarding'
import { criarProfissional } from '@/server/services/profissionais'
import { criarAgendamentoPublico, disponibilidadePublica } from '@/server/services/public-booking'
import { criarServico } from '@/server/services/servicos'

import type { Database } from '@/server/db/types.gen'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error('O teste do "Tanto faz" precisa de NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local.')
}

const svc = createClient<Database>(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
const TZ = 'America/Sao_Paulo'
let slug: string
let tenantId: string
let servicoId: string
const tenants: string[] = []
const usuarios: string[] = []

/** Próxima terça: o expediente deste salão é só de terça, das 09:00 às 22:00 — o horário das 21:00 existe. */
function proximaTerca(): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + 1)
  while (d.getUTCDay() !== 2) d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}
const DIA = proximaTerca()

beforeAll(async () => {
  const marca = randomUUID().slice(0, 8)
  const { data, error } = await svc.auth.admin.createUser({ email: `tantofaz-${marca}@ciclo.test`, password: randomUUID(), email_confirm: true, user_metadata: { full_name: 'Dona da Noite' } })
  if (error || !data.user) throw new Error(`seed falhou: ${error?.message}`)
  usuarios.push(data.user.id)
  slug = `tantofaz-${marca}`
  const { tenant } = await executarOnboarding(svc, { userId: data.user.id, businessName: 'Salão da Noite', vertical: 'nails', slug, timezone: TZ })
  tenantId = tenant.id
  tenants.push(tenantId)
  const profissional = await criarProfissional(svc, tenantId, { displayName: 'Quem Atende à Noite', compModel: 'owner', commissionBps: 0, rentCents: 0, acceptsOnline: true })
  const servico = await criarServico(svc, tenantId, {
    name: 'Design da Noite',
    description: null,
    durationMin: 30,
    bufferBeforeMin: 0,
    bufferAfterMin: 0,
    priceCents: 6_000,
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
  await definirExpediente(svc, tenantId, { professionalId: profissional.id, blocos: [{ weekday: 2, opensAt: '09:00', closesAt: '22:00' }] })
  await svc.from('rate_limits').delete().like('key', 'book:%')
}, 60_000)

afterAll(async () => {
  await svc.from('rate_limits').delete().like('key', 'book:%')
  for (const t of tenants) await svc.from('tenants').delete().eq('id', t)
  for (const u of usuarios) await svc.auth.admin.deleteUser(u)
}, 60_000)

describe('"Tanto faz" às 21h de Brasília (APR-223)', () => {
  it(
    'o horário das 21:00 (já é amanhã em UTC) é achado no dia certo e o pedido entra',
    async () => {
      // Hipótese R-33 reproduzida por leitura: o dia vinha de `startsAt.slice(0, 10)` (UTC). 21:00-03:00 = 00:00Z do dia seguinte.
      // A página manda o `startsAt` exatamente como a disponibilidade o entregou (comparação por texto).
      const slots = await disponibilidadePublica(slug, servicoId, DIA)
      const alvo = new Date(`${DIA}T21:00:00-03:00`).getTime()
      const das21 = slots.find((s) => new Date(s.startsAt).getTime() === alvo)
      expect(das21, `o dia ${DIA} não ofereceu as 21:00: ${slots.map((s) => s.startsAt).slice(-3).join(', ')}`).toBeTruthy()
      const resultado = await criarAgendamentoPublico(slug, {
        serviceId: servicoId,
        professionalId: null,
        startsAt: das21!.startsAt,
        name: 'Cliente da Noite',
        phone: `119${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`,
      })
      const linha = await svc.from('appointments').select('status, starts_at').eq('id', resultado.appointmentId).single()
      // docs/114 AGD-01 (decisão do Vitor, 21/10): o que vem do link nasce confirmado.
      expect(linha.data?.status).toBe('confirmed')
      expect(new Date(linha.data!.starts_at).toISOString()).toBe(new Date(`${DIA}T21:00:00-03:00`).toISOString())
    },
    30_000,
  )
})
