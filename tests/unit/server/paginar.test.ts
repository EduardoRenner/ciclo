import { describe, expect, it } from 'vitest'

import { buscarTudoPaginado } from '@/server/db/paginar'

/**
 * Este helper existe porque o PostgREST não erra quando estoura `max_rows`: devolve as primeiras
 * mil linhas e cala. Quem soma em cima disso entrega número errado com cara de certo — foi assim
 * que um tenant com 10 mil atendimentos perdeu 90% deles em silêncio (armadilha do TICKET-036).
 *
 * Ele não tinha teste. Ganhou um quando passou a ter teto de páginas, porque agora é ele que
 * protege `caixa`, `comissao`, `segmentos`, a ficha da cliente e o saldo de fidelidade — e um
 * defeito aqui sai errado nos cinco de uma vez.
 */

/** `paginas` é o que a consulta devolve, em ordem. `null` simula resposta sem `data`. */
function consultaDe(paginas: ({ n: number }[] | null)[]) {
  const faixas: [number, number][] = []
  let i = 0
  const consultaBase = () => ({
    range: (de: number, ate: number) => {
      faixas.push([de, ate])
      const pagina = paginas[i++] ?? []
      return Promise.resolve({ data: pagina, error: null })
    },
  })
  return { consultaBase, faixas }
}

function cheia(): { n: number }[] {
  return Array.from({ length: 1000 }, (_, i) => ({ n: i }))
}

describe('buscarTudoPaginado', () => {
  it('página curta encerra na primeira ida', async () => {
    const { consultaBase, faixas } = consultaDe([[{ n: 1 }, { n: 2 }]])

    await expect(buscarTudoPaginado(consultaBase)).resolves.toHaveLength(2)
    expect(faixas).toEqual([[0, 999]])
  })

  it('página EXATAMENTE cheia pede a próxima — senão o resto some calado', async () => {
    // O off-by-one que reintroduziria o defeito original: 1000 linhas não provam que acabou.
    const { consultaBase, faixas } = consultaDe([cheia(), [{ n: 1 }]])

    await expect(buscarTudoPaginado(consultaBase)).resolves.toHaveLength(1001)
    expect(faixas).toEqual([
      [0, 999],
      [1000, 1999],
    ])
  })

  it('acumula várias páginas na ordem em que vieram', async () => {
    const { consultaBase } = consultaDe([cheia(), cheia(), [{ n: 7 }]])

    const tudo = await buscarTudoPaginado(consultaBase)

    expect(tudo).toHaveLength(2001)
    expect(tudo.at(-1)).toEqual({ n: 7 })
  })

  it('resposta sem `data` encerra sem estourar', async () => {
    const { consultaBase } = consultaDe([null])
    await expect(buscarTudoPaginado(consultaBase)).resolves.toEqual([])
  })

  it('erro da consulta sobe, nunca vira lista parcial', async () => {
    const consultaBase = () => ({ range: () => Promise.resolve({ data: null, error: { message: 'conexão caiu' } }) })
    await expect(buscarTudoPaginado(consultaBase)).rejects.toThrow()
  })

  it('página sempre cheia ERRA no teto, em vez de rodar para sempre ou somar o que juntou', async () => {
    /*
     * A inversão do defeito que este arquivo conserta: lá o risco era CALAR, aqui é NÃO PARAR. Uma
     * consulta que devolve página cheia para sempre — filtro que não filtra, view que multiplica
     * linhas, `range` que o servidor ignora — prenderia a requisição indefinidamente.
     *
     * E devolver o que já juntou seria pior que travar: 100 mil de 300 mil linhas dá um total
     * redondo e plausível que não denuncia nada.
     */
    let idas = 0
    const consultaBase = () => ({
      range: () => {
        idas++
        return Promise.resolve({ data: cheia(), error: null })
      },
    })

    await expect(buscarTudoPaginado(consultaBase)).rejects.toThrow()
    expect(idas).toBe(100)
  })
})
