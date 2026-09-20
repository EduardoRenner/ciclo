import { randomUUID } from 'node:crypto'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { chavesEmMemoriaParaTeste, limitador, limitarComUpstash } from '@/server/services/rate-limit'

describe('limitador (fallback em memória, sem Upstash configurado)', () => {
  afterEach(() => vi.restoreAllMocks())

  it('permite até o limite e recusa a partir daí', async () => {
    const chave = `teste:${randomUUID()}`
    for (let i = 0; i < 5; i++) {
      const r = await limitador(chave, { limite: 5, janelaSegundos: 60 })
      expect(r.permitido, `tentativa ${i + 1}`).toBe(true)
    }
    const sexta = await limitador(chave, { limite: 5, janelaSegundos: 60 })
    expect(sexta.permitido).toBe(false)
  })

  it('chaves diferentes têm contadores independentes', async () => {
    const a = `teste:${randomUUID()}`
    const b = `teste:${randomUUID()}`
    for (let i = 0; i < 3; i++) await limitador(a, { limite: 3, janelaSegundos: 60 })

    expect((await limitador(a, { limite: 3, janelaSegundos: 60 })).permitido).toBe(false)
    expect((await limitador(b, { limite: 3, janelaSegundos: 60 })).permitido).toBe(true)
  })

  it('50 tentativas rápidas contra um limite de 5: só as 5 primeiras passam', async () => {
    const chave = `script:${randomUUID()}`
    const resultados = []
    for (let i = 0; i < 50; i++) resultados.push(await limitador(chave, { limite: 5, janelaSegundos: 60 }))

    expect(resultados.filter((r) => r.permitido)).toHaveLength(5)
    expect(resultados.filter((r) => !r.permitido)).toHaveLength(45)
  })

  it('janela expirada libera de novo', async () => {
    vi.useFakeTimers()
    const chave = `teste:${randomUUID()}`

    await limitador(chave, { limite: 1, janelaSegundos: 1 })
    expect((await limitador(chave, { limite: 1, janelaSegundos: 1 })).permitido).toBe(false)

    vi.advanceTimersByTime(1100)
    expect((await limitador(chave, { limite: 1, janelaSegundos: 1 })).permitido).toBe(true)

    vi.useRealTimers()
  })
})

/**
 * O `Map` do fallback em memória nunca removia nada.
 *
 * A chave do teto global é `global:ip:<ip>` (`server/http/handler.ts`, `LIMITE_GLOBAL`), e ele
 * roda em TODA requisição da API. Cada IP nova deixava uma entrada permanente na instância: a
 * entrada só era sobrescrita se aquela mesma IP voltasse depois da janela, então quem passou uma
 * vez ficava para sempre. Numa instância morna da Vercel, que vive horas, isso é crescimento sem
 * teto — e o sintoma não seria erro de conta, seria a função reiniciando por memória.
 *
 * A documentação do módulo é extensa sobre a contagem entre instâncias (achado S4) e sobre o
 * trade-off do `somenteMemoria`. Sobre o tempo de vida do `Map`, nada — foi por onde passou.
 */
describe('a memória do limitador não cresce para sempre', () => {
  it('chave expirada é varrida quando o mapa passa do teto', async () => {
    const antes = chavesEmMemoriaParaTeste()

    // Janela de 1 segundo, empurrada para o passado: são exatamente as entradas que ninguém mais
    // vai consultar — o caso do IP que passou uma vez e não voltou.
    for (let i = 0; i < 10_000; i++) {
      await limitador(`varredura:${i}`, { limite: 5, janelaSegundos: 1, somenteMemoria: true })
    }
    const cheio = chavesEmMemoriaParaTeste()
    expect(cheio, 'as chaves precisam ter entrado, senão o teste não prova nada').toBeGreaterThanOrEqual(antes + 10_000)

    vi.useFakeTimers()
    try {
      vi.setSystemTime(Date.now() + 5_000)
      await limitador('varredura:gatilho', { limite: 5, janelaSegundos: 60, somenteMemoria: true })
    } finally {
      vi.useRealTimers()
    }

    expect(
      chavesEmMemoriaParaTeste(),
      'o mapa continuou com as 10 mil chaves expiradas — cada IP que passou uma vez fica para sempre',
    ).toBeLessThan(cheio)
  })

  it('a varredura NÃO despeja chave viva — despejar zeraria a contagem de quem está batendo', async () => {
    /*
     * O outro lado, e a razão de a varredura olhar `expiraEm` em vez de só cortar pelo tamanho:
     * jogar fora entrada viva para caber num teto é exatamente o que alguém batendo forte iria
     * querer, porque devolve o balde dele zerado.
     */
    const chave = `viva:${randomUUID()}`
    for (let i = 0; i < 5; i++) await limitador(chave, { limite: 5, janelaSegundos: 60, somenteMemoria: true })

    // Enche o mapa para forçar a varredura no próximo acesso.
    for (let i = 0; i < 10_000; i++) {
      await limitador(`enchendo:${i}`, { limite: 5, janelaSegundos: 60, somenteMemoria: true })
    }

    expect(
      (await limitador(chave, { limite: 5, janelaSegundos: 60, somenteMemoria: true })).permitido,
      'a chave viva foi despejada e voltou a permitir — o limite ficou contornável enchendo o mapa',
    ).toBe(false)
  })
})

/**
 * Achado ao varrer todo `await fetch(` sem `.ok` correspondente na base (mesma classe de BL-08/09/
 * 11/12): nem `incr` nem `expire` checavam a resposta do Upstash. Sem checar, um erro que ainda
 * devolve JSON válido (`{"error": "..."}` em vez de `{"result": N}`) virava `contagem: undefined`,
 * e `undefined <= limite` é `false` — TODA requisição passava a ser recusada, em vez de cair pro
 * Postgres como o resto deste arquivo documenta ser a intenção.
 */
describe('limitarComUpstash — checagem de .ok', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('incr não-ok lança — é isso que faz o chamador cair pro Postgres, não recusar tudo', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 })))

    await expect(limitarComUpstash('chave', 5, 60, 'https://upstash.test', 'token-errado')).rejects.toThrow(/Upstash incr/)
  })

  it('incr ok devolve permitido/restante certos, sem precisar de expire', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ result: 3 }), { status: 200 })))

    const r = await limitarComUpstash('chave', 5, 60, 'https://upstash.test', 'token')
    expect(r).toEqual({ permitido: true, restante: 2 })
  })

  it('incr ok mas expire falha: NÃO lança e devolve o resultado do incr — não pode contar a mesma requisição duas vezes', async () => {
    const chamadas: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('/incr/')) {
          chamadas.push('incr')
          return new Response(JSON.stringify({ result: 1 }), { status: 200 })
        }
        chamadas.push('expire')
        return new Response('erro interno', { status: 500 })
      }),
    )

    const r = await limitarComUpstash('chave', 5, 60, 'https://upstash.test', 'token')
    expect(r).toEqual({ permitido: true, restante: 4 })
    expect(chamadas).toEqual(['incr', 'expire']) // prova que o expire foi de fato tentado
  })
})
