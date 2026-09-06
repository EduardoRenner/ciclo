import { randomUUID } from 'node:crypto'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { enviarComFallback } from '@/server/services/mensageria'

import type { MessagingProvider } from '@/server/providers/messaging/types'

/**
 * `tenantEhDemonstracao` é o ponto único por onde TODO envio passa — `notificarProximoDaLista` e
 * `/cycle/recover/send` não têm laço de tenant onde pular a demo, então a trava desceu para o
 * transporte. O comentário do bloco explica muito bem POR QUE ela mora ali, e não dizia nada sobre
 * o que acontece quando a própria leitura falha: o `error` da consulta era descartado no
 * destructuring, sem log nenhum.
 *
 * A saída continua sendo a mesma — falha ABERTO, manda de verdade — porque a alternativa é pior:
 * um tenant real com um blip de rede teria o lembrete engolido e gravado como `sent`. O que muda é
 * que agora ela avisa. Trava que não sabe que não sabe é a mais silenciosa que existe.
 */

function providerFalso(): MessagingProvider {
  return {
    sendTemplate: vi.fn(async () => ({ providerId: `wamid.${randomUUID()}` })),
    sendText: vi.fn(async () => ({ providerId: `wamid.${randomUUID()}` })),
    parseWebhook: vi.fn(),
  }
}

function entrada(tenantId: string) {
  return {
    tenantId,
    clientId: randomUUID(),
    kind: 'reminder' as const,
    template: 'lembrete',
    params: {},
    fallbackSubject: 'Lembrete',
    fallbackBody: 'Seu horário é amanhã.',
    whatsappTo: '+5511988990001',
    emailTo: null,
  }
}

/** `respostaDeTenants` é o que `db.from('tenants').select('slug')...maybeSingle()` devolve. */
function fakeDb(respostaDeTenants: { data: { slug: string } | null; error: unknown }): Parameters<typeof enviarComFallback>[0] {
  const cadeia = {
    select: (colunas: string) => ({ ...cadeia, ehTenants: colunas === 'slug' }),
    eq: () => cadeia,
    single: () => Promise.resolve({ data: { whatsapp_opt_out: false }, error: null }),
    maybeSingle: () => Promise.resolve(respostaDeTenants),
    insert: () => Promise.resolve({ error: null }),
  }
  return { from: () => cadeia } as unknown as Parameters<typeof enviarComFallback>[0]
}

describe('a trava de demonstração não decide em silêncio', () => {
  afterEach(() => vi.restoreAllMocks())

  it('slug de demonstração: não chama o provider (a trava funciona)', async () => {
    const provider = providerFalso()
    const resultado = await enviarComFallback(fakeDb({ data: { slug: 'dom-rocha' }, error: null }), entrada(randomUUID()), provider)

    expect(provider.sendTemplate).not.toHaveBeenCalled()
    expect(resultado.providerId).toBe('demo-simulado')
  })

  it('slug real: chama o provider normalmente', async () => {
    const provider = providerFalso()
    await enviarComFallback(fakeDb({ data: { slug: 'salao-da-ana' }, error: null }), entrada(randomUUID()), provider)

    expect(provider.sendTemplate).toHaveBeenCalledTimes(1)
  })

  it('erro na leitura: manda de verdade E avisa — nunca decide calado', async () => {
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const provider = providerFalso()
    const tenantId = randomUUID()

    await enviarComFallback(fakeDb({ data: null, error: { message: 'conexão caiu' } }), entrada(tenantId), provider)

    // Falha aberto: o tenant real não pode ter o lembrete engolido por um blip de rede.
    expect(provider.sendTemplate).toHaveBeenCalledTimes(1)

    // E o aviso é a metade que faltava — sem ele ninguém descobre que a trava ficou cega.
    const linhas = aviso.mock.calls.map((c) => String(c[0]))
    expect(linhas.some((l) => l.includes('demo_indeterminada_enviando_de_verdade'))).toBe(true)
    expect(linhas.some((l) => l.includes(tenantId))).toBe(true)
  })

  it('tenant inexistente (sem erro) não vira entrada de cache — a resposta não congela', async () => {
    /*
     * Ler um tenant que ainda não existe devolve `data: null` SEM erro. Se `''` entrasse no `Map`,
     * a resposta "não é demo" ficaria congelada para aquele id para sempre — inclusive depois de o
     * tenant nascer com um slug de demonstração. Aqui a segunda chamada tem que voltar ao banco e
     * enxergar o slug novo.
     */
    const provider = providerFalso()
    const tenantId = randomUUID()

    await enviarComFallback(fakeDb({ data: null, error: null }), entrada(tenantId), provider)
    expect(provider.sendTemplate).toHaveBeenCalledTimes(1)

    await enviarComFallback(fakeDb({ data: { slug: 'dom-rocha' }, error: null }), entrada(tenantId), provider)
    expect(provider.sendTemplate).toHaveBeenCalledTimes(1)
  })
})
