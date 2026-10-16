import { randomUUID } from 'node:crypto'

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { disponibilidadeDoPainel } from '@/server/services/disponibilidade'
import { definirExpediente } from '@/server/services/expediente'
import { executarOnboarding } from '@/server/services/onboarding'
import { criarProfissional } from '@/server/services/profissionais'
import { disponibilidadePublica } from '@/server/services/public-booking'
import { criarServico } from '@/server/services/servicos'

import type { Database } from '@/server/db/types.gen'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error('O teste de disponibilidade precisa de NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local.')
}
const svc = createClient<Database>(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })

/**
 * APR-110a: o "Marcar" do painel e o agendar público calculam os horários livres pela MESMA função.
 * Esta paridade é o que impede as duas telas de divergirem com as duas suítes verdes (memória
 * "Duas cópias da mesma fórmula").
 *
 * O cenário é montado aqui, não lido do seed de demonstração: a primeira versão procurava o
 * `demo-dom-estilo`, que só existe no banco de quem rodou os seeds à mão. Na CI ele não existe, e as
 * duas asserções caíam em `null` (PR #152).
 */
let tenantId: string
let slug: string
let servicoId: string
let profissionalA: string
let profissionalB: string
const usuarios: string[] = []

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
    email: `disponibilidade-${marca}@ciclo.test`,
    password: randomUUID(),
    email_confirm: true,
    user_metadata: { full_name: 'Dona da Agenda' },
  })
  if (error || !data.user) throw new Error(`seed falhou: ${error?.message}`)
  usuarios.push(data.user.id)

  slug = `disponibilidade-${marca}`
  const { tenant } = await executarOnboarding(svc, {
    userId: data.user.id,
    businessName: 'Agenda de Teste',
    vertical: 'brows',
    slug,
    timezone: 'America/Sao_Paulo',
  })
  tenantId = tenant.id

  const base = { compModel: 'owner' as const, commissionBps: 0, rentCents: 0, acceptsOnline: true }
  profissionalA = (await criarProfissional(svc, tenantId, { ...base, displayName: 'Profissional A' })).id
  profissionalB = (await criarProfissional(svc, tenantId, { ...base, displayName: 'Profissional B' })).id

  servicoId = (
    await criarServico(svc, tenantId, {
      name: 'Design de teste',
      description: null,
      durationMin: 30,
      bufferBeforeMin: 0,
      bufferAfterMin: 0,
      priceCents: 6000,
      pricingModel: 'fixed',
      cycleDays: 21,
      depositBps: 0,
      depositMinCents: 0,
      parallelCapacity: 1,
      requiresAnamnesis: false,
      bookableOnline: true,
      categoryId: null,
    })
  ).id

  for (const professionalId of [profissionalA, profissionalB]) {
    await definirExpediente(svc, tenantId, { professionalId, blocos: [{ weekday: 2, opensAt: '09:00', closesAt: '12:00' }] })
  }
}, 60_000)

afterAll(async () => {
  if (tenantId) await svc.from('tenants').delete().eq('id', tenantId)
  for (const u of usuarios) await svc.auth.admin.deleteUser(u)
}, 60_000)

describe('horários livres: painel e público pela mesma conta', () => {
  it('para um serviço agendável online, o painel devolve exatamente os horários do público', async () => {
    const publico = await disponibilidadePublica(slug, servicoId, DIA)
    const painel = await disponibilidadeDoPainel(svc, tenantId, { serviceId: servicoId, date: DIA })
    // O público só agrega profissionais com atendimento online; o painel, todos os ativos. Comparar o
    // subconjunto do público, que tem que estar inteiro no painel, horário por horário.
    const chave = (s: { startsAt: string; professionalId: string }) => `${s.startsAt}|${s.professionalId}`
    const doPainel = new Set(painel.map(chave))
    expect(publico.length, 'o cenário precisa ter horário livre, senão a paridade passa no vazio').toBeGreaterThan(0)
    for (const s of publico) expect(doPainel.has(chave(s)), `${chave(s)} está no público e não no painel`).toBe(true)
  }, 30_000)

  it('com profissional escolhido, só a agenda dele; serviço inexistente é recusado com motivo', async () => {
    const so = await disponibilidadeDoPainel(svc, tenantId, { serviceId: servicoId, date: DIA, professionalId: profissionalA })
    expect(so.length, 'o profissional A tem expediente na terça: a lista não pode vir vazia').toBeGreaterThan(0)
    expect(so.every((s) => s.professionalId === profissionalA)).toBe(true)
    const todos = await disponibilidadeDoPainel(svc, tenantId, { serviceId: servicoId, date: DIA })
    expect(todos.some((s) => s.professionalId === profissionalB), 'sem filtro, a agenda do B aparece').toBe(true)
    await expect(disponibilidadeDoPainel(svc, tenantId, { serviceId: '00000000-0000-4000-8000-000000000000', date: DIA })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
  }, 30_000)
})
