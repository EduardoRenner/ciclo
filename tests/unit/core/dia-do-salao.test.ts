import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { semComentarios } from '../../helpers/fonte'

import { diaDaquiA, diaDaSemanaNoFuso, diaNoFuso } from '@/core/tempo/dia'

/**
 * `new Date().toISOString().slice(0, 10)` e "hoje em UTC", nao hoje no salao. Em Brasilia (UTC-3)
 * devolve o dia SEGUINTE das 21h a meia-noite, e o projeto ja pagou por isso uma vez — o
 * comentario em `admin/agenda/page.tsx` conta: "o dono fechava a barbearia as 21h30, abria a agenda
 * e via amanha. Tres horas erradas por noite, todas as noites."
 */
const NOITE_DE_BRASILIA = new Date('2026-08-31T23:30:00-03:00')
const SP = 'America/Sao_Paulo'

describe('o dia e o do salao, nao o do servidor', () => {
  it('as 23h30 de 31/08 em Brasilia, o dia ainda e 31/08', () => {
    // O caso do defeito: em UTC ja e 01/09.
    expect(NOITE_DE_BRASILIA.toISOString().slice(0, 10), 'o cenario nao foi montado').toBe('2026-09-01')
    expect(diaNoFuso(SP, NOITE_DE_BRASILIA)).toBe('2026-08-31')
  })

  it('o mesmo instante em Lisboa ja e outro dia — o fuso importa de verdade', () => {
    expect(diaNoFuso('Europe/Lisbon', NOITE_DE_BRASILIA)).toBe('2026-09-01')
  })

  it('validade de 7 dias conta a partir do dia do salao', () => {
    // Era o defeito do orcamento: as 23h30 do dia 31, "7 dias" virava 08/09 em vez de 07/09.
    expect(NOITE_DE_BRASILIA.toISOString().slice(0, 10)).toBe('2026-09-01')
    expect(diaDaquiA(SP, 7, NOITE_DE_BRASILIA)).toBe('2026-09-07')
  })

  it('zero dias e hoje', () => {
    expect(diaDaquiA(SP, 0, NOITE_DE_BRASILIA)).toBe(diaNoFuso(SP, NOITE_DE_BRASILIA))
  })

  it('de manha nao ha divergencia — o defeito e so na janela da noite', () => {
    const manha = new Date('2026-08-31T09:00:00-03:00')
    expect(diaNoFuso(SP, manha)).toBe(manha.toISOString().slice(0, 10))
  })
})

describe('quem grava data de calendario nao confia no fuso do servidor', () => {
  it('assinar() grava started_on explicitamente, sem depender do default da coluna', () => {
    /*
     * `started_on date not null default current_date` (0019) parece inofensivo e nao e:
     * `current_date` roda no fuso da SESSAO, e a do PostgREST e UTC (medido em producao em 31/08).
     * Assinatura feita as 22h do dia 31 em Brasilia nascia comecando no mes seguinte — e isso e
     * data de COBRANCA.
     *
     * Guarda de costura, e nao de comportamento, por um motivo medido: apagar a linha
     * `started_on: diaNoFuso(timezone)` COMPILA e nenhum teste de unidade reprova. O defeito volta
     * calado, exatamente como entrou.
     */
    const fonte = semComentarios(readFileSync('src/server/services/fidelidade.ts', 'utf8'))
    expect(fonte, 'assinar() voltou a depender do default current_date, que e UTC').toContain(
      'started_on: diaNoFuso(timezone)',
    )
  })

  it('o orcamento calcula a validade no fuso do salao', () => {
    // A outra metade da costura ja estava certa: `orcamentoExpirado` confere com tenant.timezone.
    // Gravar em UTC e conferir no fuso do salao e ter duas ideias de "que dia e hoje".
    const fonte = semComentarios(readFileSync('src/app/admin/orcamentos/novo/formulario.tsx', 'utf8'))
    expect(fonte, 'a validade voltou a sair do fuso do aparelho/servidor').toContain('diaDaquiA(timezone,')
    expect(fonte, 'voltou o toISOString().slice para calcular data de calendario').not.toContain('toISOString().slice(0, 10)')
  })
})

/**
 * A mesma armadilha do bloco acima, encontrada num terceiro lugar: `lista-espera.ts` casava a
 * preferência de dia da semana da pessoa com `new Date(startsAt).getUTCDay()`.
 *
 * Medido antes do conserto, com o fuso de São Paulo: uma vaga de **segunda 21:00** era lida como
 * TERÇA, e uma de **sábado 22:00** como DOMINGO. Não é cosmético — é a decisão errando de pessoa:
 * quem pediu "só segundas" não recebia a vaga de segunda à noite, e quem pediu "só terças"
 * recebia.
 *
 * O comentário que estava lá dizia "aproximação; refinar no TICKET-057 se DST virar problema". O
 * problema nunca foi horário de verão — o Brasil não tem desde 2019, então essa condição nunca
 * chegaria. É o deslocamento fixo de -3, que vale todo dia do ano.
 */
describe('o dia da semana também é o do salão', () => {
  it('segunda 21:00 em São Paulo é SEGUNDA, não terça', () => {
    // Em UTC já é terça 00:00 — o caso exato do defeito.
    expect(diaDaSemanaNoFuso(SP, new Date('2026-09-07T21:00:00-03:00'))).toBe(1)
  })

  it('sábado 22:00 em São Paulo é SÁBADO, não domingo', () => {
    expect(diaDaSemanaNoFuso(SP, new Date('2026-09-12T22:00:00-03:00'))).toBe(6)
  })

  it('antes das 21h o dia já batia — o conserto não pode quebrar o que funcionava', () => {
    expect(diaDaSemanaNoFuso(SP, new Date('2026-09-07T18:00:00-03:00'))).toBe(1)
    expect(diaDaSemanaNoFuso(SP, new Date('2026-09-07T20:59:00-03:00'))).toBe(1)
    expect(diaDaSemanaNoFuso(SP, new Date('2026-09-06T09:00:00-03:00'))).toBe(0)
  })

  it('respeita o fuso pedido, não o do processo', () => {
    /*
     * O mesmo instante em dois fusos do Brasil. Em Fernando de Noronha (UTC-2) já é terça quando
     * em São Paulo (UTC-3) ainda é segunda — é o que prova que a função lê o fuso do salão, e não
     * um deslocamento fixo escrito à mão.
     */
    const instante = new Date('2026-09-07T23:30:00-03:00')
    expect(diaDaSemanaNoFuso(SP, instante)).toBe(1)
    expect(diaDaSemanaNoFuso('America/Noronha', instante)).toBe(2)
  })

  it('a fila de espera usa o fuso do salão para casar o dia pedido', () => {
    const fonte = semComentarios(readFileSync('src/server/services/lista-espera.ts', 'utf8'))
    expect(fonte, 'a regra de dia da semana voltou a ler o dia em UTC').not.toContain('getUTCDay()')
    expect(fonte, 'a fila deixou de converter o dia para o fuso do salão').toContain('diaDaSemanaNoFuso(slot.timezone')
  })
})
