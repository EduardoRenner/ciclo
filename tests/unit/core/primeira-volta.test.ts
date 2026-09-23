import { Temporal } from '@js-temporal/polyfill'
import { describe, expect, it } from 'vitest'

import { primeiraVolta } from '@/core/ciclo/primeira-volta'
import { QUANDO_FOI } from '@/core/ciclo/quando-foi-a-ultima-vez'

const hoje = Temporal.PlainDate.from('2026-09-23')

describe('primeiraVolta — o que o Motor diz quando ninguém está atrasado', () => {
  it('conta os dias até a primeira volta e mostra o dia do mês', () => {
    expect(primeiraVolta('2026-09-29', hoje).descricao).toContain('daqui a 6 dias (29/09)')
  })

  it('atravessa o mês sem errar a conta', () => {
    expect(primeiraVolta('2026-10-05', hoje).descricao).toContain('daqui a 12 dias (05/10)')
  })

  it('amanhã e hoje viram palavra, não "daqui a 1 dia"', () => {
    expect(primeiraVolta('2026-09-24', hoje).descricao).toContain('voltar amanhã.')
    expect(primeiraVolta('2026-09-23', hoje).descricao).toContain('voltar hoje.')
  })

  it('manda a pessoa para o caminho que enche a lista: quem sumiu, com "Um mês" ou mais', () => {
    const { titulo, descricao } = primeiraVolta('2026-09-29', hoje)
    expect(titulo).toBe('Ninguém atrasado por enquanto')
    // O rótulo tem que existir de verdade no seletor, senão a instrução aponta para nada.
    const citado = /"([^"]+)" ou mais/.exec(descricao)?.[1]
    expect(citado, 'a frase deixou de citar um degrau').toBeTruthy()
    expect(QUANDO_FOI.map((q) => q.rotulo)).toContain(citado)
  })

  it('na planilha não manda usar um seletor que aquela tela não tem', () => {
    const { descricao } = primeiraVolta('2026-09-29', hoje, 'planilha')
    expect(descricao).toContain('daqui a 6 dias (29/09)')
    expect(descricao).not.toContain('Um mês')
  })
})
