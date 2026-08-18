import { describe, expect, it, vi } from 'vitest'

import { drenarFila, type Mutacao } from '@/core/offline/queue'

function mutacao(id: string, createdAt: string): Mutacao {
  return { id, method: 'POST', url: '/api/v1/appointments', body: {}, createdAt }
}

describe('drenarFila — §4.2', () => {
  it('processa em ordem de criação, não na ordem do array', async () => {
    const fila = [mutacao('b', '2026-01-01T10:01:00Z'), mutacao('a', '2026-01-01T10:00:00Z')]
    const ordemChamada: string[] = []

    const resultado = await drenarFila(fila, async (m) => {
      ordemChamada.push(m.id)
      return { kind: 'ok' }
    })

    expect(ordemChamada).toEqual(['a', 'b'])
    expect(resultado.sincronizadas).toEqual(['a', 'b'])
  })

  it('conflito (409) não trava os itens seguintes', async () => {
    const fila = [mutacao('a', '2026-01-01T10:00:00Z'), mutacao('b', '2026-01-01T10:01:00Z')]

    const resultado = await drenarFila(fila, async (m) => (m.id === 'a' ? { kind: 'conflict' } : { kind: 'ok' }))

    expect(resultado.conflitos).toEqual(['a'])
    expect(resultado.sincronizadas).toEqual(['b'])
  })

  it('descarte (4xx que não é 409/429) não trava os itens seguintes', async () => {
    const fila = [mutacao('a', '2026-01-01T10:00:00Z'), mutacao('b', '2026-01-01T10:01:00Z')]

    const resultado = await drenarFila(fila, async (m) => (m.id === 'a' ? { kind: 'discard' } : { kind: 'ok' }))

    expect(resultado.descartadas).toEqual(['a'])
    expect(resultado.sincronizadas).toEqual(['b'])
  })

  it('erro de rede/5xx PARA a drenagem — o próprio item e os seguintes ficam pendentes, em ordem', async () => {
    const fila = [mutacao('a', '2026-01-01T10:00:00Z'), mutacao('b', '2026-01-01T10:01:00Z'), mutacao('c', '2026-01-01T10:02:00Z')]
    const chamado: string[] = []

    const resultado = await drenarFila(fila, async (m) => {
      chamado.push(m.id)
      return m.id === 'b' ? { kind: 'retry' } : { kind: 'ok' }
    })

    expect(chamado).toEqual(['a', 'b']) // nunca chegou a chamar 'c'
    expect(resultado.sincronizadas).toEqual(['a'])
    expect(resultado.pendentes).toEqual(['b', 'c'])
  })

  it('fila vazia não chama o enviador nenhuma vez', async () => {
    const enviar = vi.fn(async () => ({ kind: 'ok' as const }))
    const resultado = await drenarFila([], enviar)

    expect(enviar).not.toHaveBeenCalled()
    expect(resultado).toEqual({ sincronizadas: [], conflitos: [], descartadas: [], pendentes: [] })
  })

  it('todas as mutações conflitando: cada uma vira um item na lista de conflitos, nenhuma se perde', async () => {
    const fila = [mutacao('a', '2026-01-01T10:00:00Z'), mutacao('b', '2026-01-01T10:01:00Z')]
    const resultado = await drenarFila(fila, async () => ({ kind: 'conflict' }))

    expect(resultado.conflitos).toEqual(['a', 'b'])
  })
})
