import { randomUUID } from 'node:crypto'

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { afterAll, describe, expect, it } from 'vitest'

import { processarWebhookMP } from '@/server/services/assinatura-mp'
import { executarOnboarding } from '@/server/services/onboarding'

import type { SituacaoPagamento, SituacaoPreapproval } from '@/server/billing/mercado-pago'
import type { Database } from '@/server/db/types.gen'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error('Este teste precisa de NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local.')
}

const svc = createClient<Database>(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })

/**
 * G-13 (docs/60) — a última peça do webhook do Mercado Pago. `core/billing/mercado-pago.ts`
 * (`decidirPlano`, `valorConfereComDegrau`, `lerAssinatura`) já tinha guarda própria; o que faltava
 * era provar que `processarWebhookMP` escreve o degrau certo em `tenants` de verdade.
 *
 * As funções que fariam a chamada real ao MP (`consultarPreapproval`/`consultarPagamento`) são
 * injetadas como fake — sem credencial, não dá pra bater na API de verdade, e não é isso que este
 * arquivo guarda (isso já está em `mercado-pago-cliente.test.ts`).
 */
const tenants: string[] = []
const usuarios: string[] = []

async function tenantComAssinatura(
  planoContratado: 'essencial' | 'equipe' | 'avancado',
  preapprovalId: string,
  planoVigente: 'gratis' | 'essencial' | 'equipe' | 'avancado' = planoContratado,
) {
  const marca = randomUUID().slice(0, 8)
  const { data, error } = await svc.auth.admin.createUser({ email: `mp-${marca}@ciclo.test`, password: randomUUID(), email_confirm: true })
  if (error || !data.user) throw new Error(`seed falhou: ${error?.message}`)
  usuarios.push(data.user.id)

  const { tenant } = await executarOnboarding(svc, {
    userId: data.user.id,
    businessName: 'Salão do MP',
    vertical: 'barber',
    slug: `mp-${marca}`,
    timezone: 'America/Sao_Paulo',
  })
  tenants.push(tenant.id)

  await svc
    .from('tenants')
    .update({
      plan: planoVigente,
      settings: {
        assinatura: {
          provedor: 'mercado_pago',
          preapproval_id: preapprovalId,
          plano_contratado: planoContratado,
          status: 'pending',
          atualizado_em: new Date().toISOString(),
        },
      },
    })
    .eq('id', tenant.id)

  return tenant.id
}

afterAll(async () => {
  for (const t of tenants) await svc.from('tenants').delete().eq('id', t)
  for (const u of usuarios) await svc.auth.admin.deleteUser(u)
}, 60_000)

function fakePreapproval(situacao: Partial<SituacaoPreapproval> & { externalReference: string }) {
  return async (): Promise<SituacaoPreapproval> => ({ status: 'authorized', valorAutorizado: null, ...situacao })
}

function fakePagamento(situacao: Partial<SituacaoPagamento> = {}) {
  return async (): Promise<SituacaoPagamento> => ({ status: 'approved', valor: null, externalReference: null, preapprovalId: null, ...situacao })
}

