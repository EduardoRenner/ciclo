import { Temporal } from '@js-temporal/polyfill'
import { describe, expect, it } from 'vitest'

import { janelaDeCobranca, margemDoAssinante } from '@/core/loyalty/margem-do-clube'

const visita = (custoCents: number, semFicha = false) => ({ custoCents, semFicha })

describe('margemDoAssinante', () => {
  it('assinante que veio pouco dá margem folgada', () => {
    const m = margemDoAssinante(12_000, null, [visita(3_000), visita(3_000)])
    expect(m.custoCents).toBe(6_000)
    expect(m.margemCents).toBe(6_000)
    expect(m.noPrejuizo).toBe(false)
  })

  /**
   * `docs/47` P06, e é o caso inteiro: no plano ILIMITADO não há limite para estourar, então o
   * único sinal é a margem. Foi por isso que a pesquisa chamou de "sem aviso prévio".
   */
  it('ilimitado que veio demais vira prejuízo, sem estourar limite nenhum', () => {
    const m = margemDoAssinante(12_000, null, [visita(4_000), visita(4_000), visita(4_000), visita(4_000)])
    expect(m.margemCents).toBe(-4_000)
    expect(m.noPrejuizo).toBe(true)
    expect(m.acimaDoLimite, 'plano ilimitado não tem limite para estourar').toBe(false)
  })

  it('passar do limite e dar prejuízo são coisas diferentes', () => {
    // 5 visitas num plano de 4, e ainda assim sobrando dinheiro.
    const barato = margemDoAssinante(20_000, 4, [visita(1_000), visita(1_000), visita(1_000), visita(1_000), visita(1_000)])
    expect(barato.acimaDoLimite).toBe(true)
    expect(barato.noPrejuizo).toBe(false)

    // Dentro do limite e no vermelho.
    const caro = margemDoAssinante(5_000, 4, [visita(3_000), visita(3_000)])
    expect(caro.acimaDoLimite).toBe(false)
    expect(caro.noPrejuizo).toBe(true)
  })

  it('mês sem visita nenhuma é margem cheia, não erro', () => {
    const m = margemDoAssinante(12_000, 4, [])
    expect(m.visitas).toBe(0)
    expect(m.margemCents).toBe(12_000)
    expect(m.noPrejuizo).toBe(false)
  })

  it('conta quantas visitas entraram sem o material — o que falta continua faltando em voz alta', () => {
    const m = margemDoAssinante(12_000, null, [visita(3_000, true), visita(3_000), visita(3_000, true)])
    expect(m.visitasSemFicha).toBe(2)
  })

  it('margem exatamente zero ainda não é prejuízo', () => {
    expect(margemDoAssinante(6_000, null, [visita(6_000)]).noPrejuizo).toBe(false)
  })
})

describe('janelaDeCobranca', () => {
  const dia = (iso: string) => Temporal.PlainDate.from(iso)

  it('depois do dia de cobrança, a janela é deste mês ao próximo', () => {
    const j = janelaDeCobranca(10, dia('2026-09-15'))
    expect(j.inicio.toString()).toBe('2026-09-10')
    expect(j.fim.toString()).toBe('2026-10-10')
  })

  it('antes do dia de cobrança, a janela ainda é a que começou no mês passado', () => {
    const j = janelaDeCobranca(10, dia('2026-09-03'))
    expect(j.inicio.toString()).toBe('2026-08-10')
    expect(j.fim.toString()).toBe('2026-09-10')
  })

  it('no próprio dia da cobrança, o ciclo novo já começou', () => {
    expect(janelaDeCobranca(10, dia('2026-09-10')).inicio.toString()).toBe('2026-09-10')
  })

  it('vira o ano sem tropeçar', () => {
    const j = janelaDeCobranca(20, dia('2027-01-05'))
    expect(j.inicio.toString()).toBe('2026-12-20')
    expect(j.fim.toString()).toBe('2027-01-20')
  })

  /**
   * `billing_day` é 1..28 por construção (`0019`): é o que garante que a janela existe em
   * fevereiro. O teste guarda a premissa, não a implementação.
   */
  it('dia 28 funciona em fevereiro, inclusive em ano bissexto', () => {
    const j = janelaDeCobranca(28, dia('2028-03-01'))
    expect(j.inicio.toString()).toBe('2028-02-28')
    expect(j.fim.toString()).toBe('2028-03-28')
  })
})
