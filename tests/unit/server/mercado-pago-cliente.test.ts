import { createHmac } from 'node:crypto'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  consultarPreapproval,
  criarPreapproval,
  verificarAssinaturaWebhook,
} from '@/server/billing/mercado-pago'

/**
 * `docs/57` PR 1.1. O que este arquivo guarda de verdade é `verificarAssinaturaWebhook` — sem ela,
 * a URL pública do webhook aceita um `authorized` forjado e o plano sai de graça.
 */

const SEGREDO = 'test-webhook-secret-abc123'

beforeEach(() => {
  process.env.MERCADOPAGO_ACCESS_TOKEN = 'TEST-token'
  process.env.MERCADOPAGO_WEBHOOK_SECRET = SEGREDO
  process.env.MERCADOPAGO_BASE_URL = 'https://api.mercadopago.test'
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

/** Monta um `x-signature` VÁLIDO pelo mesmo esquema do MP, para o teste ter um vetor conhecido. */
function assinar(dataId: string | null, xRequestId: string | null, ts: number): string {
  const id = dataId ? (/^[a-z0-9]+$/i.test(dataId) ? dataId.toLowerCase() : dataId) : null
  const manifesto = (id ? `id:${id};` : '') + (xRequestId ? `request-id:${xRequestId};` : '') + `ts:${ts};`
  const v1 = createHmac('sha256', SEGREDO).update(manifesto).digest('hex')
  return `ts=${ts},v1=${v1}`
}

describe('verificarAssinaturaWebhook', () => {
  const agora = 1_800_000_000_000 // ms
  const ts = Math.floor(agora / 1000)

  it('aceita uma assinatura válida', () => {
    const xSignature = assinar('payment-123', 'req-abc', ts)
    expect(verificarAssinaturaWebhook({ xSignature, xRequestId: 'req-abc', dataId: 'payment-123', agora })).toBe(true)
  })

  it('aceita quando o data.id vem alfanumérico com maiúsculas (o manifesto usa minúsculo)', () => {
    const xSignature = assinar('ABC123', 'req-x', ts)
    expect(verificarAssinaturaWebhook({ xSignature, xRequestId: 'req-x', dataId: 'ABC123', agora })).toBe(true)
  })

  it('rejeita se o hash não bate (1 byte trocado no corpo assinado)', () => {
    const xSignature = assinar('payment-123', 'req-abc', ts)
    // mesma assinatura, mas o dataId que o servidor recebeu é outro
    expect(verificarAssinaturaWebhook({ xSignature, xRequestId: 'req-abc', dataId: 'payment-999', agora })).toBe(false)
  })

  it('rejeita assinatura ausente ou malformada', () => {
    expect(verificarAssinaturaWebhook({ xSignature: null, xRequestId: 'r', dataId: 'd', agora })).toBe(false)
    expect(verificarAssinaturaWebhook({ xSignature: 'lixo', xRequestId: 'r', dataId: 'd', agora })).toBe(false)
    expect(verificarAssinaturaWebhook({ xSignature: 'ts=abc,v1=x', xRequestId: 'r', dataId: 'd', agora })).toBe(false)
  })

  it('rejeita replay: assinatura de mais de 5 min atrás', () => {
    const tsVelho = ts - 600
    const xSignature = assinar('payment-123', 'req-abc', tsVelho)
    expect(verificarAssinaturaWebhook({ xSignature, xRequestId: 'req-abc', dataId: 'payment-123', agora })).toBe(false)
  })

  it('lança se o segredo não está configurado', () => {
    delete process.env.MERCADOPAGO_WEBHOOK_SECRET
    expect(() => verificarAssinaturaWebhook({ xSignature: 'ts=1,v1=2', xRequestId: null, dataId: null })).toThrow()
  })
})

describe('cliente da API', () => {
  it('criarPreapproval manda reais (não centavos) e guarda o tenantId em external_reference', async () => {
    const fetchFalso = vi.fn(async (_url: string, init: RequestInit) => {
      const corpo = JSON.parse(String(init.body)) as Record<string, unknown>
      expect(corpo.external_reference).toBe('tenant-42')
      expect((corpo.auto_recurring as { transaction_amount: number }).transaction_amount).toBe(99) // Equipe = R$ 99
      return new Response(JSON.stringify({ id: 'preapp-1', init_point: 'https://mp.test/checkout/preapp-1' }), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchFalso)

    const r = await criarPreapproval({ tenantId: 'tenant-42', tier: 'equipe', payerEmail: 'dono@salao.test', backUrl: 'https://seuciclo.com.br/admin/config/meu-plano' })
    expect(r).toEqual({ preapprovalId: 'preapp-1', initPoint: 'https://mp.test/checkout/preapp-1' })
    expect(fetchFalso).toHaveBeenCalledOnce()
  })

  it('consultarPreapproval devolve status + valor autorizado normalizados', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({ status: 'authorized', external_reference: 'tenant-42', auto_recurring: { transaction_amount: 99 } }),
          { status: 200 },
        ),
      ),
    )
    const r = await consultarPreapproval('preapp-1')
    expect(r).toEqual({ status: 'authorized', externalReference: 'tenant-42', valorAutorizado: 99 })
  })

  it('erro do MP (não-2xx) vira PAYMENT_FAILED, sem vazar o corpo pra pessoa', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ message: 'invalid token' }), { status: 401 })))
    await expect(consultarPreapproval('preapp-1')).rejects.toMatchObject({ code: 'PAYMENT_FAILED' })
    // a mensagem pública não carrega o corpo do MP
    await expect(consultarPreapproval('preapp-1')).rejects.toThrow(/não foi aprovado/)
  })
})
