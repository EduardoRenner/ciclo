import { describe, expect, it } from 'vitest'

import { fraseDoRitmo, ritmoDoCliente } from '@/core/ciclo/ritmo-do-cliente'

const HOJE = '2026-09-06'

describe('ritmoDoCliente — a fresta contra o prazo fixo de 45 dias', () => {
  it('com histórico, diz a cadência da pessoa e há quanto tempo ela não vem', () => {
    const r = ritmoDoCliente({ cicloPessoalDias: 18, ultimaVisitaOn: '2026-08-06', hoje: HOJE, visitas: 6 })
    expect(r.cadencia).toBe('Vem a cada 18 dias')
    expect(r.situacao).toBe('veio faz 31 dias')
    expect(fraseDoRitmo(r)).toBe('Vem a cada 18 dias, veio faz 31 dias.')
  })

  /**
   * `personal_cycle_days` nunca é nulo: com uma visita só, `computeCycle` devolve o padrão do
   * SERVIÇO. Dizer "vem a cada 21 dias" nesse caso é apresentar o palpite de catálogo como ritmo
   * pessoal — a mesma acusação que o `docs/47` §1.6 faz ao concorrente, com cara de personalizado.
   */
  it('com uma visita só, NÃO afirma cadência — o número seria o padrão do serviço', () => {
    const r = ritmoDoCliente({ cicloPessoalDias: 21, ultimaVisitaOn: '2026-08-30', hoje: HOJE, visitas: 1 })
    expect(r.cadencia).toBeNull()
    expect(r.procedencia).toBeNull()
    expect(r.situacao).toBe('veio faz 7 dias')
    expect(fraseDoRitmo(r)).toBe('veio faz 7 dias.')
  })

  it('sem visita nenhuma, não há frase para montar', () => {
    const r = ritmoDoCliente({ cicloPessoalDias: 21, ultimaVisitaOn: null, hoje: HOJE, visitas: 0 })
    expect(r.cadencia).toBeNull()
    expect(r.situacao).toBeNull()
    expect(fraseDoRitmo(r)).toBeNull()
  })

  it('amostra pequena vem com procedência; amostra grande não precisa', () => {
    expect(ritmoDoCliente({ cicloPessoalDias: 20, ultimaVisitaOn: '2026-09-01', hoje: HOJE, visitas: 2 }).procedencia).toBe('medido em 1 volta')
    expect(ritmoDoCliente({ cicloPessoalDias: 20, ultimaVisitaOn: '2026-09-01', hoje: HOJE, visitas: 3 }).procedencia).toBe('medido em 2 voltas')
    expect(ritmoDoCliente({ cicloPessoalDias: 20, ultimaVisitaOn: '2026-09-01', hoje: HOJE, visitas: 4 }).procedencia).toBe('medido em 3 voltas')
    expect(ritmoDoCliente({ cicloPessoalDias: 20, ultimaVisitaOn: '2026-09-01', hoje: HOJE, visitas: 5 }).procedencia).toBeNull()
  })

  it('quem veio hoje não lê "veio faz 0 dias"', () => {
    expect(ritmoDoCliente({ cicloPessoalDias: 20, ultimaVisitaOn: HOJE, hoje: HOJE, visitas: 4 }).situacao).toBe('veio hoje')
  })

  it('singular de um dia', () => {
    const r = ritmoDoCliente({ cicloPessoalDias: 1, ultimaVisitaOn: '2026-09-05', hoje: HOJE, visitas: 4 })
    expect(r.cadencia).toBe('Vem a cada 1 dia')
    expect(r.situacao).toBe('veio faz 1 dia')
  })

  /**
   * `last_visit_on` sai do `starts_at` de um atendimento concluído, e dá para concluir um
   * atendimento com data futura (adiantar o fechamento no fim do expediente). "Veio faz −2 dias"
   * na ficha de quem paga não é aceitável.
   */
  it('última visita no futuro não vira contagem negativa', () => {
    expect(ritmoDoCliente({ cicloPessoalDias: 20, ultimaVisitaOn: '2026-09-10', hoje: HOJE, visitas: 4 }).situacao).toBeNull()
  })

  it('a pontuação sai daqui, não da tela', () => {
    const soSituacao = ritmoDoCliente({ cicloPessoalDias: 21, ultimaVisitaOn: '2026-09-05', hoje: HOJE, visitas: 1 })
    expect(fraseDoRitmo(soSituacao)?.startsWith(','), 'a frase começou com a vírgula do trecho que não veio').toBe(false)
  })
})
