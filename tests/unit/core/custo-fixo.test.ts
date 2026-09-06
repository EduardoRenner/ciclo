import { describe, expect, it } from 'vitest'

import { custoFixoDoAtendimento, custoFixoEstaConfigurado, custoPorHoraDaCadeira, lerCustoFixo } from '@/core/comanda/custo-fixo'

/**
 * O "Sobrou" do CICLO era `receita − material − taxa − comissão`: margem de contribuição exibida
 * com cara de lucro. O `docs/47` P05 acusa o setor de mostrar faturamento com cara de lucro; isto
 * é a mesma família, um degrau acima — e o dono que paga R$ 3.500 de aluguel lia "Sobrou R$ 24,00"
 * como o dinheiro que ficou.
 */

const SALAO = { custo_fixo: { mensal_cents: 350_000, horas_por_mes: 260, cadeiras: 2 } }

describe('lerCustoFixo — três perguntas que o dono responde de cabeça', () => {
  it('lê as três respostas', () => {
    expect(lerCustoFixo(SALAO)).toEqual({ mensalCents: 350_000, horasPorMes: 260, cadeiras: 2 })
  })

  /**
   * O caso que separa "nunca respondeu" de "respondeu zero", e é o mesmo motivo pelo qual a taxa
   * da maquininha não usa `Number()`: `Number(null)` é 0, e zero é resposta legítima aqui — quem
   * atende em casa não paga aluguel.
   */
  it('zero de custo mensal é resposta válida, não ausência', () => {
    const emCasa = lerCustoFixo({ custo_fixo: { mensal_cents: 0, horas_por_mes: 160, cadeiras: 1 } })
    expect(emCasa).not.toBeNull()
    expect(emCasa!.mensalCents).toBe(0)
    expect(custoFixoDoAtendimento(emCasa, 60), 'quem não paga aluguel tem custo fixo zero de verdade').toBe(0)
  })

  it.each([
    ['sem a chave', {}],
    ['chave vazia', { custo_fixo: {} }],
    ['sem horas', { custo_fixo: { mensal_cents: 350_000, cadeiras: 2 } }],
    ['horas em texto', { custo_fixo: { mensal_cents: 350_000, horas_por_mes: '260', cadeiras: 2 } }],
    ['zero horas abertas', { custo_fixo: { mensal_cents: 350_000, horas_por_mes: 0, cadeiras: 2 } }],
    ['zero cadeiras', { custo_fixo: { mensal_cents: 350_000, horas_por_mes: 260, cadeiras: 0 } }],
    ['mensal negativo', { custo_fixo: { mensal_cents: -1, horas_por_mes: 260, cadeiras: 2 } }],
  ])('resposta incompleta (%s) devolve null, e null não é zero', (_, settings) => {
    expect(lerCustoFixo(settings)).toBeNull()
  })

  /** Zero horas abertas não é custo infinito por hora: é uma resposta que ainda não faz sentido. */
  it('nenhuma resposta impossível vira número', () => {
    expect(Number.isFinite(custoFixoDoAtendimento(lerCustoFixo({ custo_fixo: { mensal_cents: 1, horas_por_mes: 0, cadeiras: 1 } }), 60))).toBe(true)
  })
})

describe('custoFixoEstaConfigurado — respondeu, mesmo que com zero', () => {
  it('a presença da chave é o carimbo', () => {
    expect(custoFixoEstaConfigurado(SALAO)).toBe(true)
    expect(custoFixoEstaConfigurado({ custo_fixo: { mensal_cents: 0, horas_por_mes: 160, cadeiras: 1 } })).toBe(true)
  })

  it('sem a chave, a pergunta continua aberta', () => {
    expect(custoFixoEstaConfigurado({})).toBe(false)
    expect(custoFixoEstaConfigurado(null)).toBe(false)
  })
})

describe('custoFixoDoAtendimento — o tempo que ocupa a cadeira, ao preço da hora', () => {
  it('divide pelas cadeiras: duas cadeiras, metade do custo por hora cada', () => {
    const custo = lerCustoFixo(SALAO)!
    // R$ 3.500 / 260h / 2 cadeiras = R$ 6,73 a hora de cadeira.
    expect(Math.round(custoPorHoraDaCadeira(custo))).toBe(673)
    expect(custoFixoDoAtendimento(custo, 60)).toBe(673)
    expect(custoFixoDoAtendimento(custo, 30), 'meia hora custa metade').toBe(337)
  })

  it('atendimento longo custa proporcionalmente mais', () => {
    const custo = lerCustoFixo(SALAO)!
    // Uma coloração de 2h ocupa a cadeira o dobro de um corte de 1h.
    expect(custoFixoDoAtendimento(custo, 120)).toBe(custoFixoDoAtendimento(custo, 60) * 2)
  })

  /** Sem as respostas, zero — e a lacuna é quem conta essa história, não o número. */
  it('sem custo configurado devolve zero, e quem avisa é a tela', () => {
    expect(custoFixoDoAtendimento(null, 60)).toBe(0)
  })

  it('duração zero ou negativa não vira crédito', () => {
    const custo = lerCustoFixo(SALAO)!
    expect(custoFixoDoAtendimento(custo, 0)).toBe(0)
    expect(custoFixoDoAtendimento(custo, -60)).toBe(0)
  })

  /**
   * Arredondar uma vez, no fim. Doze atendimentos de 5 minutos arredondados por linha acumulam
   * erro; o mesmo cuidado que `custoDoServico` já toma com a ficha.
   */
  it('arredonda uma vez, no total, e não por minuto', () => {
    const custo = lerCustoFixo({ custo_fixo: { mensal_cents: 100_000, horas_por_mes: 200, cadeiras: 1 } })!
    // R$ 5,00/h → 5 min custam 41,66 centavos.
    expect(custoFixoDoAtendimento(custo, 5)).toBe(42)
    expect(custoFixoDoAtendimento(custo, 60)).toBe(500)
  })
})
