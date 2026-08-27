import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { rotaDeCronAgendada } from '../../helpers/cron'

/**
 * A página de agendamento público é a única copy deste produto que fala com o cliente do TENANT —
 * e por isso é onde uma promessa falsa custa mais caro: quem fica mal não é o CICLO, é o salão que
 * confiou nele. A pessoa marca horário, lê que vai receber confirmação, e não recebe.
 *
 * Achado em 2026-08-25, e a promessa era falsa em três níveis independentes:
 *
 *   1. `criarAgendamentoPublico` não manda NADA para o cliente — só um push para a equipe;
 *   2. quem mandaria é `identificarLembretesPendentes`, chamada só por `/api/cron/reminders`;
 *   3. `reminders` está fora do `schedule` de propósito (cabeçalho do `cron.yml`), e o WhatsApp
 *      não tem credencial — e o formulário público nem coleta e-mail, então o fallback também não
 *      alcança ninguém.
 *
 * Irmão do `home-nao-promete-demais`, e existe pela mesma razão: `/precos` tinha teste e não
 * deixou a promessa falsa entrar; as páginas sem teste deixaram.
 */

const AGENDAR = 'src/app/(public)/[slug]/agendar/agendar.tsx'

function copyDaPagina(): string {
  return readFileSync(AGENDAR, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ')
}

describe('o agendamento público não promete canal que não entrega', () => {
  it('não diz que a confirmação vem por WhatsApp enquanto `reminders` não roda', () => {
    if (rotaDeCronAgendada('reminders')) return

    const copy = copyDaPagina()
    // O rótulo do campo ("Seu telefone (WhatsApp)") é legítimo: descreve o que digitar, não
    // promete envio. O que não pode é dizer que ALGO VAI CHEGAR por lá.
    const promessas = [
      /confirmação por WhatsApp/i,
      /receber[áa]? (a )?confirmação/i,
      /vamos (te )?(avisar|mandar|enviar)/i,
      /voc[êe] vai receber/i,
    ]
    const achados = promessas.filter((p) => p.test(copy)).map((p) => p.source)

    expect(
      achados,
      `a página promete ao cliente do salão uma mensagem que nenhum canal entrega — ` +
        `reminders está fora do schedule e o formulário não coleta e-mail. Termos: ${achados.join(', ')}`,
    ).toEqual([])
  })

  it('a frase de canal vem da função, não escrita à mão na tela', () => {
    /*
     * Em 2026-08-27 a lista de regex acima estava verde com *"É por aqui que a confirmação chega"*
     * no ar (`agendar.tsx:667`) — uma quinta redação que nenhuma das quatro pegava. O conserto não
     * foi um quinto regex: a copy virou `core/messaging/promessa.ts`, um lugar só.
     *
     * Esta asserção casa com a CHAMADA (`textoDoCanalDeConfirmacao(`), nunca com o nome solto —
     * o nome aparece também na linha de `import`, e casar com ele seria a guarda cega nº 1 da
     * tabela do `CLAUDE.md`.
     */
    expect(
      /textoDoCanalDeConfirmacao\(/.test(copyDaPagina()),
      'a ajuda do campo de telefone precisa vir de `textoDoCanalDeConfirmacao()` — prosa escrita ' +
        'à mão na tela é como a promessa falsa voltou da última vez',
    ).toBe(true)
  })

  it('continua dizendo o que fazer se a confirmação não vier', () => {
    /*
     * Tirar a promessa falsa não pode virar silêncio: sem o caminho alternativo, a pessoa fica
     * sem saber se o pedido chegou. Erro que só descreve o problema é meio erro — e ausência de
     * instrução é erro inteiro.
     */
    /*
     * `/por telefone|ligar|.../`, e não `/telefone/` solto: a primeira versão desta asserção casava
     * com o RÓTULO DO CAMPO ("Seu telefone (WhatsApp)"), que está sempre lá — então ela passava
     * mesmo com a instrução apagada. O teste de mutação flagrou, pela terceira vez nesta rodada,
     * uma guarda que casava com algo incidental em vez do que importa.
     */
    const copy = copyDaPagina()
    expect(
      /por telefone|ligar|ligue|chamar no/i.test(copy),
      'a página precisa dizer O QUE FAZER se ninguém confirmar — tirar a promessa falsa não pode virar silêncio',
    ).toBe(true)
  })
})
