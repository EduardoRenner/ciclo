import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { rotaDeCronAgendada } from '../../helpers/cron'
import { semComentarios } from '../../helpers/fonte'

import { textoDoCanalDeConfirmacao, textoDoEnvioAutomatico } from '@/core/messaging/promessa'

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

    /*
     * O conceito, não a redação: nada pode dizer que uma mensagem CHEGA por ali, porque nenhuma
     * rota manda. Se um dia a frase mudar de palavras, esta asserção continua valendo.
     *
     * `[^\s]*` e não `\w*`: em JS sem a flag `u`, `\w` é `[A-Za-z0-9_]` — **`ç` e `ã` não entram**.
     * A primeira versão desta linha era `/confirma\w*\s+chega/i` e **não casava com
     * "confirmação chega"**, que é literalmente a frase que este arquivo existe para proibir.
     * Só apareceu ao rodar a mutação: ela ficou verde, e quem reprovou foi outra asserção.
     * Guarda cega escrita dentro do conserto de uma guarda cega — em português, o acento é o
     * detalhe que faz `\w` mentir.
     */
    expect(/confirma[^\s]*\s+(chega|vem|ser[áa])/i.test(texto), `prometeu chegada: "${texto}"`).toBe(false)
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

/**
 * O mesmo conceito virado para DENTRO do produto. A guarda acima protege a promessa feita à
 * cliente do salão; esta protege a promessa feita ao DONO do salão, no interruptor de
 * `config/mensagens` — que em 2026-08-30 afirmava "saem sozinhos, no horário certo" enquanto
 * `reminders`/`campaigns` estavam fora de `ROTAS_AGENDADAS`. A guarda irmã passava verde porque
 * aquela tela escrevia a frase à mão, sem chamar função nenhuma: guarda não alcança quem não a
 * chama, e é por isso que a copy migrou para cá.
 */
describe('textoDoEnvioAutomatico', () => {
  it('com `reminders` FORA do schedule, não afirma que algo sai sozinho', () => {
    const texto = textoDoEnvioAutomatico(false, false)

    // O conceito, não a redação. `[^\s]*` e não `\w*` pela mesma razão registrada acima: em JS
    // sem a flag `u`, `\w` não casa `ã`/`ç` — "automático" e "automação" escapariam de `\w`.
    expect(/sa[ei]m?\s+sozinh/i.test(texto), `prometeu envio sozinho: "${texto}"`).toBe(false)
    expect(/autom[^\s]*\s+(sai|saem|vai|v[ãa]o)/i.test(texto), `prometeu automação: "${texto}"`).toBe(false)
    expect(/no hor[áa]rio certo/i.test(texto), `prometeu horário certo: "${texto}"`).toBe(false)

    // E não pode virar silêncio: o dono precisa saber que a mensagem depende dele hoje.
    expect(texto.trim().length, 'ficou sem explicação nenhuma').toBeGreaterThan(20)
  })

  it('com `reminders` NO schedule, a frase de automação volta — a guarda não trava copy honesta', () => {
    expect(textoDoEnvioAutomatico(false, true)).toMatch(/sozinh/i)
  })

  it('pausado vence agendado: nem no mundo agendado promete envio', () => {
    // Sem isto, alguém poderia ignorar `pausado` e a tela diria "saem sozinhos" com a pausa ligada.
    expect(/sozinh/i.test(textoDoEnvioAutomatico(true, true))).toBe(false)
  })

  it('os três casos dizem coisas diferentes', () => {
    // Guarda contra o próprio detector, igual à de cima: se alguém colapsar os ramos, as
    // asserções acima podem continuar passando e a função vira decoração.
    const desligado = textoDoEnvioAutomatico(false, false)
    const ligado = textoDoEnvioAutomatico(false, true)
    const pausado = textoDoEnvioAutomatico(true, false)
    expect(new Set([desligado, ligado, pausado]).size).toBe(3)
  })
})

/**
 * **O rótulo, não só a função** — achado da auditoria de 2026-09-08.
 *
 * Os dois blocos acima exercitam as funções que têm o direito de afirmar automação, e passavam
 * verdes enquanto a tela do interruptor dizia, no título, *"Lembretes e campanhas AUTOMÁTICOS"* —
 * contradizendo, no adjetivo, a frase honesta que ela mesma renderiza logo abaixo ("o disparo é
 * seu: a mensagem vai quando você toca em Avisar").
 *
 * É a recorrência que o docstring de `core/messaging/promessa.ts` já previa: a promessa saiu da
 * prosa e sobreviveu no rótulo, um componente acima. Testar a função nunca ia pegar isso.
 *
 * A guarda é amarrada à condição REAL, não a uma lista de palavras: enquanto `reminders` estiver
 * fora do `schedule` do `cron.yml`, o texto fixo da tela não pode afirmar automação. No dia em que
 * entrar, este caso libera sozinho — do mesmo jeito que `home-nao-promete-demais` faz. É assim que
 * a guarda fica do lado certo do tempo, em vez de virar um `skip` que ninguém revisita.
 */
describe('a tela do interruptor não afirma no rótulo o que a função nega no texto', () => {
  const TELA = join('src', 'app', 'admin', 'config', 'mensagens', 'pausar-envios.tsx')

  it('o texto fixo da tela não promete envio automático enquanto o cron não roda', () => {
    if (rotaDeCronAgendada('reminders')) return

    /*
     * Casa a palavra PORTUGUESA, com acento e cercada por limite de palavra. A primeira versão
     * usava `/autom[áa]tic[oa]s?/gi` e reprovava o arquivo já corrigido: casava com `Automatico`
     * dentro do identificador `textoDoEnvioAutomatico`, que é justamente a chamada CERTA. Guarda
     * que reprova o código correto é desligada por quem mantém, não obedecida — e o falso
     * positivo só apareceu porque a mutação foi desfeita e o teste continuou vermelho.
     */
    const copy = semComentarios(readFileSync(TELA, 'utf8'))
    const achados = [...copy.matchAll(/\bautomátic[oa]s?\b/gi)].map((m) => m[0])

    expect(
      achados,
      `${TELA} afirma automação em texto fixo, mas 'reminders' não está no schedule do cron.yml. ` +
        'Quem pode afirmar isso é `textoDoEnvioAutomatico`, que sabe os dois estados do mundo — ' +
        'texto fixo na tela não sabe, e foi assim que a promessa voltou pelo rótulo.',
    ).toEqual([])
  })

  it('e a frase honesta continua vindo da função, não escrita à mão', () => {
    // O outro lado: tirar o adjetivo e também apagar a chamada deixaria a tela muda sobre o que
    // o produto faz de verdade.
    const copy = semComentarios(readFileSync(TELA, 'utf8'))
    expect(/textoDoEnvioAutomatico\(/.test(copy), `${TELA} parou de consultar a fonte da verdade`).toBe(true)
  })
})
