import { describe, expect, it } from 'vitest'

import { contarNaJanela, diasNaJanela, janelasDoExperimento, lerExperimento, type EntradaDaLeitura } from '@/core/experimentos/experimento'

// Intl pode usar espaço fixo entre "R$" e o número.
const R = (s: string) => s.replace(/R\$ /g, 'R$ ')

/** Teste de 14 dias começando numa quinta (01/10/2026). */
const BASE: EntradaDaLeitura = {
  startsOn: '2026-10-01',
  dias: 14,
  metrica: 'atendimentos',
  weekday: null,
  antes: { atendimentos: 40, atendidoCents: 400_000 },
  concluidos: [],
  hoje: '2026-10-20',
  cancelado: false,
}

/** n atendimentos por dia em cada dia da lista. */
const em = (dias: string[], porDia = 1, priceCents = 10_000) => dias.flatMap((dia) => Array.from({ length: porDia }, () => ({ dia, priceCents })))
const DURANTE = Array.from({ length: 14 }, (_, i) => `2026-10-${String(i + 1).padStart(2, '0')}`)

describe('experimento — docs/84 Aposta C', () => {
  it('as janelas: os N dias de antes terminam na véspera; o teste começa no dia marcado', () => {
    expect(janelasDoExperimento('2026-10-01', 14)).toEqual({
      antes: { de: '2026-09-17', ate: '2026-09-30' },
      durante: { de: '2026-10-01', ate: '2026-10-14' },
    })
  })

  it('com dia da semana, as duas janelas contam SÓ aquele dia', () => {
    // 01/10/2026 é quinta (4). Em 14 dias há 2 quintas: 01 e 08.
    expect(diasNaJanela({ de: '2026-10-01', ate: '2026-10-14' }, 4)).toBe(2)
    expect(diasNaJanela({ de: '2026-10-01', ate: '2026-10-14' }, null)).toBe(14)
    const c = contarNaJanela(em(['2026-10-01', '2026-10-02', '2026-10-08', '2026-10-15']), { de: '2026-10-01', ate: '2026-10-14' }, 4)
    expect(c).toEqual({ atendimentos: 2, atendidoCents: 20_000 })
  })

  it('subiu: diz quanto, diz que é teste prático, e a amostra vai junto', () => {
    const l = lerExperimento({ ...BASE, concluidos: em(DURANTE, 4) })
    expect(l.estado).toBe('concluido')
    expect(l.durante.atendimentos).toBe(56)
    expect(l.frase).toBe('Durante o teste: 56 atendimentos em 14 dias. Nos 14 dias antes: 40 atendimentos. Subiu 40%. É um teste prático, não uma prova: semana de pagamento e feriado também mexem nesse número.')
    expect(l.amostra).toBe('Indicativo: 14 dias de teste, 96 atendimentos somando os dois períodos.')
    expect(l.frase).not.toMatch(/comprov/i)
  })

  it('diferença miúda é "ficou parecido", não "subiu 5%"', () => {
    const concluidos = [...em(DURANTE, 3), ...em(DURANTE.slice(0, 0))].slice(0, 42)
    expect(lerExperimento({ ...BASE, concluidos }).frase).toMatch(/Ficou parecido \(5% de diferença\)\.$/)
  })

  it('pouco movimento: não lê diferença nenhuma, por maior que ela pareça', () => {
    const l = lerExperimento({ ...BASE, antes: { atendimentos: 3, atendidoCents: 30_000 }, concluidos: em(DURANTE.slice(0, 9)) })
    expect(l.frase).toMatch(/É pouco movimento para ler diferença: pode ser acaso\.$/)
    expect(l.frase).not.toMatch(/Subiu/)
  })

  it('enquanto roda: SEM veredito, e o dia de hoje não conta', () => {
    const l = lerExperimento({ ...BASE, hoje: '2026-10-05', concluidos: em(DURANTE, 4) })
    expect(l.estado).toBe('rodando')
    expect(l.diasCorridos).toBe(4)
    // 4 dias fechados × 4 — o dia 05 (hoje) fica de fora.
    expect(l.durante.atendimentos).toBe(16)
    expect(l.frase).toBe('Em andamento: 4 de 14 dias. Até agora, 16 atendimentos; nos 14 dias antes do teste, 40 atendimentos. O resultado sai quando o teste acabar.')
    expect(l.frase).not.toMatch(/Subiu|Caiu|parecido/)
  })

  it('no primeiro dia: zero dias fechados, zero contados', () => {
    const l = lerExperimento({ ...BASE, hoje: '2026-10-01', concluidos: em(DURANTE, 4) })
    expect(l).toMatchObject({ estado: 'rodando', diasCorridos: 0, durante: { atendimentos: 0 } })
  })

  it('o último dia do teste só conta quando ele acaba', () => {
    expect(lerExperimento({ ...BASE, hoje: '2026-10-14' }).estado).toBe('rodando')
    expect(lerExperimento({ ...BASE, hoje: '2026-10-15' }).estado).toBe('concluido')
  })

  it('agendado: mostra o antes já guardado', () => {
    const l = lerExperimento({ ...BASE, hoje: '2026-09-29', weekday: 4, antes: { atendimentos: 9, atendidoCents: 90_000 } })
    expect(l.estado).toBe('agendado')
    expect(l.frase).toBe('Começa em 01/10. O antes já está guardado: 9 atendimentos em 2 quintas.')
  })

  it('valor atendido fala em reais, e com dia da semana fala em quintas', () => {
    const l = lerExperimento({
      ...BASE,
      metrica: 'atendido_cents',
      weekday: 4,
      antes: { atendimentos: 12, atendidoCents: 120_000 },
      concluidos: em(['2026-10-01', '2026-10-08'], 8, 10_000),
    })
    expect(l.frase).toBe(R('Durante o teste: R$ 1.600,00 em 2 quintas. Nas 2 quintas antes: R$ 1.200,00. Subiu 33%. É um teste prático, não uma prova: semana de pagamento e feriado também mexem nesse número.'))
    expect(l.amostra).toBe('Indicativo: 2 quintas de teste, 28 atendimentos somando os dois períodos.')
  })

  it('concordância: "nas quintas", "nos sábados", e uma quinta só é "na quinta"', () => {
    const rodando = lerExperimento({ ...BASE, weekday: 4, hoje: '2026-10-05' })
    expect(rodando.frase).toMatch(/; nas 2 quintas antes do teste, /)
    // 03/10/2026 é sábado; 7 dias de teste têm 1 sábado de cada lado.
    const sabado = lerExperimento({ ...BASE, startsOn: '2026-10-03', dias: 7, weekday: 6, hoje: '2026-10-20', antes: { atendimentos: 10, atendidoCents: 0 }, concluidos: em(['2026-10-03'], 12) })
    expect(sabado.frase).toMatch(/^Durante o teste: 12 atendimentos em 1 sábado\. No sábado antes: 10 atendimentos\./)
    const quinta = lerExperimento({ ...BASE, dias: 7, weekday: 4, antes: { atendimentos: 10, atendidoCents: 0 }, concluidos: em(['2026-10-01'], 12) })
    expect(quinta.frase).toMatch(/ Na quinta antes: 10 atendimentos\./)
  })

  it('antes zerado: sem porcentagem de zero', () => {
    const l = lerExperimento({ ...BASE, antes: { atendimentos: 0, atendidoCents: 0 }, concluidos: em(DURANTE, 2) })
    expect(l.frase).toMatch(/Antes não havia nenhum; o teste trouxe movimento onde não tinha\.$/)
    expect(l.frase).not.toMatch(/%|Infinity|NaN/)
  })

  it('cancelado: só diz isso', () => {
    expect(lerExperimento({ ...BASE, cancelado: true })).toMatchObject({ estado: 'cancelado', frase: 'Teste cancelado.', amostra: null })
  })
})
