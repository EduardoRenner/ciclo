import { describe, expect, it } from 'vitest'

import { sinalEmCentavos } from '@/core/pricing/sinal'

describe('sinalEmCentavos', () => {
  it('calcula o percentual sobre o preço', () => {
    // 30% de R$ 70,00
    expect(sinalEmCentavos({ precoCents: 7000, depositBps: 3000, depositMinCents: 0 })).toBe(2100)
  })

  it('arredonda para cima, para o piso continuar sendo um piso', () => {
    // 33% de R$ 45,01 = 1485,33 centavos
    expect(sinalEmCentavos({ precoCents: 4501, depositBps: 3300, depositMinCents: 0 })).toBe(1486)
  })

  it('respeita o piso quando o percentual fica abaixo dele', () => {
    // 10% de R$ 35,00 = R$ 3,50, mas o piso é R$ 10,00
    expect(sinalEmCentavos({ precoCents: 3500, depositBps: 1000, depositMinCents: 1000 })).toBe(1000)
  })

  /**
   * Casa com o defeito, não com o nome: sem o teto, um piso alto sobre serviço barato faria a
   * cliente adiantar mais do que o serviço inteiro custa.
   */
  it('nunca pede mais que o preço do serviço', () => {
    expect(sinalEmCentavos({ precoCents: 3000, depositBps: 5000, depositMinCents: 9900 })).toBe(3000)
    expect(sinalEmCentavos({ precoCents: 3000, depositBps: 10000, depositMinCents: 0 })).toBe(3000)
  })

  /**
   * O caso que decide se o produto inteiro passa a pedir sinal por engano: um piso configurado
   * com percentual zerado significa "não cobro", não "cobro o piso".
   */
  it('piso sozinho, sem percentual, NÃO liga o sinal', () => {
    expect(sinalEmCentavos({ precoCents: 7000, depositBps: 0, depositMinCents: 5000 })).toBeNull()
  })

  it('devolve null quando não há sinal, para a tela não anunciar R$ 0,00', () => {
    expect(sinalEmCentavos({ precoCents: 7000, depositBps: 0, depositMinCents: 0 })).toBeNull()
    expect(sinalEmCentavos({ precoCents: 0, depositBps: 3000, depositMinCents: 0 })).toBeNull()
  })
})
