import { randomUUID } from 'node:crypto'

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { executarOnboarding } from '@/server/services/onboarding'
import { cancelarAssinatura, expirarGracaVencida, iniciarAssinatura } from '@/server/services/assinatura-mp'

import type { Database } from '@/server/db/types.gen'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error('Este teste precisa de NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local.')
}

// A ida à API do MP é mockada no nível do módulo — `criarPreapproval`/`cancelarPreapproval` são os
// pontos de I/O que este arquivo chama. `assinatura-mp.test.ts` (o webhook) injeta as funções por
// parâmetro em vez de mockar o módulo; aqui não dá porque nenhuma das duas recebe injeção — arquivo
// separado evita os dois estilos de mock colidirem no mesmo módulo.
const mpMock = vi.hoisted(() => ({ criarPreapproval: vi.fn(), cancelarPreapproval: vi.fn(), consultarPreapproval: vi.fn(), consultarPagamento: vi.fn() }))
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

describe('cancelarAssinatura — quem nunca pagou cai na hora', () => {
  it(
    'cancela o preapproval no MP e derruba pra gratis sem esperar webhook',
    async () => {
      mpMock.criarPreapproval.mockResolvedValueOnce({ preapprovalId: 'pre-6', initPoint: 'https://mp.test/pre-6' })
      await iniciarAssinatura(svc, tenantId, 'equipe', 'dona@salao.test', 'https://seuciclo.com.br/x')
      // Simula o MP tendo autorizado (fora do escopo deste teste; só a assinatura já registrada importa aqui).

      mpMock.cancelarPreapproval.mockResolvedValueOnce(undefined)
      const r = await cancelarAssinatura(svc, tenantId)

      expect(r).toEqual({ resultado: 'cancelada', plano: 'gratis', acessoAte: null })
      expect(mpMock.cancelarPreapproval).toHaveBeenCalledWith('pre-6')
      const { plan, assinatura } = await planoEAssinatura()
      expect(plan).toBe('gratis')
      expect(assinatura?.status).toBe('cancelled')
    },
    30_000,
  )

  it(
    'sem assinatura registrada: não chama o MP, devolve sem_assinatura_ativa',
    async () => {
      const r = await cancelarAssinatura(svc, tenantId)
      expect(r).toEqual({ resultado: 'sem_assinatura_ativa' })
      expect(mpMock.cancelarPreapproval).not.toHaveBeenCalled()
    },
    30_000,
  )

  it(
    'cancelar de novo uma assinatura já cancelada é idempotente — não chama o MP outra vez',
    async () => {
      mpMock.criarPreapproval.mockResolvedValueOnce({ preapprovalId: 'pre-7', initPoint: 'https://mp.test/pre-7' })
      await iniciarAssinatura(svc, tenantId, 'essencial', 'dona@salao.test', 'https://seuciclo.com.br/x')
      mpMock.cancelarPreapproval.mockResolvedValueOnce(undefined)
      await cancelarAssinatura(svc, tenantId)

      mpMock.cancelarPreapproval.mockClear()
      const r2 = await cancelarAssinatura(svc, tenantId)

      expect(r2).toEqual({ resultado: 'sem_assinatura_ativa' })
      expect(mpMock.cancelarPreapproval).not.toHaveBeenCalled()
    },
    30_000,
  )
})

async function assinaturaAutorizada(plano: 'essencial' | 'equipe', preapprovalId: string) {
  await svc
    .from('tenants')
    .update({
      plan: plano,
      settings: {
        assinatura: { provedor: 'mercado_pago', preapproval_id: preapprovalId, plano_contratado: plano, status: 'authorized', atualizado_em: new Date().toISOString() },
      },
    })
    .eq('id', tenantId)
}

