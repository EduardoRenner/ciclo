import { describe, expect, it } from 'vitest'

import {
  algumEstadoFoiCalibrado,
  calibrarProbabilidadeDeResolvidas,
  calibrarProbabilidadePorEstado,
  MINIMO_POR_ESTADO,
} from '@/core/cycle/calibrar-probabilidade'
import { JANELA_DE_ESPERA_DIAS, type PrevisaoAuditada } from '@/core/cycle/prestacao-de-contas'
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

/**
 * A ponte entre `cycle_predictions` cru (as mesmas linhas que `prestacaoDeContas` já lê) e a
 * calibração por estado. O caso que justifica o arquivo inteiro: alguém que volta 35 dias
 * atrasada — depois de já ter passado pela faixa que hoje mostraria "perdida" — é o dado que
 * falta para responder "de quem chega a 'perdida', quantos ainda voltam?".
 */
describe('calibrarProbabilidadeDeResolvidas', () => {
  const HOJE = '2026-06-01'

  function previsao(predictedOn: string, actualReturnOn: string | null): PrevisaoAuditada {
    return { predictedOn, actualReturnOn }
  }

  it('resolvida no dia certo (atraso 0) vira estado due, e conta como conversão', () => {
    const previsoes = repetir(MINIMO_POR_ESTADO, () => previsao('2026-01-01', '2026-01-01'))
    const calibrado = calibrarProbabilidadeDeResolvidas(previsoes, HOJE)
    expect(calibrado.due).toBe(1)
  })

  it('quem volta 35 dias atrasada conta em LOST, mesmo tendo voltado — o caso central do recurso', () => {
    // 8 voltaram 35 dias atrasadas (estado lost na hora da volta), 8 nunca voltaram e já
    // passaram da janela de espera (também lost). A calibrada não é nem 0% nem 100%: é 50%.
    const previsoes = [
      ...repetir(MINIMO_POR_ESTADO, () => previsao('2026-01-01', '2026-02-05')), // 35 dias atrasada, voltou
      ...repetir(MINIMO_POR_ESTADO, () => previsao('2026-01-01', null)), // nunca voltou
    ]
    const calibrado = calibrarProbabilidadeDeResolvidas(previsoes, HOJE)
    expect(calibrado.lost).toBe(0.5)
  })

  it('não resolvida mas já passou da janela de espera conta como não-voltou (lost)', () => {
    const passouDaJanela = new Date(Date.parse('2026-01-01T12:00:00Z') + (JANELA_DE_ESPERA_DIAS + 1) * 86_400_000)
      .toISOString()
      .slice(0, 10)
    const previsoes = repetir(MINIMO_POR_ESTADO, () => previsao('2026-01-01', null))
    const calibrado = calibrarProbabilidadeDeResolvidas(previsoes, passouDaJanela)
    expect(calibrado.lost).toBe(0)
  })

  it('não resolvida e ainda dentro da janela fica FORA da amostra — outcome indeterminado', () => {
    // 15 dias depois da data prevista: ainda dentro de JANELA_DE_ESPERA_DIAS (30). Se isto
    // entrasse na amostra como "não voltou", inflaria a taxa de não-conversão com gente que
    // ainda pode aparecer amanhã.
    const aindaNaJanela = new Date(Date.parse('2026-01-01T12:00:00Z') + 15 * 86_400_000).toISOString().slice(0, 10)
    const previsoes = repetir(50, () => previsao('2026-01-01', null))
    const calibrado = calibrarProbabilidadeDeResolvidas(previsoes, aindaNaJanela)
    // Sem nenhum desfecho decidido, a tabela inteira continua igual ao padrão.
    expect(calibrado).toEqual(PROBABILIDADE_POR_ESTADO)
  })

  it('lista vazia devolve o padrão', () => {
    expect(calibrarProbabilidadeDeResolvidas([], HOJE)).toEqual(PROBABILIDADE_POR_ESTADO)
  })

  it('aceita tabela padrão custom, do mesmo jeito que calibrarProbabilidadePorEstado', () => {
    const padraoCustom = { on_track: 0, due: 0.5, late: 0.5, at_risk: 0.5, lost: 0.5 }
    const calibrado = calibrarProbabilidadeDeResolvidas([], HOJE, padraoCustom)
    expect(calibrado).toEqual(padraoCustom)
  })
})

/**
 * `docs/73` T4: a tela "Recuperar receita" só sabe SE tem algo novo para dizer — o rótulo em
 * português de cada estado é vocabulário de UI, e `core/` não pode conhecê-lo (regra 5).
 */
describe('algumEstadoFoiCalibrado', () => {
  it('tabela idêntica ao padrão: nada foi calibrado', () => {
    expect(algumEstadoFoiCalibrado(PROBABILIDADE_POR_ESTADO)).toBe(false)
  })

  it('um estado diferente do padrão: já calibrou', () => {
    const calibrada = { ...PROBABILIDADE_POR_ESTADO, late: 0.4 }
    expect(algumEstadoFoiCalibrado(calibrada)).toBe(true)
  })

  it('on_track diferente do padrão não conta — nunca calibra por definição', () => {
    // Não deveria acontecer na prática (algumEstadoFoiCalibrado nunca calibra on_track sozinha),
    // mas se alguém passar uma tabela manualmente com on_track alterado, isso não é "calibração".
    const calibrada = { ...PROBABILIDADE_POR_ESTADO, on_track: 0.1 }
    expect(algumEstadoFoiCalibrado(calibrada)).toBe(false)
  })

  it('aceita tabela padrão custom para comparar contra', () => {
    const padraoCustom = { on_track: 0, due: 0.5, late: 0.5, at_risk: 0.5, lost: 0.5 }
    expect(algumEstadoFoiCalibrado(padraoCustom, padraoCustom)).toBe(false)
    expect(algumEstadoFoiCalibrado({ ...padraoCustom, lost: 0.2 }, padraoCustom)).toBe(true)
  })
})
