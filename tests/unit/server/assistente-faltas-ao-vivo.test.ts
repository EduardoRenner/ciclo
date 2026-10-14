import { describe, expect, it } from 'vitest'

import { contarFaltas, soCadastroQueOModeloPrecisa } from '@/server/assistente/ferramentas'

/**
 * APR-213 (docs/98 E-08, G-08): `clients.no_show_count` nunca é escrita por ninguém — o assistente
 * dizia "0 faltas" para quem faltou duas vezes. A contagem sai do histórico, e a coluna morta não
 * vai mais para o modelo.
 */
describe('o assistente conta faltas ao vivo, não pela coluna morta (APR-213)', () => {
  it('cliente com 2 faltas no histórico → 2', () => {
    const historico = [{ status: 'done' }, { status: 'no_show' }, { status: 'canceled' }, { status: 'no_show' }]
    expect(contarFaltas(historico)).toBe(2)
    expect(contarFaltas([])).toBe(0)
  })

  it('`no_show_count` não vai para o modelo, mesmo vindo do banco', () => {
    const saida = soCadastroQueOModeloPrecisa({ id: 'x', name: 'Ana', no_show_count: 0, visits_count: 3 })
    expect(saida).not.toHaveProperty('no_show_count')
    expect(saida).toHaveProperty('visits_count', 3)
  })
})
