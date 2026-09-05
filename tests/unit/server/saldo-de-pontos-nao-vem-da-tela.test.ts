import { describe, expect, it } from 'vitest'

import { extratoDePontos } from '@/server/services/fidelidade'

/**
 * `.limit(50)` era um limite de APRESENTAÇÃO servindo de base para uma SOMA: o saldo saía dos 50
 * lançamentos que a tela mostra. Passando de 50, os mais antigos caíam fora — e como a ordem é
 * `created_at` desc, o que se perde primeiro são os créditos ganhos no começo.
 *
 * Quem tem mais de 50 lançamentos é, por definição, o cliente mais fiel. Era a ele que o produto
 * dizia "só há N ponto(s) disponível(is)" ao recusar o resgate, porque `lancarPontos` guarda o
 * resgate com este mesmo saldo. E a barra de progresso da tela andava PARA TRÁS sozinha quando um
 * lançamento novo empurrava um crédito velho para fora da janela — exatamente o "número que mudou
 * sozinho" que a docstring da função diz existir para evitar.
 */

type Linha = { points: number }

/**
 * Fake do client: a consulta da TELA termina em `.limit()`, a do SALDO em `.range()`. Guardar as
 * duas separadas é o que permite provar que o saldo não veio da primeira.
 */
function fakeDb(todos: Linha[], naTela: Linha[]) {
  const faixasPedidas: [number, number][] = []

  const cadeia = {
    select: () => cadeia,
    eq: () => cadeia,
    order: () => cadeia,
    limit: (n: number) =>
      Promise.resolve({
        data: naTela.slice(0, n).map((l, i) => ({ id: `e${i}`, points: l.points, reason: 'visita', created_at: '2026-01-01T00:00:00Z' })),
        error: null,
      }),
    range: (de: number, ate: number) => {
      faixasPedidas.push([de, ate])
      return Promise.resolve({ data: todos.slice(de, ate + 1), error: null })
    },
  }

  return { db: { from: () => cadeia } as unknown as Parameters<typeof extratoDePontos>[0], faixasPedidas }
}

describe('o saldo de pontos não sai da janela que a tela mostra', () => {
  it('soma TODOS os lançamentos, não só os 50 exibidos', async () => {
    // 60 créditos de 10 pontos = 600. A tela mostra 50 (=500) — o saldo tem que ser 600.
    const todos = Array.from({ length: 60 }, () => ({ points: 10 }))
    const { db } = fakeDb(todos, todos)

    const extrato = await extratoDePontos(db, 'tenant', 'cliente')

    expect(extrato.saldo).toBe(600)
    // A lista da tela continua curta — o corte de apresentação não mudou, só deixou de virar conta.
    expect(extrato.lancamentos).toHaveLength(50)
  })

  it('resgate antigo fora da janela também conta — o erro tinha as duas direções', async () => {
    /*
     * Se o que caiu fora dos 50 fosse um RESGATE, o saldo inflava e a trava de `lancarPontos`
     * deixava resgatar mais do que existe. Aqui: 55 créditos de 10 (=550) e um resgate antigo de
     * -400. Somando só os 50 recentes daria 500; o certo é 150.
     */
    const todos = [{ points: -400 }, ...Array.from({ length: 55 }, () => ({ points: 10 }))]
    const { db } = fakeDb(todos, Array.from({ length: 50 }, () => ({ points: 10 })))

    const extrato = await extratoDePontos(db, 'tenant', 'cliente')

    expect(extrato.saldo).toBe(150)
  })

  it('pagina quando passa de mil, e soma as páginas', async () => {
    // 1500 lançamentos de 1 ponto: uma página cheia (1000) e uma curta (500).
    const todos = Array.from({ length: 1500 }, () => ({ points: 1 }))
    const { db, faixasPedidas } = fakeDb(todos, todos)

    const extrato = await extratoDePontos(db, 'tenant', 'cliente')

    expect(extrato.saldo).toBe(1500)
    // Tirar o `.limit()` sem paginar trocaria um corte silencioso de 50 por um do PostgREST.
    expect(faixasPedidas).toEqual([
      [0, 999],
      [1000, 1999],
    ])
  })

  it('exatamente uma página cheia ainda pede a próxima — senão o último lote some', async () => {
    // A armadilha do `< PAGINA`: com 1000 exatos, parar na primeira perderia tudo que vier depois.
    const todos = Array.from({ length: 1000 }, () => ({ points: 2 }))
    const { db, faixasPedidas } = fakeDb(todos, todos)

    const extrato = await extratoDePontos(db, 'tenant', 'cliente')

    expect(extrato.saldo).toBe(2000)
    expect(faixasPedidas).toHaveLength(2)
  })

  it('extrato vazio dá saldo zero sem estourar', async () => {
    const { db } = fakeDb([], [])
    await expect(extratoDePontos(db, 'tenant', 'cliente')).resolves.toMatchObject({ saldo: 0, lancamentos: [] })
  })
})