describe('processarWebhookMP', () => {
  it(
    'assinatura autorizada com valor certo: o plano contratado entra em vigor',
    async () => {
      const preapprovalId = `pre_${randomUUID()}`
      const tenantId = await tenantComAssinatura('essencial', preapprovalId, 'gratis')

      const resultado = await processarWebhookMP(
        svc,
        { assunto: 'subscription', id: preapprovalId },
        fakePagamento(),
        fakePreapproval({ externalReference: tenantId, status: 'authorized', valorAutorizado: 49 }),
      )

      expect(resultado).toEqual({ resultado: 'plano_atualizado', tenantId, plano: 'essencial' })
      const { data } = await svc.from('tenants').select('plan').eq('id', tenantId).single()
      expect(data!.plan).toBe('essencial')
    },
    30_000,
  )

  it(
    'assinatura pausada (pagamento falhou): mantém o degrau contratado — é a janela de graça, não queda imediata',
    async () => {
      const preapprovalId = `pre_${randomUUID()}`
      const tenantId = await tenantComAssinatura('equipe', preapprovalId, 'equipe')

      const resultado = await processarWebhookMP(
        svc,
        { assunto: 'subscription', id: preapprovalId },
        fakePagamento(),
        fakePreapproval({ externalReference: tenantId, status: 'paused', valorAutorizado: 99 }),
      )

      expect(resultado).toEqual({ resultado: 'plano_atualizado', tenantId, plano: 'equipe' })
      const { data } = await svc.from('tenants').select('plan').eq('id', tenantId).single()
      expect(data!.plan, 'pagamento pausado não pode derrubar o salão no meio do atendimento').toBe('equipe')
    },
    30_000,
  )

  it(
    'assinatura cancelada: cai pro grátis — o ponto central deste ticket',
    async () => {
      const preapprovalId = `pre_${randomUUID()}`
      const tenantId = await tenantComAssinatura('avancado', preapprovalId, 'avancado')

      const resultado = await processarWebhookMP(
        svc,
        { assunto: 'subscription', id: preapprovalId },
        fakePagamento(),
        fakePreapproval({ externalReference: tenantId, status: 'cancelled', valorAutorizado: null }),
      )

      expect(resultado).toEqual({ resultado: 'plano_atualizado', tenantId, plano: 'gratis' })
      const { data } = await svc.from('tenants').select('plan').eq('id', tenantId).single()
      expect(data!.plan).toBe('gratis')
    },
    30_000,
  )

  it(
    'evento de PAGAMENTO reconsulta a preapproval associada — não decide pelo status do pagamento',
    async () => {
      const preapprovalId = `pre_${randomUUID()}`
      const tenantId = await tenantComAssinatura('essencial', preapprovalId, 'gratis')
      const paymentId = `pay_${randomUUID()}`

      const resultado = await processarWebhookMP(
        svc,
        { assunto: 'payment', id: paymentId },
        fakePagamento({ preapprovalId, status: 'approved' }),
        fakePreapproval({ externalReference: tenantId, status: 'authorized', valorAutorizado: 49 }),
      )

      expect(resultado).toEqual({ resultado: 'plano_atualizado', tenantId, plano: 'essencial' })
    },
    30_000,
  )

  it(
    'PISO — valor autorizado não bate com o degrau contratado: não muda o plano (guarda de checkout adulterado)',
    async () => {
      const preapprovalId = `pre_${randomUUID()}`
      const tenantId = await tenantComAssinatura('avancado', preapprovalId, 'gratis')

      const resultado = await processarWebhookMP(
        svc,
        { assunto: 'subscription', id: preapprovalId },
        fakePagamento(),
        // Avançado custa R$179; alguém autorizou R$1 — exatamente o ataque que a guarda existe pra pegar.
        fakePreapproval({ externalReference: tenantId, status: 'authorized', valorAutorizado: 1 }),
      )

      expect(resultado).toEqual({ resultado: 'valor_nao_confere', tenantId })
      const { data } = await svc.from('tenants').select('plan').eq('id', tenantId).single()
      expect(data!.plan, 'o plano avançado foi concedido por R$1 — a guarda de valor não pegou').toBe('gratis')
    },
    30_000,
  )

  it(
    'preapproval_id da MP não bate com o registrado no tenant: não age',
    async () => {
      const preapprovalId = `pre_${randomUUID()}`
      const tenantId = await tenantComAssinatura('essencial', preapprovalId, 'gratis')

      const resultado = await processarWebhookMP(
        svc,
        { assunto: 'subscription', id: `pre_${randomUUID()}` }, // outro id, não o registrado
        fakePagamento(),
        fakePreapproval({ externalReference: tenantId, status: 'authorized', valorAutorizado: 49 }),
      )

      expect(resultado).toEqual({ resultado: 'sem_assinatura_registrada', tenantId })
      const { data } = await svc.from('tenants').select('plan').eq('id', tenantId).single()
      expect(data!.plan).toBe('gratis')
    },
    30_000,
  )

  it(
    'external_reference aponta para tenant que não existe: não lança, só reporta',
    async () => {
      const resultado = await processarWebhookMP(
        svc,
        { assunto: 'subscription', id: `pre_${randomUUID()}` },
        fakePagamento(),
        fakePreapproval({ externalReference: randomUUID(), status: 'authorized', valorAutorizado: 49 }),
      )
      expect(resultado).toEqual({ resultado: 'tenant_nao_encontrado' })
    },
    30_000,
  )

  it(
    'reprocessar o MESMO evento duas vezes é idempotente — mesmo resultado, mesmo estado final',
    async () => {
      const preapprovalId = `pre_${randomUUID()}`
      const tenantId = await tenantComAssinatura('essencial', preapprovalId, 'gratis')
      const fn = fakePreapproval({ externalReference: tenantId, status: 'authorized', valorAutorizado: 49 })

      const r1 = await processarWebhookMP(svc, { assunto: 'subscription', id: preapprovalId }, fakePagamento(), fn)
      const r2 = await processarWebhookMP(svc, { assunto: 'subscription', id: preapprovalId }, fakePagamento(), fn)

      expect(r1).toEqual(r2)
      const { data } = await svc.from('tenants').select('plan').eq('id', tenantId).single()
      expect(data!.plan).toBe('essencial')
    },
    30_000,
  )
})
