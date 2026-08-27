import { describe, expect, it } from 'vitest'

import { textoDoCanalDeConfirmacao } from '@/core/messaging/promessa'

/**
 * O irmão de `agendamento-publico-nao-promete-demais.test.ts`, e a razão de ele não ter bastado.
 *
 * Aquela guarda proíbe QUATRO redações de "a confirmação vai chegar". Em 2026-08-27 a página
 * publicada dizia *"É por aqui que a confirmação chega"* — uma quinta redação — e a guarda passava
 * **verde**, com o defeito no ar, na superfície de maior volume do produto.
 *
 * A lição não é acrescentar um quinto regex: é que **lista fechada de sinônimos não fecha um
 * conceito aberto**. Este teste ataca o outro lado — não caça como a frase foi escrita, exercita
 * a única função que tem o direito de escrevê-la, nos dois estados do mundo.
 */

describe('textoDoCanalDeConfirmacao', () => {
  it('com `reminders` FORA do schedule, não afirma que algo chega sozinho', () => {
    const texto = textoDoCanalDeConfirmacao(false)

    // O conceito, não a redação: nada pode dizer que uma mensagem CHEGA por ali, porque nenhuma
    // rota manda. Se um dia a frase mudar de palavras, esta asserção continua valendo.
    expect(/confirma\w*\s+(chega|vem|ser[áa])/i.test(texto), `prometeu chegada: "${texto}"`).toBe(false)
    expect(/voc[êe] (vai|ir[áa]) receber/i.test(texto), `prometeu recebimento: "${texto}"`).toBe(false)

    // E não pode virar silêncio: o campo continua precisando explicar por que pede o telefone.
    expect(texto.trim().length, 'ficou sem explicação nenhuma').toBeGreaterThan(20)
  })

  it('com `reminders` NO schedule, a frase de canal volta — a guarda não trava copy honesta', () => {
    const texto = textoDoCanalDeConfirmacao(true)
    expect(texto).toMatch(/confirma/i)
  })

  it('os dois estados dizem coisas diferentes', () => {
    // Guarda contra o próprio detector: se alguém colapsar os dois ramos num texto só, as duas
    // asserções acima podem continuar passando e a função vira decoração.
    expect(textoDoCanalDeConfirmacao(false)).not.toBe(textoDoCanalDeConfirmacao(true))
  })
})
