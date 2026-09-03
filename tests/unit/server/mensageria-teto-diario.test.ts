import { randomUUID } from 'node:crypto'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { ErroDeEnvio, type MessagingProvider } from '@/server/providers/messaging/types'
import { enviarComFallback } from '@/server/services/mensageria'

/**
 * F0/item B (`docs/25-ESTRATEGIA-E-EXECUCAO.md`): freio antes do acelerador. Roda sem
 * `.env.local` (contexto de `test:unit`) — `limitador()` cai direto para a memória do processo
 * (sem Upstash nem Postgres configurados), o que é rápido e determinístico o bastante para medir
 * o teto e a janela sem tocar em nenhum banco de verdade. A cobertura de ponta a ponta contra o
 * banco real (mensagem NÃO gravada quando bloqueada) está em `tests/integration/mensageria.test.ts`.
 */

function providerQueSempreFunciona(): MessagingProvider {
  return {
    sendTemplate: vi.fn(async () => ({ providerId: `wamid.${randomUUID()}` })),
    sendText: vi.fn(async () => ({ providerId: `wamid.${randomUUID()}` })),
    parseWebhook: vi.fn(),
  }
}

function entradaBase(tenantId: string, overrides: Partial<Parameters<typeof enviarComFallback>[1]> = {}) {
  return {
    tenantId,
    clientId: randomUUID(),
    kind: 'reminder' as const,
    template: 'lembrete_teto',
    params: {},
    fallbackSubject: 'Lembrete',
    fallbackBody: 'Seu horário é amanhã.',
    whatsappTo: '+5511988990001',
    emailTo: null,
    ...overrides,
  }
}

/**
 * Fake mínimo do client Supabase: serve tanto `db.from('clients').select().eq().single()`
 * (checagem de opt-out para `kind: 'campaign'`, antes do teto) quanto `db.from('messages').insert()`
 * (`registrar()`, quando a mensagem passa do teto) quanto `db.from('tenants').select('slug')` (guarda
 * de demonstração). Uma cadeia genérica serve os três: sem `.slug` no retorno, o tenant nunca
 * é demo e o fluxo segue igual.
 */
function fakeDb(): Parameters<typeof enviarComFallback>[0] {
  const cadeia = {
    select: () => cadeia,
    eq: () => cadeia,
    single: async () => ({ data: { whatsapp_opt_out: false }, error: null }),
    maybeSingle: async () => ({ data: { whatsapp_opt_out: false }, error: null }),
    insert: async () => ({ error: null }),
  }
  return { from: () => cadeia } as unknown as Parameters<typeof enviarComFallback>[0]
}

