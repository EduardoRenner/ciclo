import { describe, expect, it } from 'vitest'

import { compararComCostume, compararComCostumeAteAgora } from '@/core/ciclo/comparacao-com-costume'

describe('compararComCostume', () => {
  it('amostra menor que o piso não compara nada', () => {
    expect(compararComCostume([], 30_000)).toBeNull()
    expect(compararComCostume([20_000], 30_000)).toBeNull()
  })

  it('acima do costume dá percentual positivo', () => {
    // Média de 20000; hoje 30000 → +50%.
    expect(compararComCostume([20_000, 20_000], 30_000)).toEqual({ percentual: 50 })
  })

  it('abaixo do costume dá percentual negativo', () => {
    // Média de 20000; hoje 10000 → -50%.
    expect(compararComCostume([20_000, 20_000], 10_000)).toEqual({ percentual: -50 })
  })

  it('exatamente na média dá zero, não "null" nem erro', () => {
    expect(compararComCostume([20_000, 30_000], 25_000)).toEqual({ percentual: 0 })
  })

  it('média zerada (salão sempre fechou nesse dia) não compara — divisão por zero seria pior que não mostrar', () => {
    expect(compararComCostume([0, 0, 0], 5_000)).toBeNull()
  })

  it('hoje zerado com costume positivo dá -100%, não null', () => {
    expect(compararComCostume([10_000, 10_000], 0)).toEqual({ percentual: -100 })
  })
})

describe('compararComCostumeAteAgora (APR-034)', () => {
  // Costume: dois atendimentos de R$ 50 até as 10h (9h e 9h30) e mais dois à tarde, em 3 dias.
  const dia = { atendimentos: [{ minutoDoDia: 540, cents: 5_000 }, { minutoDoDia: 570, cents: 5_000 }, { minutoDoDia: 900, cents: 8_000 }, { minutoDoDia: 960, cents: 8_000 }] }
  const dias = [dia, dia, dia]

  it('às 10h, dia igual ao costume do mesmo horário: não diz "abaixo"', () => {
    expect(compararComCostumeAteAgora(dias, 10_000, 600)).toEqual({ percentual: 0 })
  })

  it('às 10h, nada atendido e costume de 2 atendimentos até essa hora: diz "abaixo"', () => {
    expect(compararComCostumeAteAgora(dias, 0, 600)).toEqual({ percentual: -100 })
  })

  it('às 7h, antes do primeiro horário de costume: sem comparação', () => {
    expect(compararComCostumeAteAgora(dias, 0, 420)).toBeNull()
  })

  it('o dia inteiro do costume não entra na conta da manhã (era o defeito)', () => {
    // Com a média do dia inteiro (R$ 260), R$ 100 às 10h viraria "62% abaixo".
    expect(compararComCostume([26_000, 26_000, 26_000], 10_000)).toEqual({ percentual: -62 })
    expect(compararComCostumeAteAgora(dias, 10_000, 600)?.percentual).toBe(0)
  })
})
