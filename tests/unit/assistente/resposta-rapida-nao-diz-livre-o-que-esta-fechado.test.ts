import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { semComentarios } from '../../helpers/fonte'

/**
 * "Livre" e "fechada" mandam a pessoa fazer coisas diferentes, e o assistente dizia a primeira
 * quando a verdade era a segunda.
 *
 * `hojeHorarioVagoAmanha` responde à pergunta sugerida "Tenho horário vago amanhã?". Em 30/08
 * alguém achou, ao vivo, que um dia sem expediente cadastrado (domingo fechado) tem
 * `occupancyRate = 0` mesmo com agendamentos reais, e consertou — pondo o `if (!temExpediente)`
 * **depois** do early return de "nenhum agendamento".
 *
 * Com isso o caso mais comum de todos ficou de fora: domingo fechado E sem marcação nenhuma caía
 * no ramo antigo e respondia **"Sim, amanhã sua agenda está totalmente livre."** O dono lê isso e
 * promete horário num dia em que o salão não abre.
 *
 * É `consertar-a-pergunta-nao-o-caso` dentro de uma função só: o `if` novo entrou depois do
 * `return` que já existia, então cobriu um ramo e deixou o vizinho.
 *
 * ## Por que a guarda olha a ORDEM
 *
 * Porque o defeito não é uma frase errada — as duas frases estão certas, cada uma no seu mundo. O
 * defeito é qual pergunta se faz primeiro. Uma guarda que só procurasse "totalmente livre"
 * continuaria verde com o `if` de volta no lugar errado.
 */

const ARQUIVO = 'src/server/assistente/respostas-rapidas.ts'
const fonte = semComentarios(readFileSync(ARQUIVO, 'utf8'))

/** Recorta só a função da pergunta de horário vago — o arquivo tem quinze outras. */
function corpoDaFuncao(): string {
  const inicio = fonte.indexOf('async function hojeHorarioVagoAmanha')
  expect(inicio, 'a função da pergunta de horário vago sumiu — guarda a revisar').toBeGreaterThan(-1)
  const fim = fonte.indexOf('async function ', inicio + 10)
  expect(fim, 'não achei o fim da função; o recorte iria até o fim do arquivo').toBeGreaterThan(inicio)
  return fonte.slice(inicio, fim)
}

describe('a resposta de horário vago não chama de livre um dia fechado', () => {
  it('a leitura não voltou vazia', () => {
    expect(corpoDaFuncao().length, 'a função veio vazia').toBeGreaterThan(300)
  })

  it('pergunta pelo EXPEDIENTE antes de perguntar se o dia está vazio', () => {
    const corpo = corpoDaFuncao()
    const expediente = corpo.indexOf('!resumo.temExpediente')
    const vazio = corpo.indexOf('appointments.length === 0')

    expect(expediente, 'sumiu a checagem de expediente — dia fechado voltaria a ser "livre"').toBeGreaterThan(-1)
    expect(vazio, 'sumiu a checagem de dia vazio — guarda a revisar').toBeGreaterThan(-1)
    expect(
      expediente,
      'a checagem de "dia vazio" vem ANTES da de expediente. Nessa ordem, um domingo fechado e sem ' +
        'marcação nenhuma responde "sua agenda está totalmente livre" — e o dono promete horário ' +
        'num dia em que o salão não abre.',
    ).toBeLessThan(vazio)
  })

  it('o dia sem expediente é chamado de fechado, não de vazio', () => {
    const corpo = corpoDaFuncao()
    const i = corpo.indexOf('!resumo.temExpediente')
    const ramo = corpo.slice(i, i + 700)
    expect(
      /fechada/.test(ramo),
      'o ramo do dia sem expediente não diz que a agenda está FECHADA. "Vazia" convida a marcar; ' +
        'só "fechada" manda cadastrar o expediente.',
    ).toBe(true)
  })

  it('"totalmente livre" só existe depois de o expediente estar confirmado', () => {
    const corpo = corpoDaFuncao()
    const livre = corpo.indexOf('totalmente livre')
    const expediente = corpo.indexOf('!resumo.temExpediente')
    expect(livre, 'sumiu a resposta do dia genuinamente livre — ela é a resposta CERTA e precisa existir').toBeGreaterThan(-1)
    expect(livre, '"totalmente livre" está antes da checagem de expediente').toBeGreaterThan(expediente)
  })
})