describe('cancelarAssinatura — quem JÁ pagou fica até o fim do período (Termos §6, docs/86 C7)', () => {
  const daquiA = (dias: number) => new Date(Date.now() + dias * 86_400_000).toISOString()

  it(
    'authorized: mantém o degrau, grava acesso_ate (o next_payment_date) e cancela no MP DEPOIS de ler a data',
    async () => {
      await assinaturaAutorizada('equipe', 'pre-pago-1')
      const proximo = daquiA(12)
      mpMock.consultarPreapproval.mockResolvedValueOnce({ status: 'authorized', externalReference: tenantId, valorAutorizado: 99, proximoPagamento: proximo })
      mpMock.cancelarPreapproval.mockResolvedValueOnce(undefined)

      const r = await cancelarAssinatura(svc, tenantId)

      expect(r).toEqual({ resultado: 'cancelada', plano: 'equipe', acessoAte: new Date(proximo).toISOString() })
      const { plan, assinatura } = await planoEAssinatura()
      expect(plan, 'pagou o mês: o degrau fica até o fim dele').toBe('equipe')
      expect(assinatura).toMatchObject({ status: 'cancelled', acesso_ate: new Date(proximo).toISOString() })
      // Depois de cancelar o MP deixa de informar a data: ler antes é obrigatório.
      expect(mpMock.consultarPreapproval.mock.invocationCallOrder[0]!).toBeLessThan(mpMock.cancelarPreapproval.mock.invocationCallOrder[0]!)
    },
    30_000,
  )

  it(
    'authorized, mas o MP não informa próxima cobrança (ou ela já passou): não há período pago, cai na hora',
    async () => {
      for (const proximoPagamento of [null, new Date(Date.now() - 86_400_000).toISOString()]) {
        await assinaturaAutorizada('essencial', 'pre-pago-2')
        mpMock.consultarPreapproval.mockResolvedValueOnce({ status: 'authorized', externalReference: tenantId, valorAutorizado: 49, proximoPagamento })
        mpMock.cancelarPreapproval.mockResolvedValueOnce(undefined)

        const r = await cancelarAssinatura(svc, tenantId)

        expect(r).toEqual({ resultado: 'cancelada', plano: 'gratis', acessoAte: null })
        expect((await planoEAssinatura()).plan).toBe('gratis')
      }
    },
    30_000,
  )

  it(
    'se a leitura da data falha, NÃO cancela: cortar o período pago às cegas é pior que pedir para tentar de novo',
    async () => {
      await assinaturaAutorizada('equipe', 'pre-pago-3')
      mpMock.consultarPreapproval.mockRejectedValueOnce(new Error('MP fora do ar'))

      await expect(cancelarAssinatura(svc, tenantId)).rejects.toThrow('MP fora do ar')

      expect(mpMock.cancelarPreapproval).not.toHaveBeenCalled()
      const { plan, assinatura } = await planoEAssinatura()
      expect(plan).toBe('equipe')
      expect(assinatura?.status, 'continua authorized: nada foi mudado').toBe('authorized')
    },
    30_000,
  )

  it(
    'paused (a cobrança falhava): não há período pago correndo, cai na hora e nem consulta a data',
    async () => {
      await svc
        .from('tenants')
        .update({
          plan: 'equipe',
          settings: { assinatura: { provedor: 'mercado_pago', preapproval_id: 'pre-pago-4', plano_contratado: 'equipe', status: 'paused', atualizado_em: new Date().toISOString(), graca_ate: daquiA(3) } },
        })
        .eq('id', tenantId)
      mpMock.cancelarPreapproval.mockResolvedValueOnce(undefined)

      const r = await cancelarAssinatura(svc, tenantId)

      expect(r).toEqual({ resultado: 'cancelada', plano: 'gratis', acessoAte: null })
      expect(mpMock.consultarPreapproval).not.toHaveBeenCalled()
    },
    30_000,
  )
})

describe('expirarGracaVencida — o fim do período pago de quem cancelou (C7)', () => {
  async function canceladaComAcessoAte(acessoAte: string) {
    await svc
      .from('tenants')
      .update({
        plan: 'equipe',
        settings: { assinatura: { provedor: 'mercado_pago', preapproval_id: 'pre-fim', plano_contratado: 'equipe', status: 'cancelled', atualizado_em: new Date().toISOString(), acesso_ate: acessoAte } },
      })
      .eq('id', tenantId)
  }

  it(
    'cancelada com acesso_ate no passado cai para gratis, zera a data e deixa trilha com o motivo certo',
    async () => {
      await canceladaComAcessoAte(new Date(Date.now() - 86_400_000).toISOString())

      const derrubados = await expirarGracaVencida(svc)

      expect(derrubados).toBeGreaterThanOrEqual(1)
      const { plan, assinatura } = await planoEAssinatura()
      expect(plan).toBe('gratis')
      expect(assinatura?.acesso_ate).toBeNull()
      const { data } = await svc.from('audit_log').select('after').eq('tenant_id', tenantId).eq('action', 'tenant.plan.change').order('created_at', { ascending: false }).limit(1)
      expect(data?.[0]?.after).toMatchObject({ de: 'equipe', para: 'gratis', por: 'periodo_pago_encerrado' })
    },
    30_000,
  )

  it(
    'cancelada com acesso_ate no FUTURO não é tocada: o aviso na tela prometeu a data',
    async () => {
      await canceladaComAcessoAte(new Date(Date.now() + 5 * 86_400_000).toISOString())

      await expirarGracaVencida(svc)

      expect((await planoEAssinatura()).plan).toBe('equipe')
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
