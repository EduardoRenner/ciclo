import { describe, expect, it } from 'vitest'

import { reguaDoServico, reguaEfetivaDias } from '@/core/ciclo/regua-do-servico'

/**
 * O produto passou a ter dois números para a mesma coisa: `cycle_days` (palpite de catálogo) e
 * `cycle_days_observado` (a cadência que a clientela daquele salão de fato tem).
 *
 * Mostrar só o medido faria o número mudar sozinho na cara do dono. Mostrar só o configurado joga
 * fora o mecanismo inteiro. A tela mostra o que está EM USO e de onde ele veio.
 */
describe('a régua do serviço diz o que usa e de onde veio', () => {
  it('sem medição: usa o configurado e não inventa procedência', () => {
    expect(reguaDoServico(21, null, null)).toEqual({ diasEmUso: 21, procedencia: null })
  })

  it('com medição maior: usa a medida e diz que a clientela é mais espaçada', () => {
    const regua = reguaDoServico(21, 30, 24)

    expect(regua.diasEmUso).toBe(30)
    expect(regua.procedencia).toContain('24 voltas')
    expect(regua.procedencia).toContain('mais espaçado')
    // A configurada continua visível: é a comparação que é o produto, não o número novo sozinho.
    expect(regua.procedencia).toContain('21d')
  })

  it('com medição menor: a direção inverte', () => {
    const regua = reguaDoServico(45, 28, 60)

    expect(regua.diasEmUso).toBe(28)
    expect(regua.procedencia).toContain('mais curto')
    expect(regua.procedencia).toContain('45d')
  })

  it('medição que CONFIRMA o palpite também é dita', () => {
    // É a única vez em que o dono descobre que o número que ele nunca escolheu está certo.
    const regua = reguaDoServico(21, 21, 40)

    expect(regua.diasEmUso).toBe(21)
    expect(regua.procedencia).toBe('confirmado por 40 voltas')
  })

  it('uma volta só concorda no singular', () => {
    expect(reguaDoServico(21, 30, 1).procedencia).toContain('1 volta ')
  })

  it('medição sem amostra usa o número e cala sobre a origem', () => {
    /*
     * As três colunas são escritas juntas, então isto não deveria acontecer. Mas dado torto não
     * pode virar frase quebrada na tela de quem paga: afirmar "medido em N voltas" sem saber o N
     * é pior que não afirmar nada.
     */
    expect(reguaDoServico(21, 30, null)).toEqual({ diasEmUso: 30, procedencia: null })
    expect(reguaDoServico(21, 30, 0)).toEqual({ diasEmUso: 30, procedencia: null })
  })
})

/**
 * A régua que o Motor USA, e o defeito que fez ela virar função: os dois recálculos (o noturno e o
 * de "concluir atendimento") escreviam a mesma linha de `client_cycles` escolhendo réguas
 * diferentes. Ver `tests/unit/design/regua-do-ciclo-e-uma-so.test.ts`.
 */
describe('reguaEfetivaDias', () => {
  it('sem medição, usa a configurada', () => {
    expect(reguaEfetivaDias(21, null)).toBe(21)
  })

  it('com medição, a medida ganha — é o mecanismo inteiro da 0065', () => {
    expect(reguaEfetivaDias(21, 30)).toBe(30)
  })

  it('medida mais curta que a configurada também ganha', () => {
    expect(reguaEfetivaDias(45, 12)).toBe(12)
  })
})
