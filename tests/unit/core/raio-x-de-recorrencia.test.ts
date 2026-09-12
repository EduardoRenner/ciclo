import { describe, expect, it } from 'vitest'

import { calcularRaioX, type ClienteElegivel } from '@/core/loyalty/raio-x-de-recorrencia'

describe('calcularRaioX', () => {
  it('sem elegíveis: zero em tudo, sem dividir por zero', () => {
    const r = calcularRaioX([])
    expect(r.totalElegiveis).toBe(0)
    expect(r.ticketMedioCents).toBeNull()
    expect(r.cenarios.every((c) => c.receitaPotencialCents === 0)).toBe(true)
  })

  it('ticket médio é a média simples do ticket dos elegíveis', () => {
    const clientes: ClienteElegivel[] = [
      { cicloPessoalDias: 20, ticketCents: 4000 },
      { cicloPessoalDias: 30, ticketCents: 6000 },
    ]
    const r = calcularRaioX(clientes)
    expect(r.totalElegiveis).toBe(2)
    expect(r.ticketMedioCents).toBe(5000)
  })

  it('cenário de adoção arredonda assinantes para BAIXO — nunca promete gente a mais', () => {
    const clientes: ClienteElegivel[] = Array.from({ length: 7 }, () => ({ cicloPessoalDias: 30, ticketCents: 5000 }))
    const r = calcularRaioX(clientes, [30]) // 30% de 7 = 2.1

    expect(r.cenarios[0]!.assinantesEstimados).toBe(2)
    expect(r.cenarios[0]!.receitaPotencialCents).toBe(2 * 5000)
  })

  it('usa os percentuais passados, não sempre os 3 padrão', () => {
    const clientes: ClienteElegivel[] = [{ cicloPessoalDias: 20, ticketCents: 5000 }]
    const r = calcularRaioX(clientes, [50])
    expect(r.cenarios).toHaveLength(1)
    expect(r.cenarios[0]!.adocaoPercentual).toBe(50)
  })
})
