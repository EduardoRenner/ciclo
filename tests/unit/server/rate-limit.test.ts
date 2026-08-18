import { randomUUID } from 'node:crypto'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { limitador } from '@/server/services/rate-limit'

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
