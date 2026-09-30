import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { falarOcupacaoDoDia } from '@/core/inteligencia/falar'

import { semComentarios } from '../../helpers/fonte'

/**
 * "Livre" e "fechada" mandam a pessoa fazer coisas diferentes, e o assistente dizia a primeira
 * quando a verdade era a segunda.
 *
 * A resposta à pergunta "Tenho horário vago amanhã?": em 30/08 alguém achou, ao vivo, que um dia
 * sem expediente cadastrado (domingo fechado) tem `occupancyRate = 0` mesmo com agendamentos reais,
 * e consertou — pondo o `if (!temExpediente)` DEPOIS do early return de "nenhum agendamento". Com
 * isso o caso mais comum ficou de fora: domingo fechado E sem marcação respondia **"Sim, amanhã sua
 * agenda está totalmente livre."** O dono lê isso e promete horário num dia em que o salão não abre.
 *
 * ## 2026-09-29: de leitura de fonte para comportamento
 *
 * Até aqui esta guarda LIA o texto de `respostas-rapidas.ts` e conferia a ordem dos `if`s — porque
 * a frase morava dentro de uma função com I/O, impossível de chamar sem banco. A frase desceu para
 * `core/inteligencia/falar.ts` (pura), para o Motor de Inteligência dizer a mesma coisa pela mesma
 * função. Agora dá para testar o que importa de verdade: CHAMAR com o dia fechado e ler a resposta.
 *
 * O que a leitura de fonte ainda guarda é a RAIZ: que a resposta rápida usa a função compartilhada
 * e não voltou a escrever a frase por conta própria — uma segunda cópia é onde o defeito voltaria
 * sem que o teste de comportamento visse.
 */

const DIA = 'amanhã (30/09)'

describe('a resposta de horário vago não chama de livre um dia fechado', () => {
  it('dia SEM expediente e SEM marcação: fechada, nunca livre — o caso mais comum dos dois', () => {
    const r = falarOcupacaoDoDia({ rotulo: DIA, quantidade: 0, taxa: 0, temExpediente: false })
    expect(r).toMatch(/fechada/)
    expect(r, '"livre" num dia em que não se abre faz o dono prometer horário que não existe').not.toMatch(/livre/)
    expect(r).toMatch(/^Amanhã \(30\/09\)/)
  })

  it('dia sem expediente COM marcação: diz que não há expediente, não "0% de ocupação"', () => {
    const r = falarOcupacaoDoDia({ rotulo: DIA, quantidade: 2, taxa: 0, temExpediente: false })
    expect(r).toMatch(/Não há expediente cadastrado/)
    expect(r).not.toMatch(/%/)
  })

  it('"totalmente livre" existe — mas só com expediente confirmado e nenhuma marcação', () => {
    expect(falarOcupacaoDoDia({ rotulo: DIA, quantidade: 0, taxa: 0, temExpediente: true })).toBe('Sim, amanhã (30/09) sua agenda está totalmente livre.')
  })

  it('cheia e parcial', () => {
    expect(falarOcupacaoDoDia({ rotulo: DIA, quantidade: 9, taxa: 1, temExpediente: true })).toMatch(/cheia \(100% ocupada\)/)
    expect(falarOcupacaoDoDia({ rotulo: DIA, quantidade: 1, taxa: 0.25, temExpediente: true })).toBe(
      'Sim, amanhã (30/09) você tem horário vago: 1 agendamento marcado, 25% de ocupação.',
    )
  })
})

describe('a resposta rápida usa a frase compartilhada, sem cópia própria', () => {
  const fonte = semComentarios(readFileSync('src/server/assistente/respostas-rapidas.ts', 'utf8'))
  const inicio = fonte.indexOf('async function hojeHorarioVagoAmanha')
  const fim = fonte.indexOf('async function ', inicio + 10)

  it('achou a função (a leitura não passa vazia)', () => {
    expect(inicio, 'a função da pergunta de horário vago sumiu — guarda a revisar').toBeGreaterThan(-1)
    expect(fim, 'não achei o fim da função').toBeGreaterThan(inicio)
  })

  it('chama falarOcupacaoDoDia e não escreve "livre" nem "fechada" por conta própria', () => {
    const corpo = fonte.slice(inicio, fim)
    expect(corpo, 'a resposta rápida parou de usar a frase compartilhada').toMatch(/falarOcupacaoDoDia\(/)
    expect(corpo, 'a resposta rápida voltou a ter frase própria de ocupação — segunda cópia').not.toMatch(/livre|fechada/)
  })
})
