import { describe, expect, it } from 'vitest'

import { MINIMO_DE_MESES, mesesJaEncerrados, serieMensal } from '@/core/caixa/serie-mensal'

const mes = (month: string, profitCents: number, ticketsCount: number, revenueCents = profitCents * 3) => ({
  month,
  revenueCents,
  profitCents,
  ticketsCount,
})

describe('serieMensal — o fosso que só o tempo dá', () => {
  it('ordena por mês, mesmo recebendo fora de ordem', () => {
    const s = serieMensal([mes('2026-05-01', 100, 1), mes('2026-03-01', 100, 1), mes('2026-04-01', 100, 1)])
    expect(s.pontos.map((p) => p.month)).toEqual(['2026-03-01', '2026-04-01', '2026-05-01'])
  })

  /**
   * A comparação é do lucro POR ATENDIMENTO, e não do lucro do mês. Aqui o total cai de R$ 100 para
   * R$ 90 enquanto o que sobra de cada atendimento sobe de R$ 10 para R$ 15: o salão atendeu menos
   * e ganhou mais em cada um. Comparar totais diria o contrário, e mandaria o dono consertar o que
   * está funcionando.
   */
  it('compara o lucro por atendimento, não o total do mês', () => {
    const s = serieMensal([mes('2026-03-01', 10_000, 10), mes('2026-04-01', 9_500, 8), mes('2026-05-01', 9_000, 6)])
    expect(s.pontos.map((p) => p.lucroPorAtendimentoCents)).toEqual([1_000, 1_188, 1_500])
    expect(s.variacaoBps, 'de R$ 10,00 para R$ 15,00 é +50%').toBe(5_000)
    expect(s.primeiroMesComparado).toBe('2026-03-01')
    expect(s.ultimoMesComparado).toBe('2026-05-01')
  })

  it('queda também é dita, e com sinal', () => {
    const s = serieMensal([mes('2026-03-01', 10_000, 10), mes('2026-04-01', 9_000, 10), mes('2026-05-01', 7_500, 10)])
    expect(s.variacaoBps).toBe(-2_500)
  })

  it('menos meses que o piso não anuncia tendência nenhuma', () => {
    const poucos = [mes('2026-04-01', 10_000, 10), mes('2026-05-01', 20_000, 10)]
    expect(poucos).toHaveLength(MINIMO_DE_MESES - 1)
    const s = serieMensal(poucos)
    expect(s.pontos, 'a série continua aparecendo').toHaveLength(2)
    expect(s.variacaoBps, 'dois pontos não são tendência').toBeNull()
  })

  /** Mês sem comanda fechada não tem média. Zero seria uma medida; `null` é a ausência dela. */
  it('mês sem atendimento não vira lucro por atendimento zero', () => {
    const s = serieMensal([mes('2026-03-01', 10_000, 10), mes('2026-04-01', 0, 0), mes('2026-05-01', 15_000, 10)])
    expect(s.pontos[1]!.lucroPorAtendimentoCents).toBeNull()
    expect(s.variacaoBps, 'o mês vazio é pulado, não conta como queda a zero').toBe(5_000)
  })

  /**
   * Partir de um mês no vermelho e dizer "subiu 400%" é aritmética que não descreve nada. A série
   * fica; só a frase cala.
   */
  it('base negativa não vira percentual de crescimento', () => {
    const s = serieMensal([mes('2026-03-01', -5_000, 10), mes('2026-04-01', 5_000, 10), mes('2026-05-01', 15_000, 10)])
    expect(s.pontos).toHaveLength(3)
    expect(s.variacaoBps).toBeNull()
  })

  it('série vazia não estoura', () => {
    expect(serieMensal([])).toEqual({ pontos: [], variacaoBps: null, primeiroMesComparado: null, ultimoMesComparado: null })
  })
})

/**
 * A guarda que substitui uma varredura CEGA: a anterior procurava `mesCorrente.subtract({ months:`
 * no serviço e passou verde com o laço mexido, porque a mesma expressão aparecia noutra linha,
 * calculando o limite da janela. Casar com algo que o arquivo contém por outro motivo é a
 * armadilha nº1 do `CLAUDE.md`, e aqui o que importa é comportamento, não texto.
 */
describe('mesesJaEncerrados — o mês corrente nunca entra', () => {
  it('devolve os meses anteriores, do mais recente para o mais antigo', () => {
    expect(mesesJaEncerrados('2026-09-01', 3)).toEqual(['2026-08-01', '2026-07-01', '2026-06-01'])
  })

  /**
   * O defeito que um job "esperto demais" cometeria primeiro. O mês corrente ainda vai mudar:
   * congelá-lo grava um número errado para sempre, e a série passa a mentir sobre o presente.
   */
  it('o mês corrente NUNCA aparece, em nenhuma janela', () => {
    for (const quantos of [1, 3, 12, 24]) {
      expect(mesesJaEncerrados('2026-09-01', quantos), `janela de ${quantos}`).not.toContain('2026-09-01')
    }
  })

  it('atravessa a virada do ano sem inventar mês 0 nem mês 13', () => {
    expect(mesesJaEncerrados('2026-02-01', 4)).toEqual(['2026-01-01', '2025-12-01', '2025-11-01', '2025-10-01'])
  })

  it('janela vazia devolve lista vazia, e não o mês corrente', () => {
    expect(mesesJaEncerrados('2026-09-01', 0)).toEqual([])
  })

  it('vinte e quatro meses voltam dois anos exatos', () => {
    const meses = mesesJaEncerrados('2026-09-01', 24)
    expect(meses).toHaveLength(24)
    expect(meses[23]).toBe('2024-09-01')
  })
})
