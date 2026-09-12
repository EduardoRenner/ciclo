import { Temporal } from '@js-temporal/polyfill'
import { describe, expect, it } from 'vitest'

import { computeCycle } from '@/core/cycle/compute'
import { dataDaUltimaVez, diasDesde, QUANDO_FOI, VALORES_DE_QUANDO } from '@/core/ciclo/quando-foi-a-ultima-vez'

/**
 * A escada de "quando foi a última vez", respondida de memória.
 *
 * O caso que sustenta a tela inteira é o último deste arquivo: ele prova que a APROXIMAÇÃO é
 * suficiente — que dizer "uns 15 dias" em vez da data exata não muda o que o Motor conclui. Se isso
 * deixar de valer, a tela `/admin/clientes/ja-atendo` passa a produzir ciclo errado com cara de
 * certo, e é esse caso que precisa gritar.
 */
describe('quando foi a última vez', () => {
  const hoje = Temporal.PlainDate.from('2026-09-11')

  it('cada degrau tem os dias que promete', () => {
    expect(diasDesde('semana')).toBe(7)
    expect(diasDesde('quinzena')).toBe(15)
    expect(diasDesde('mes')).toBe(30)
    expect(diasDesde('dois-meses')).toBe(60)
    expect(diasDesde('faz-tempo')).toBe(120)
  })

  it('a data sai de `hoje`, não do relógio', () => {
    expect(dataDaUltimaVez('quinzena', hoje).toString()).toBe('2026-08-27')
    expect(dataDaUltimaVez('mes', hoje).toString()).toBe('2026-08-12')
  })

  it('degrau desconhecido LANÇA em vez de virar um padrão plausível', () => {
    // Um `?? 30` silencioso transformaria erro de digitação numa data crível, e a pessoa veria uma
    // previsão errada sem nada indicando que houve problema.
    expect(() => diasDesde('ontem' as never)).toThrow(/desconhecido/)
  })

  it('a escada cresce sempre, e nenhum rótulo se repete', () => {
    // Guarda contra reordenar ou duplicar um degrau: dois rótulos iguais na tela, ou uma escada que
    // volta atrás, não dão erro em lugar nenhum — só produzem escolha sem sentido.
    const dias = QUANDO_FOI.map((q) => q.dias)
    expect(dias).toEqual([...dias].sort((a, b) => a - b))
    expect(new Set(dias).size).toBe(dias.length)
    expect(new Set(QUANDO_FOI.map((q) => q.rotulo)).size).toBe(QUANDO_FOI.length)
    expect(VALORES_DE_QUANDO.length).toBe(QUANDO_FOI.length)
  })

  it('APROXIMAR BASTA: errar alguns dias não tira nem põe ninguém na lista de recuperação', () => {
    /*
      A premissa da tela, e ela foi CORRIGIDA por este próprio caso em 2026-09-11.

      A primeira versão afirmava coisa mais forte — que o ESTADO não muda — e ficou vermelha: com
      ciclo de 30, 30 dias atrás dá `due` e 33 dias dá `late`, porque `estadoPorAtraso` corta em
      `lateDays <= 0`. A afirmação estava errada; a tela, não.

      O que decide o produto não é o rótulo, é a LISTA. `v_clientes_a_recuperar` (0058) filtra
      `state in ('due','late','at_risk','lost')` — ou seja, tudo que não é `on_track`. E a única
      fronteira do `on_track` está em `lateDays < -3`, três dias ANTES da volta prevista.

      Então o erro que a memória comete (dias) não move ninguém para dentro ou para fora da lista; o
      que moveria é errar de degrau (semanas), e os degraus estão longe o bastante um do outro.
    */
    const ciclo = 30
    const apareceNaLista = (diasAtras: number) =>
      computeCycle({ history: [{ date: hoje.subtract({ days: diasAtras }) }], defaultCycleDays: ciclo, today: hoje }).state !== 'on_track'

    for (const dias of [27, 28, 30, 33, 36]) {
      expect(apareceNaLista(dias), `${dias} dias com ciclo de ${ciclo} deveria contar como "dá para recuperar"`).toBe(true)
    }
  })

  it('mas a escada SEPARA de verdade: os extremos não caem no mesmo estado', () => {
    // O par do caso acima, e o que impede ele de passar por motivo errado: se `computeCycle`
    // devolvesse sempre a mesma coisa, o teste anterior passaria vazio.
    const ciclo = 30
    const estadoEm = (diasAtras: number) =>
      computeCycle({ history: [{ date: hoje.subtract({ days: diasAtras }) }], defaultCycleDays: ciclo, today: hoje }).state

    expect(estadoEm(diasDesde('semana')), 'quem veio semana passada não pode estar atrasado').toBe('on_track')
    expect(estadoEm(diasDesde('faz-tempo')), 'quem sumiu há 4 meses não pode estar em dia').not.toBe('on_track')
  })
})
