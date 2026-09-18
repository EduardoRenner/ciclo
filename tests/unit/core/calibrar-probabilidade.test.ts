import { describe, expect, it } from 'vitest'

import { calibrarProbabilidadePorEstado, MINIMO_POR_ESTADO } from '@/core/cycle/calibrar-probabilidade'
import { PROBABILIDADE_POR_ESTADO } from '@/core/cycle/valor-em-risco'

/**
 * `docs/73` F1 — a metade do D+E que faltava: hoje só a DATA prevista se autocalibra
 * (`calibracao.ts`); a CHANCE de retorno por estado continua fixa desde o lançamento.
 */

function desfecho(estado: Parameters<typeof calibrarProbabilidadePorEstado>[0][number]['estado'], voltou: boolean) {
  return { estado, voltou }
}

function repetir<T>(quantos: number, fabrica: () => T): T[] {
  return Array.from({ length: quantos }, fabrica)
}

describe('calibrarProbabilidadePorEstado', () => {
  it('lista vazia devolve a tabela padrão inalterada', () => {
    expect(calibrarProbabilidadePorEstado([])).toEqual(PROBABILIDADE_POR_ESTADO)
  })

  it('on_track nunca calibra — a pergunta não faz sentido para quem está em dia', () => {
    // Mesmo com uma amostra enorme, sempre voltando, on_track continua 0: não existe "chance de
    // on_track voltar", quem está em dia não tem receita em risco por definição.
    const desfechos = repetir(50, () => desfecho('on_track', true))
    const calibrado = calibrarProbabilidadePorEstado(desfechos)
    expect(calibrado.on_track).toBe(0)
  })

  it('amostra abaixo do piso mantém o valor padrão daquele estado', () => {
    const desfechos = repetir(MINIMO_POR_ESTADO - 1, () => desfecho('late', true))
    const calibrado = calibrarProbabilidadePorEstado(desfechos)
    expect(calibrado.late).toBe(PROBABILIDADE_POR_ESTADO.late)
  })

  it('exatamente o piso já calibra — o mínimo é inclusivo', () => {
    const desfechos = [...repetir(4, () => desfecho('late', true)), ...repetir(4, () => desfecho('late', false))]
    expect(desfechos.length).toBe(MINIMO_POR_ESTADO)
    const calibrado = calibrarProbabilidadePorEstado(desfechos)
    expect(calibrado.late).toBe(0.5)
  })

  it('calibra o percentual real medido, diferente do padrão', () => {
    // 10 casos em `late`, 4 voltaram — 40%, bem diferente do padrão de 65%.
    const desfechos = [...repetir(4, () => desfecho('late', true)), ...repetir(6, () => desfecho('late', false))]
    const calibrado = calibrarProbabilidadePorEstado(desfechos)
    expect(calibrado.late).toBe(0.4)
    expect(calibrado.late).not.toBe(PROBABILIDADE_POR_ESTADO.late)
  })

  it('cada estado calibra de forma independente, sem vazar entre estados', () => {
    const desfechos = [
      ...repetir(8, () => desfecho('due', true)), // 100% due
      ...repetir(8, () => desfecho('lost', false)), // 0% lost
    ]
    const calibrado = calibrarProbabilidadePorEstado(desfechos)
    expect(calibrado.due).toBe(1)
    expect(calibrado.lost).toBe(0)
    // at_risk não apareceu na amostra — continua o padrão.
    expect(calibrado.at_risk).toBe(PROBABILIDADE_POR_ESTADO.at_risk)
  })

  it('aceita uma tabela padrão diferente da global, para teste isolado do fallback', () => {
    const padraoCustom = { on_track: 0, due: 0.5, late: 0.5, at_risk: 0.5, lost: 0.5 }
    const desfechos = repetir(3, () => desfecho('due', true)) // abaixo do piso
    const calibrado = calibrarProbabilidadePorEstado(desfechos, padraoCustom)
    expect(calibrado.due).toBe(0.5)
    expect(calibrado).not.toBe(padraoCustom) // nunca devolve a MESMA referência — é uma cópia
  })

  it('não muta a tabela padrão recebida', () => {
    const padraoCustom = { on_track: 0, due: 0.5, late: 0.5, at_risk: 0.5, lost: 0.5 }
    const congelado = { ...padraoCustom }
    calibrarProbabilidadePorEstado(repetir(20, () => desfecho('due', true)), padraoCustom)
    expect(padraoCustom).toEqual(congelado)
  })
})
