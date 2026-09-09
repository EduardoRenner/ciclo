import { randomUUID } from 'node:crypto'

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { executarOnboarding } from '@/server/services/onboarding'
import { aplicarEventoDeAssinatura, expirarGracaVencida, iniciarAssinatura } from '@/server/services/assinatura'

import type { Database } from '@/server/db/types.gen'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error('O teste de assinatura precisa de NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local.')
}

// A ida à API do MP é mockada no nível do módulo — o Supabase (que também usa fetch) fica intacto.
const mpMock = vi.hoisted(() => ({
  criarPreapproval: vi.fn(),
  consultarPreapproval: vi.fn(),
  consultarPagamento: vi.fn(),
}))
vi.mock('@/server/billing/mercado-pago', () => mpMock)

const svc = createClient<Database>(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })

let tenantId: string
const tenants: string[] = []
const usuarios: string[] = []

beforeAll(async () => {
  const marca = randomUUID().slice(0, 8)
  const { data, error } = await svc.auth.admin.createUser({
    email: `assinatura-${marca}@ciclo.test`,
    password: randomUUID(),
    email_confirm: true,
    user_metadata: { full_name: 'Dona da Assinatura' },
  })
  if (error || !data.user) throw new Error(`seed falhou: ${error?.message}`)
  usuarios.push(data.user.id)

  const { tenant } = await executarOnboarding(svc, {
    userId: data.user.id,
    businessName: 'Salão da Assinatura',
    vertical: 'nails',
    slug: `assinatura-${marca}`,
    timezone: 'America/Sao_Paulo',
  })
  tenantId = tenant.id
  tenants.push(tenantId)
}, 60_000)

afterEach(() => vi.clearAllMocks())

afterAll(async () => {
  for (const t of tenants) await svc.from('tenants').delete().eq('id', t)
  for (const u of usuarios) await svc.auth.admin.deleteUser(u)
}, 60_000)

async function planoEAssinatura() {
  const { data } = await svc.from('tenants').select('plan, settings').eq('id', tenantId).single()
  const s = (data!.settings ?? {}) as { assinatura?: Record<string, unknown> }
  return { plan: data!.plan, assinatura: s.assinatura }
}

async function iniciarComoPreapproval(preapprovalId: string, tier: 'essencial' | 'equipe' | 'avancado') {
  mpMock.criarPreapproval.mockResolvedValueOnce({ preapprovalId, initPoint: `https://mp.test/${preapprovalId}` })
  const r = await iniciarAssinatura(svc, tenantId, tier, 'dona@salao.test', 'https://seuciclo.com.br/x')
  expect(r.initPoint).toContain(preapprovalId)
}

describe('assinatura Mercado Pago — webhook → tenants.plan', () => {
  it('iniciar grava status pending e NÃO mexe no plano', async () => {
    await iniciarComoPreapproval('pa-1', 'equipe')
    const { plan, assinatura } = await planoEAssinatura()
    expect(plan).toBe('gratis')
    expect(assinatura).toMatchObject({ status: 'pending', plano_contratado: 'equipe', preapproval_id: 'pa-1' })
  })

  it('evento authorized com valor certo → plano vira o contratado', async () => {
    await iniciarComoPreapproval('pa-2', 'equipe')
    mpMock.consultarPreapproval.mockResolvedValueOnce({ status: 'authorized', externalReference: tenantId, valorAutorizado: 99 })

    const r = await aplicarEventoDeAssinatura(svc, { assunto: 'subscription', id: 'ev-1' })
    expect(r.resultado).toBe('aplicado')
    expect((await planoEAssinatura()).plan).toBe('equipe')
  })

  it('evento com valor ADULTERADO (R$ 1 para o avançado) → plano NÃO muda + auditoria', async () => {
    await iniciarComoPreapproval('pa-3', 'avancado')
    mpMock.consultarPreapproval.mockResolvedValueOnce({ status: 'authorized', externalReference: tenantId, valorAutorizado: 1 })

    const r = await aplicarEventoDeAssinatura(svc, { assunto: 'subscription', id: 'ev-2' })
    expect(r.resultado).toBe('ignorado')
    expect((await planoEAssinatura()).plan).toBe('gratis')

    const { data: trilha } = await svc.from('audit_log').select('action').eq('tenant_id', tenantId).eq('action', 'tenant.subscription.valor_divergente')
    expect(trilha!.length).toBeGreaterThan(0)
  })

  it('paused → mantém o degrau, grava graca_ate; expirar depois do prazo derruba pra gratis', async () => {
    await iniciarComoPreapproval('pa-4', 'essencial')
    mpMock.consultarPreapproval.mockResolvedValueOnce({ status: 'authorized', externalReference: tenantId, valorAutorizado: 49 })
    await aplicarEventoDeAssinatura(svc, { assunto: 'subscription', id: 'ev-3' })
    expect((await planoEAssinatura()).plan).toBe('essencial')

    mpMock.consultarPreapproval.mockResolvedValueOnce({ status: 'paused', externalReference: tenantId, valorAutorizado: 49 })
    await aplicarEventoDeAssinatura(svc, { assunto: 'subscription', id: 'ev-4' })
    const emGraca = await planoEAssinatura()
    expect(emGraca.plan).toBe('essencial')
    expect(emGraca.assinatura).toMatchObject({ status: 'paused' })
    expect((emGraca.assinatura as { graca_ate: string }).graca_ate).toBeTruthy()

    // ainda dentro do prazo: expirar não faz nada
    expect(await expirarGracaVencida(svc, new Date())).toBe(0)
    // 8 dias depois: derruba
    const derrubados = await expirarGracaVencida(svc, new Date(Date.now() + 8 * 86_400_000))
    expect(derrubados).toBeGreaterThan(0)
    expect((await planoEAssinatura()).plan).toBe('gratis')
  })

  it('evento repetido (mesmo id) é no-op', async () => {
    await iniciarComoPreapproval('pa-5', 'equipe')
    mpMock.consultarPreapproval.mockResolvedValue({ status: 'authorized', externalReference: tenantId, valorAutorizado: 99 })

    await aplicarEventoDeAssinatura(svc, { assunto: 'subscription', id: 'ev-mesmo' })
    const r2 = await aplicarEventoDeAssinatura(svc, { assunto: 'subscription', id: 'ev-mesmo' })
    expect(r2.motivo).toContain('repetido')
  })

  it('evento de um preapproval que o tenant não iniciou → ignorado + trilha de órfão', async () => {
    await iniciarComoPreapproval('pa-6', 'equipe')
    // o evento resolve para um preapproval (pa-OUTRO) que não é o que o tenant gravou (pa-6)
    mpMock.consultarPreapproval.mockResolvedValue({ status: 'authorized', externalReference: tenantId, valorAutorizado: 99 })
    const rOrfao = await aplicarEventoDeAssinatura(svc, { assunto: 'subscription', id: 'pa-OUTRO' })

    expect(rOrfao.resultado).toBe('ignorado')
    expect(rOrfao.motivo).toContain('não bate')
    const { data: trilha } = await svc
      .from('audit_log')
      .select('action')
      .eq('tenant_id', tenantId)
      .eq('action', 'tenant.subscription.evento_orfao')
    expect(trilha!.length).toBeGreaterThan(0)
  })
})
