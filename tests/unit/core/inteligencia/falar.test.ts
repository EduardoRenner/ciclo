import { Temporal } from '@js-temporal/polyfill'
import { describe, expect, it } from 'vitest'

import {
  falarAtendidoHoje,
  falarConfirmacoesDeHoje,
  falarFaturamento,
  falarOrcamentosSemResposta,
  falarQuemChamarPrimeiro,
  falarSobra,
  falarSumidosHaMaisDe,
  falarTotalParaRecuperar,
  listarComE,
  rotuloDoDia,
  truncarLista,
} from '@/core/inteligencia/falar'

/**
 * As frases desceram de `respostas-rapidas.ts` para cá em 29/09 (docs/85 MI-2), para o Motor de
 * Inteligência e a resposta rápida dizerem a MESMA coisa pela mesma função. Estes casos fixam o
 * texto exato que a resposta rápida já dizia antes da mudança — a prova de que mover não mudou o
 * que o dono lê. A única mudança de propósito: "agendamento(s)", "dia(s)" e "orçamento(s)" viraram
 * concordância de verdade.
 */

// Espaço fino do Intl (U+00A0) entre "R$" e o número — o formato real, não um espaço comum.
const R = (s: string) => s.replace(/R\$ /g, 'R$ ')

describe('falar — as frases das respostas rápidas, sem mudar uma palavra', () => {
  it('confirmações', () => {
    expect(falarConfirmacoesDeHoje([])).toBe('Ninguém falta confirmar hoje. Tudo certo!')
    expect(falarConfirmacoesDeHoje([{ nome: 'Ana', hora: '10:00' }])).toBe('1 cliente falta confirmar hoje: Ana (10:00).')
    expect(falarConfirmacoesDeHoje([{ nome: 'Ana', hora: '10:00' }, { nome: 'Bia', hora: '11:30' }])).toBe(
      '2 clientes faltam confirmar hoje: Ana (10:00), Bia (11:30).',
    )
  })

  it('"atendeu", nunca "faturou", e aponta para o caixa', () => {
    const r = falarAtendidoHoje(45_000)
    expect(r).toBe(R('Você já atendeu R$ 450,00 hoje, somando o preço de tabela dos atendimentos concluídos. O que entrou de verdade, já com desconto e gorjeta, está no caixa.'))
    expect(r).not.toMatch(/fatur/)
  })

  it('quem chamar primeiro', () => {
    expect(falarQuemChamarPrimeiro(null)).toBe('Ninguém precisa ser chamado agora, a base inteira está em dia.')
    expect(falarQuemChamarPrimeiro({ nome: 'Carla', valorCents: 8_000, diasAtrasado: 12 })).toBe(R('Chame primeiro Carla: R$ 80,00 em risco, 12 dias sem voltar.'))
    expect(falarQuemChamarPrimeiro({ nome: 'Carla', valorCents: 8_000, diasAtrasado: 1 })).toMatch(/1 dia sem voltar/)
    // Quem ainda está CHEGANDO na data entra na fila com atraso zero ou negativo (medido: "-2 dias sem voltar").
    for (const dias of [0, -2]) {
      expect(falarQuemChamarPrimeiro({ nome: 'Carla', valorCents: 8_000, diasAtrasado: dias })).toBe(R('Chame primeiro Carla: R$ 80,00 em risco, ainda na janela de voltar.'))
    }
  })

  it('"dá para recuperar", estimativa e não promessa — nunca "você tem"', () => {
    expect(falarTotalParaRecuperar(0, 0)).toBe('Ninguém para recuperar agora, toda a base está em dia.')
    const r = falarTotalParaRecuperar(3, 12_345)
    expect(r).toMatch(/^Dá para recuperar cerca de R\$ 123,45, de 3 pessoas que estão atrasadas\. É estimativa, não promessa/)
    expect(r).not.toMatch(/você tem/i)
    expect(falarTotalParaRecuperar(1, 100)).toMatch(/de 1 pessoa que/)
  })

  it('sumidos: sem gênero, e a lista corta em 8', () => {
    expect(falarSumidosHaMaisDe(60, [])).toBe('Ninguém sumiu há mais de 60 dias.')
    expect(falarSumidosHaMaisDe(60, ['Ana'])).toBe('1 pessoa sumiu há mais de 60 dias: Ana.')
    expect(falarSumidosHaMaisDe(60, ['Ana', 'Beto'])).toBe('2 pessoas sumiram há mais de 60 dias: Ana e Beto.')
  })

  it('faturamento e sobra: "sobrou", nunca "lucro"; a maquininha só é citada como descontada se foi', () => {
    expect(falarFaturamento(100_000, 'neste mês, até agora')).toBe(R('Você faturou R$ 1.000,00 neste mês, até agora.'))
    const semTaxa = falarSobra(40_000, 'neste mês', false)
    expect(semTaxa).toBe(R('Sobrou R$ 400,00 neste mês, já descontado material e comissão. Ainda não desconta o custo fixo. A maquininha ainda não entra na conta: você não disse quanto ela cobra.'))
    expect(falarSobra(40_000, 'neste mês', true)).toBe(R('Sobrou R$ 400,00 neste mês, já descontado material, taxa da maquininha e comissão. Ainda não desconta o custo fixo.'))
    expect(semTaxa).not.toMatch(/lucro/i)
  })

  it('custo fixo respondido: "sobrou" diz que descontou a hora de cadeira, e para de dizer que não descontou', () => {
    // 29/09: desde a 0072 o "Sobrou" desconta aluguel e contas para quem respondeu as três
    // perguntas — e a frase continuava dizendo "ainda não desconta o custo fixo". Falso para eles.
    const tudo = falarSobra(40_000, 'neste mês', true, true)
    expect(tudo).toBe(R('Sobrou R$ 400,00 neste mês, já descontado material, taxa da maquininha, comissão e a hora de cadeira (aluguel e contas).'))
    expect(tudo).not.toMatch(/Ainda não desconta/)
    expect(falarSobra(40_000, 'neste mês', false, true)).toBe(
      R('Sobrou R$ 400,00 neste mês, já descontado material, comissão e a hora de cadeira (aluguel e contas). A maquininha ainda não entra na conta: você não disse quanto ela cobra.'),
    )
  })

  it('orçamentos', () => {
    expect(falarOrcamentosSemResposta([])).toBe('Nenhum orçamento parado, todos já tiveram resposta.')
    expect(falarOrcamentosSemResposta(['Ana'])).toBe('1 orçamento sem resposta: Ana.')
    expect(falarOrcamentosSemResposta(['Ana', 'Bia'])).toBe('2 orçamentos sem resposta: Ana e Bia.')
  })
})

describe('falar — utilitários', () => {
  it('"A, B e C", e acima de 8 nomes vira "e mais N"', () => {
    expect(listarComE(['A', 'B', 'C'])).toBe('A, B e C')
    expect(listarComE([])).toBe('')
    expect(truncarLista(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'])).toBe('1, 2, 3, 4, 5, 6, 7, 8 e mais 2')
  })

  it('rótulo do dia: hoje, amanhã, ontem, dia da semana na semana, data fora dela', () => {
    const hoje = Temporal.PlainDate.from('2026-09-29') // terça
    expect(rotuloDoDia(hoje, hoje)).toBe('hoje (29/09)')
    expect(rotuloDoDia(hoje.add({ days: 1 }), hoje)).toBe('amanhã (30/09)')
    expect(rotuloDoDia(hoje.subtract({ days: 1 }), hoje)).toBe('ontem (28/09)')
    expect(rotuloDoDia(hoje.add({ days: 3 }), hoje)).toBe('na sexta (02/10)')
    expect(rotuloDoDia(hoje.add({ days: 5 }), hoje)).toBe('no domingo (04/10)')
    expect(rotuloDoDia(hoje.add({ days: 10 }), hoje)).toBe('em 09/10')
  })
})
