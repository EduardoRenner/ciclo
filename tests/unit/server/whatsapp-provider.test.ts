import { createHmac } from 'node:crypto'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { WhatsAppCloudProvider } from '@/server/providers/messaging/whatsapp'

const ORIGINAL = { ...process.env }

describe('WhatsAppCloudProvider — timeout de rede (Gate 11.2)', () => {
  beforeEach(() => {
    process.env.WHATSAPP_PHONE_NUMBER_ID = 'id-de-teste'
    process.env.WHATSAPP_ACCESS_TOKEN = 'token-de-teste'
    process.env.WHATSAPP_APP_SECRET = 'segredo-de-teste'
  })
  afterEach(() => {
    process.env = { ...ORIGINAL }
    vi.unstubAllGlobals()
  })

  it('sendTemplate manda um AbortSignal com prazo — conexão que trava não prende o lote de lembretes', async () => {
    const fetchFalso = vi.fn(async (_url: string, init: RequestInit) => {
      expect(init.signal).toBeInstanceOf(AbortSignal)
      return new Response(JSON.stringify({ messages: [{ id: 'wamid.1' }] }), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchFalso)

    const provider = new WhatsAppCloudProvider()
    await provider.sendTemplate({ to: '5511999999999', template: 'lembrete_v1', params: {} })
    expect(fetchFalso).toHaveBeenCalledTimes(1)
  })

  it('sendText manda o mesmo AbortSignal com prazo', async () => {
    const fetchFalso = vi.fn(async (_url: string, init: RequestInit) => {
      expect(init.signal).toBeInstanceOf(AbortSignal)
      return new Response(JSON.stringify({ messages: [{ id: 'wamid.2' }] }), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchFalso)

    const provider = new WhatsAppCloudProvider()
    await provider.sendText({ to: '5511999999999', body: 'oi' })
    expect(fetchFalso).toHaveBeenCalledTimes(1)
  })
})

describe('WhatsAppCloudProvider sem credencial configurada', () => {
  beforeEach(() => {
    delete process.env.WHATSAPP_PHONE_NUMBER_ID
    delete process.env.WHATSAPP_ACCESS_TOKEN
    delete process.env.WHATSAPP_APP_SECRET
  })
  afterEach(() => {
    process.env = { ...ORIGINAL }
  })

  it('sendTemplate estoura em vez de tentar a rede sem token', async () => {
    const provider = new WhatsAppCloudProvider()
    await expect(provider.sendTemplate({ to: '5511999999999', template: 'lembrete_v1', params: {} })).rejects.toThrow(
      /não configurado/,
    )
  })

  it('sendText estoura pelo mesmo motivo', async () => {
    const provider = new WhatsAppCloudProvider()
    await expect(provider.sendText({ to: '5511999999999', body: 'oi' })).rejects.toThrow(/não configurado/)
  })

  it('parseWebhook também exige APP_SECRET para conferir a assinatura', () => {
    const provider = new WhatsAppCloudProvider()
    expect(() => provider.parseWebhook('{}', 'sha256=qualquercoisa')).toThrow(/não configurado/)
  })
})

describe('WhatsAppCloudProvider.parseWebhook — verificação de assinatura', () => {
  beforeEach(() => {
    process.env.WHATSAPP_PHONE_NUMBER_ID = 'id-de-teste'
    process.env.WHATSAPP_ACCESS_TOKEN = 'token-de-teste'
    process.env.WHATSAPP_APP_SECRET = 'segredo-de-teste'
  })
  afterEach(() => {
    process.env = { ...ORIGINAL }
  })

  function assinar(raw: string): string {
    return `sha256=${createHmac('sha256', 'segredo-de-teste').update(raw, 'utf8').digest('hex')}`
  }

  it('assinatura inválida é recusada — nunca processa payload não autenticado', () => {
    const provider = new WhatsAppCloudProvider()
    const raw = JSON.stringify({ entry: [] })
    expect(() => provider.parseWebhook(raw, 'sha256=' + '0'.repeat(64))).toThrow(/[Aa]ssinatura/)
  })

  it('assinatura válida com mensagem recebida vira evento inbound', () => {
    const provider = new WhatsAppCloudProvider()
    const raw = JSON.stringify({
      entry: [
        {
          changes: [
            { value: { messages: [{ from: '5511988887777', text: { body: 'Oi, quero remarcar' }, timestamp: '1700000000' }] } },
          ],
        },
      ],
    })

    const evento = provider.parseWebhook(raw, assinar(raw))
    expect(evento).toMatchObject({ kind: 'inbound', from: '5511988887777', body: 'Oi, quero remarcar' })
  })

  it('assinatura válida com atualização de status vira evento status', () => {
    const provider = new WhatsAppCloudProvider()
    const raw = JSON.stringify({
      entry: [{ changes: [{ value: { statuses: [{ id: 'wamid.abc123', status: 'delivered' }] } }] }],
    })

    const evento = provider.parseWebhook(raw, assinar(raw))
    expect(evento).toEqual({ kind: 'status', providerId: 'wamid.abc123', status: 'delivered', error: undefined })
  })

  it('status desconhecido da Meta cai em failed, nunca quebra o parse', () => {
    const provider = new WhatsAppCloudProvider()
    const raw = JSON.stringify({
      entry: [{ changes: [{ value: { statuses: [{ id: 'wamid.xyz', status: 'algo_novo_que_a_meta_inventou' }] } }] }],
    })

    const evento = provider.parseWebhook(raw, assinar(raw))
    expect(evento).toMatchObject({ kind: 'status', status: 'failed' })
  })

  it('payload sem mensagem nem status estoura, não devolve evento inventado', () => {
    const provider = new WhatsAppCloudProvider()
    const raw = JSON.stringify({ entry: [{ changes: [{ value: {} }] }] })
    expect(() => provider.parseWebhook(raw, assinar(raw))).toThrow(/webhook/i)
  })
})
