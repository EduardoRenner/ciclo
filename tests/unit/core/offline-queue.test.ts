import { describe, expect, it, vi } from 'vitest'

import { classificarResposta, drenarFila, type Mutacao } from '@/core/offline/queue'

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


/**
 * A regra que decide entre reenviar, pedir ajuda e **jogar fora o trabalho da pessoa** morava
 * dentro de `enviarMutacao`, no adaptador de browser — que o próprio arquivo declara intestável
 * neste projeto (sem jsdom). Era a única parte da fila offline sem teste, e era a que apagava dado.
 */
describe('classificarResposta', () => {
  it('2xx sincroniza', () => {
    for (const status of [200, 201, 204]) expect(classificarResposta(status), String(status)).toBe('ok')
  })

  it('409 vira conflito — §4.2.5 manda virar card, nunca descarte', () => {
    expect(classificarResposta(409)).toBe('conflict')
  })

  it('429 e 5xx reenviam — é o que o próprio servidor está pedindo', () => {
    for (const status of [429, 500, 502, 503, 504]) expect(classificarResposta(status), String(status)).toBe('retry')
  })

  /*
   * O achado de 2026-08-28. O cenário não é raro, é o mais provável de todos: o tablet do balcão
   * passa a noite sem rede com um agendamento na fila, a sessão vence, a rede volta, o servidor
   * responde 401 — e a mutação era APAGADA do IndexedDB. A pessoa tinha visto "será enviado
   * quando a conexão voltar" e nunca mais ouvia falar do assunto.
   */
  it('401 e 403 reenviam, não descartam — sessão vencida é recuperável', () => {
    expect(classificarResposta(401), 'sessão vencida apagava o trabalho da pessoa').toBe('retry')
    expect(classificarResposta(403), 'permissão devolvida pelo gerente faz a mesma mutação passar').toBe('retry')
  })

  it('recusa definitiva descarta — e é ela que a UI precisa contar', () => {
    for (const status of [400, 402, 404, 410, 422]) expect(classificarResposta(status), String(status)).toBe('discard')
  })

  it('a função distingue de verdade — não devolve o mesmo para tudo', () => {
    // Guarda contra o próprio detector: uma implementação que devolvesse sempre 'retry' passaria
    // nos dois testes do meio e faria a fila nunca esvaziar.
    const todos = new Set([200, 409, 401, 500, 422].map(classificarResposta))
    expect(todos.size, 'a classificação colapsou num valor só').toBeGreaterThanOrEqual(4)
  })
})