describe('enviarComFallback — teto diário por tenant', () => {
  afterEach(() => vi.restoreAllMocks())

  it('abaixo do teto: continua chamando o provider normalmente', async () => {
    const tenantId = randomUUID()
    const provider = providerQueSempreFunciona()

    for (let i = 0; i < 3; i++) {
      const resultado = await enviarComFallback(fakeDb(), entradaBase(tenantId, { template: `t${i}` }), provider, undefined, {
        limite: 5,
        janelaSegundos: 60,
      })
      expect(resultado.status).not.toBe('blocked')
    }
    expect(provider.sendTemplate).toHaveBeenCalledTimes(3)
  })

  it('no teto: a tentativa seguinte é bloqueada e o provider não é chamado', async () => {
    const tenantId = randomUUID()
    const provider = providerQueSempreFunciona()

    for (let i = 0; i < 2; i++) {
      await enviarComFallback(fakeDb(), entradaBase(tenantId, { template: `t${i}` }), provider, undefined, { limite: 2, janelaSegundos: 60 })
    }
    expect(provider.sendTemplate).toHaveBeenCalledTimes(2)

    const bloqueada = await enviarComFallback(fakeDb(), entradaBase(tenantId, { template: 't-bloqueada' }), provider, undefined, {
      limite: 2,
      janelaSegundos: 60,
    })

    expect(bloqueada).toEqual({ channel: 'whatsapp', status: 'blocked', providerId: null })
    // A tentativa barrada não pode nem tentar o WhatsApp — é isso que a torna diferente de uma
    // falha de entrega de verdade.
    expect(provider.sendTemplate).toHaveBeenCalledTimes(2)
  })

  it('tenants diferentes têm tetos independentes', async () => {
    const provider = providerQueSempreFunciona()
    const tenantA = randomUUID()
    const tenantB = randomUUID()

    await enviarComFallback(fakeDb(), entradaBase(tenantA), provider, undefined, { limite: 1, janelaSegundos: 60 })
    const aBloqueada = await enviarComFallback(fakeDb(), entradaBase(tenantA, { template: 't2' }), provider, undefined, {
      limite: 1,
      janelaSegundos: 60,
    })
    const bLiberada = await enviarComFallback(fakeDb(), entradaBase(tenantB), provider, undefined, { limite: 1, janelaSegundos: 60 })

    expect(aBloqueada.status).toBe('blocked')
    expect(bLiberada.status).not.toBe('blocked')
  })

  it('campanha e transacional do mesmo tenant têm tetos independentes', async () => {
    const tenantId = randomUUID()
    const provider = providerQueSempreFunciona()

    await enviarComFallback(fakeDb(), entradaBase(tenantId, { kind: 'campaign' }), provider, undefined, { limite: 1, janelaSegundos: 60 })
    const campanhaBloqueada = await enviarComFallback(fakeDb(), entradaBase(tenantId, { kind: 'campaign', template: 't2' }), provider, undefined, {
      limite: 1,
      janelaSegundos: 60,
    })
    const lembreteLiberado = await enviarComFallback(fakeDb(), entradaBase(tenantId, { kind: 'reminder' }), provider, undefined, {
      limite: 1,
      janelaSegundos: 60,
    })

    expect(campanhaBloqueada.status).toBe('blocked')
    expect(lembreteLiberado.status).not.toBe('blocked')
  })

  it('janela expirada libera de novo — o bloqueio não é permanente', async () => {
    vi.useFakeTimers()
    const tenantId = randomUUID()
    const provider = providerQueSempreFunciona()

    await enviarComFallback(fakeDb(), entradaBase(tenantId), provider, undefined, { limite: 1, janelaSegundos: 1 })
    const bloqueada = await enviarComFallback(fakeDb(), entradaBase(tenantId, { template: 't2' }), provider, undefined, {
      limite: 1,
      janelaSegundos: 1,
    })
    expect(bloqueada.status).toBe('blocked')

    vi.advanceTimersByTime(1_100)

    const liberadaDeNovo = await enviarComFallback(fakeDb(), entradaBase(tenantId, { template: 't3' }), provider, undefined, {
      limite: 1,
      janelaSegundos: 1,
    })
    expect(liberadaDeNovo.status).not.toBe('blocked')

    vi.useRealTimers()
  })

  it('kind sem mapeamento explícito (ex.: transactional) usa o teto transacional, não fica sem teto', async () => {
    const tenantId = randomUUID()
    const provider = providerQueSempreFunciona()

    await enviarComFallback(fakeDb(), entradaBase(tenantId, { kind: 'transactional' }), provider, undefined, { limite: 1, janelaSegundos: 60 })
    const bloqueada = await enviarComFallback(fakeDb(), entradaBase(tenantId, { kind: 'transactional', template: 't2' }), provider, undefined, {
      limite: 1,
      janelaSegundos: 60,
    })

    expect(bloqueada.status).toBe('blocked')
  })

  it('uma vez bloqueado, a tentativa seguinte nem chega a tentar o provider', async () => {
    const tenantId = randomUUID()
    // Consome o único crédito do teto com um provider que funciona — a chamada seguinte precisa
    // estar bloqueada ANTES de decidir se o provider funcionaria ou não.
    await enviarComFallback(fakeDb(), entradaBase(tenantId), providerQueSempreFunciona(), undefined, { limite: 1, janelaSegundos: 60 })

    const providerQueSempreFalha: MessagingProvider = {
      sendTemplate: vi.fn(async () => {
        throw new ErroDeEnvio('não deveria ter sido chamado', 'falha_transitoria')
      }),
      sendText: vi.fn(),
      parseWebhook: vi.fn(),
    }

    const resultado = await enviarComFallback(fakeDb(), entradaBase(tenantId, { template: 't2' }), providerQueSempreFalha, undefined, {
      limite: 1,
      janelaSegundos: 60,
    })

    expect(resultado.status).toBe('blocked')
    expect(providerQueSempreFalha.sendTemplate).not.toHaveBeenCalled()
  })
})
