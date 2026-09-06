import { describe, expect, it } from 'vitest'

import { calibrarCiclo, DESVIO_MINIMO_DIAS, MINIMO_DE_AMOSTRA, type PrevisaoResolvida } from '@/core/cycle/calibracao'

/**
 * `services.cycle_days` nunca foi escolha do dono: nasce 21 por padrão da coluna, ou do pack da
 * profissão. É um palpite de catálogo aplicado a todo salão do país — e é ele que decide quem
 * aparece na lista de recuperação e quanto dinheiro o produto diz que está em risco.
 *
 * O setor inteiro trabalha assim (`docs/45` §1.4: *"se um cliente não agenda há 45 dias"*) e admite
 * no próprio material que o certo *"depende da frequência de cada cliente"*. Esta função é a troca
 * da régua fixa pela cadência medida.
 *
 * Os casos abaixo guardam os três freios. Cada um evita um defeito concreto, e o mais fácil de
 * perder num refactor é o terceiro — o caso raro é sempre onde a mutação passa.
 */

/** Voltas com um intervalo fixo, para o teste falar de cadência e não de datas. */
function voltasDe(intervalos: number[]): PrevisaoResolvida[] {
  return intervalos.map((dias, i) => {
    const base = Date.UTC(2026, 0, 1 + i * 400) // cada volta bem longe da outra, para não se somarem
    const visita = new Date(base).toISOString().slice(0, 10)
    const retorno = new Date(base + dias * 86_400_000).toISOString().slice(0, 10)
    return { lastVisitOn: visita, actualReturnOn: retorno }
  })
}

describe('a régua do serviço passa a sair da cadência medida', () => {
  it('mediana das voltas reais vira o ciclo, quando difere do configurado', () => {
    // Configurado 21 (o padrão de catálogo); a clientela deste salão volta a cada ~30.
    const calibracao = calibrarCiclo(voltasDe([28, 29, 30, 30, 31, 31, 32, 33]), 21)

    expect(calibracao.motivo).toBe('ok')
    // Oito valores: a mediana é a média dos dois centrais, (30+31)/2 = 30,5, que arredonda para 31.
    expect(calibracao.diasMedidos).toBe(31)
    expect(calibracao.amostra).toBe(8)
  })

  it('uma cliente que sumiu oito meses não desloca a régua de todo mundo', () => {
    /*
     * O motivo de ser mediana e não média. A média deste conjunto é 56 (451/8) — a régua saltaria
     * de 31 para 56 por causa de UMA pessoa, e o salão inteiro passaria a ser considerado "em dia"
     * por quase um mês a mais do que deveria.
     */
    const calibracao = calibrarCiclo(voltasDe([28, 29, 30, 30, 31, 31, 32, 240]), 21)

    expect(calibracao.diasMedidos).toBe(31)
  })
})

describe('os três freios', () => {
  it('amostra pequena não calibra, e diz por quê', () => {
    const calibracao = calibrarCiclo(voltasDe(Array.from({ length: MINIMO_DE_AMOSTRA - 1 }, () => 30)), 21)

    expect(calibracao.diasMedidos).toBeNull()
    // O motivo é o que permite a tela dizer "ainda estou aprendendo" em vez de sumir.
    expect(calibracao.motivo).toBe('amostra_insuficiente')
    expect(calibracao.amostra).toBe(MINIMO_DE_AMOSTRA - 1)
  })

  it('exatamente o mínimo JÁ calibra — o piso é inclusivo', () => {
    // O caso de borda onde a mutação `<` ↔ `<=` passa despercebida.
    const calibracao = calibrarCiclo(voltasDe(Array.from({ length: MINIMO_DE_AMOSTRA }, () => 30)), 21)

    expect(calibracao.motivo).toBe('ok')
    expect(calibracao.diasMedidos).toBe(30)
  })

  it('diferença menor que o desvio mínimo não mexe na régua', () => {
    /*
     * Medido 23 contra configurado 21: dois dias não mudam quem entra na lista (as faixas de
     * `estadoPorAtraso` têm largura de 10 e 30 dias), e um número que oscila sozinho toda semana
     * ensina o dono a não olhar para ele.
     */
    const calibracao = calibrarCiclo(voltasDe([22, 22, 23, 23, 23, 24, 24, 24]), 21)

    expect(calibracao.diasMedidos).toBeNull()
    expect(calibracao.motivo).toBe('diferenca_irrelevante')
    // E a amostra continua sendo reportada: "não calibrei" é diferente de "não sei nada".
    expect(calibracao.amostra).toBe(8)
  })

  it('exatamente o desvio mínimo JÁ calibra', () => {
    const calibracao = calibrarCiclo(voltasDe(Array.from({ length: 8 }, () => 21 + DESVIO_MINIMO_DIAS)), 21)

    expect(calibracao.motivo).toBe('ok')
    expect(calibracao.diasMedidos).toBe(21 + DESVIO_MINIMO_DIAS)
  })

  it('nunca devolve fora da faixa que a coluna aceita', () => {
    // `services.cycle_days` tem `check (between 1 and 365)`. Devolver 400 derrubaria a escrita, e
    // job que estoura é pior que job que não corrige.
    const calibracao = calibrarCiclo(voltasDe(Array.from({ length: 8 }, () => 500)), 21)

    expect(calibracao.diasMedidos).toBe(365)
  })
})

describe('o que não descreve cadência não entra na conta', () => {
  it('volta no mesmo dia é descartada — corte e barba não são retorno', () => {
    const mesmoDia: PrevisaoResolvida[] = Array.from({ length: 8 }, () => ({
      lastVisitOn: '2026-01-10',
      actualReturnOn: '2026-01-10',
    }))

    const calibracao = calibrarCiclo(mesmoDia, 21)

    expect(calibracao.motivo).toBe('amostra_insuficiente')
    expect(calibracao.amostra).toBe(0)
  })

  it('lista vazia não estoura nem inventa número', () => {
    expect(calibrarCiclo([], 21)).toEqual({ diasMedidos: null, amostra: 0, motivo: 'amostra_insuficiente' })
  })
})
