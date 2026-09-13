import { randomUUID } from 'node:crypto'

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { executarOnboarding } from '@/server/services/onboarding'
import { expirarGracaVencida, iniciarAssinatura } from '@/server/services/assinatura-mp'

import type { Database } from '@/server/db/types.gen'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error('Este teste precisa de NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local.')
}

// A ida à API do MP é mockada no nível do módulo — `criarPreapproval` é o único ponto de I/O que
// `iniciarAssinatura` chama. `assinatura-mp.test.ts` (o webhook) injeta as funções por parâmetro
// em vez de mockar o módulo; aqui não dá porque `iniciarAssinatura` não recebe injeção — arquivo
// separado evita os dois estilos de mock colidirem no mesmo módulo.
const mpMock = vi.hoisted(() => ({ criarPreapproval: vi.fn() }))
vi.mock('@/server/billing/mercado-pago', () => mpMock)

const svc = createClient<Database>(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })

/**
 * Reconciliação de `docs/63-AUDITORIA-PENDENCIAS-2026-09-13.md`: `iniciarAssinatura` (o lado que
 * CRIA a assinatura) e `expirarGracaVencida` (o cron que a derruba sozinha) tinham sido escritos
 * no PR #91/#94, mas ficaram presos num branch que nunca chegou em `main`. `processarWebhookMP`
 * (o lado que CONFIRMA o pagamento, #122) já tinha teste próprio; faltava o resto do ciclo.
 */
let tenantId: string
const tenants: string[] = []
const usuarios: string[] = []

beforeAll(async () => {
  const marca = randomUUID().slice(0, 8)
  const { data, error } = await svc.auth.admin.createUser({
    email: `assinar-${marca}@ciclo.test`,
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
    slug: `assinar-${marca}`,
    timezone: 'America/Sao_Paulo',
  })
  tenantId = tenant.id
  tenants.push(tenantId)
}, 60_000)

beforeEach(async () => {
  vi.clearAllMocks()
  const { data } = await svc.from('tenants').select('settings').eq('id', tenantId).single()
  const settings = { ...((data!.settings ?? {}) as Record<string, unknown>) }
  delete settings.assinatura
  await svc
    .from('tenants')
    .update({ plan: 'gratis', settings: settings as Database['public']['Tables']['tenants']['Update']['settings'] })
    .eq('id', tenantId)
})

afterEach(() => vi.useRealTimers())

afterAll(async () => {
  for (const t of tenants) await svc.from('tenants').delete().eq('id', t)
  for (const u of usuarios) await svc.auth.admin.deleteUser(u)
}, 60_000)

async function planoEAssinatura() {
  const { data } = await svc.from('tenants').select('plan, settings').eq('id', tenantId).single()
  const s = (data!.settings ?? {}) as { assinatura?: Record<string, unknown> }
  return { plan: data!.plan, assinatura: s.assinatura }
}

describe('iniciarAssinatura — a intenção de assinar', () => {
  it(
    'grava status pending e NÃO mexe no plano — quem entrega o degrau é o webhook',
    async () => {
      mpMock.criarPreapproval.mockResolvedValueOnce({ preapprovalId: 'pre-1', initPoint: 'https://mp.test/pre-1' })

      const r = await iniciarAssinatura(svc, tenantId, 'equipe', 'dona@salao.test', 'https://seuciclo.com.br/x')

      expect(r.initPoint).toBe('https://mp.test/pre-1')
      const { plan, assinatura } = await planoEAssinatura()
      expect(plan, 'iniciar não é pagar — o plano só muda quando o MP confirma').toBe('gratis')
      expect(assinatura).toMatchObject({ status: 'pending', plano_contratado: 'equipe', preapproval_id: 'pre-1' })
    },
    30_000,
  )

  it(
    'preserva o resto de tenants.settings — não é dono exclusivo do jsonb',
    async () => {
      await svc.from('tenants').update({ settings: { taxas: { pix_bps: 99 } } }).eq('id', tenantId)
      mpMock.criarPreapproval.mockResolvedValueOnce({ preapprovalId: 'pre-2', initPoint: 'https://mp.test/pre-2' })

      await iniciarAssinatura(svc, tenantId, 'essencial', 'dona@salao.test', 'https://seuciclo.com.br/x')

      const { data } = await svc.from('tenants').select('settings').eq('id', tenantId).single()
      expect((data!.settings as Record<string, unknown>).taxas).toEqual({ pix_bps: 99 })
    },
    30_000,
  )
})

describe('expirarGracaVencida — o cron que derruba sozinho quem passou da graça', () => {
  it(
    'paused com graca_ate no passado cai pro gratis',
    async () => {
      await svc
        .from('tenants')
        .update({
          plan: 'equipe',
          settings: {
            assinatura: {
              provedor: 'mercado_pago',
              preapproval_id: 'pre-3',
              plano_contratado: 'equipe',
              status: 'paused',
              atualizado_em: new Date().toISOString(),
              graca_ate: new Date(Date.now() - 86_400_000).toISOString(), // ontem
            },
          },
        })
        .eq('id', tenantId)

      const derrubados = await expirarGracaVencida(svc)

      expect(derrubados).toBeGreaterThanOrEqual(1)
      const { plan, assinatura } = await planoEAssinatura()
      expect(plan).toBe('gratis')
      expect(assinatura?.graca_ate).toBeNull()
    },
    30_000,
  )

  it(
    'paused com graca_ate no futuro NÃO é tocado — a graça ainda vale',
    async () => {
      const futuro = new Date(Date.now() + 6 * 86_400_000).toISOString()
      await svc
        .from('tenants')
        .update({
          plan: 'avancado',
          settings: {
            assinatura: {
              provedor: 'mercado_pago',
              preapproval_id: 'pre-4',
              plano_contratado: 'avancado',
              status: 'paused',
              atualizado_em: new Date().toISOString(),
              graca_ate: futuro,
            },
          },
        })
        .eq('id', tenantId)

      await expirarGracaVencida(svc)

      const { plan } = await planoEAssinatura()
      expect(plan, 'graça no futuro não pode ser derrubada — o aviso na tela prometeu a data').toBe('avancado')
    },
    30_000,
  )

  it(
    'authorized não é tocado, mesmo sem graca_ate',
    async () => {
      await svc
        .from('tenants')
        .update({
          plan: 'essencial',
          settings: {
            assinatura: {
              provedor: 'mercado_pago',
              preapproval_id: 'pre-5',
              plano_contratado: 'essencial',
              status: 'authorized',
              atualizado_em: new Date().toISOString(),
              graca_ate: null,
            },
          },
        })
        .eq('id', tenantId)

      await expirarGracaVencida(svc)

      const { plan } = await planoEAssinatura()
      expect(plan).toBe('essencial')
    },
    30_000,
  )
})
