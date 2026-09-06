import { describe, expect, it } from 'vitest'

import { lucroDoCliente } from '@/core/crm/lucro-do-cliente'

describe('lucroDoCliente', () => {
  it('todas as visitas com comanda: cobertura completa e projeção anual', () => {
    const r = lucroDoCliente({ lucroCents: 24_000, comandas: 12, visitas: 12, cicloPessoalDias: 30 })
    expect(r.lucroCents).toBe(24_000)
    expect(r.lucroPorVisitaCents).toBe(2_000)
    expect(r.lucroAnualCents).toBe(Math.round(2_000 * (365 / 30)))
    expect(r.cobertura).toBe('completa')
    expect(r.visitasSemComanda).toBe(0)
  })

  it('visita sem comanda vira cobertura parcial, e o número diz de quantas está falando', () => {
    const r = lucroDoCliente({ lucroCents: 6_000, comandas: 3, visitas: 10, cicloPessoalDias: 21 })
    expect(r.cobertura).toBe('parcial')
    expect(r.visitasSemComanda).toBe(7)
  })

  it('sem comanda nenhuma não há lucro por visita — e nem NaN', () => {
    const r = lucroDoCliente({ lucroCents: 0, comandas: 0, visitas: 4, cicloPessoalDias: 21 })
    expect(r.lucroPorVisitaCents).toBeNull()
    expect(r.lucroAnualCents).toBeNull()
    expect(r.cobertura).toBe('nenhuma')
  })

  /**
   * `docs/48` C2 define o anual como C1 × ciclo. Sem cadência medida não existe "× ciclo" — e
   * `null` é a resposta certa, não zero: zero se lê como "essa pessoa não deixa nada".
   */
  it('sem cadência medida, não se projeta o ano', () => {
    expect(lucroDoCliente({ lucroCents: 10_000, comandas: 5, visitas: 5, cicloPessoalDias: null }).lucroAnualCents).toBeNull()
    expect(lucroDoCliente({ lucroCents: 10_000, comandas: 5, visitas: 5, cicloPessoalDias: 0 }).lucroAnualCents).toBeNull()
  })

  /**
   * `docs/47` P01 em um caso: quem fatura mais não é quem deixa mais. Este é o par que justifica a
   * coluna existir.
   */
  it('o cliente de ticket alto e comissão alta deixa menos que o de ticket baixo e ciclo curto', () => {
    // Progressiva de R$ 300, 60% de comissão, a cada 90 dias → R$ 120 por visita, 4 visitas/ano.
    const progressiva = lucroDoCliente({ lucroCents: 12_000, comandas: 1, visitas: 1, cicloPessoalDias: 90 })
    // Corte de R$ 50, sem comissão, a cada 14 dias → R$ 50 por visita, 26 visitas/ano.
    const corte = lucroDoCliente({ lucroCents: 5_000, comandas: 1, visitas: 1, cicloPessoalDias: 14 })

    expect(progressiva.lucroPorVisitaCents!).toBeGreaterThan(corte.lucroPorVisitaCents!)
    expect(corte.lucroAnualCents!, 'no ano, quem volta mais deixa mais').toBeGreaterThan(progressiva.lucroAnualCents!)
  })

  it('comanda a mais que visita (comanda avulsa, sem agendamento) não vira visita negativa', () => {
    expect(lucroDoCliente({ lucroCents: 5_000, comandas: 3, visitas: 1, cicloPessoalDias: 21 }).visitasSemComanda).toBe(0)
  })

  it('cliente que deu prejuízo mostra prejuízo, e a projeção acompanha', () => {
    const r = lucroDoCliente({ lucroCents: -2_000, comandas: 2, visitas: 2, cicloPessoalDias: 30 })
    expect(r.lucroPorVisitaCents).toBe(-1_000)
    expect(r.lucroAnualCents!).toBeLessThan(0)
  })
})
