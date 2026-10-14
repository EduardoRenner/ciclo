import { Temporal } from '@js-temporal/polyfill'
import { describe, expect, it } from 'vitest'

import { aproveitarOBanho } from '@/core/pet/aproveitar-o-banho'
import { vencimentoDoPet, type EntradaDoProtocolo, type ItemDoPet } from '@/core/pet/protocolo'

import { mulberry32 } from '../cycle/cenarios'

const d = (s: string) => Temporal.PlainDate.from(s)
const hoje = d('2026-10-14')
const base = (item: ItemDoPet, p: Partial<EntradaDoProtocolo> = {}): EntradaDoProtocolo => ({ item, nascimento: null, aplicacoes: [], hoje, ...p })

describe('protocolo do pet (C-010)', () => {
  it('filhote sem vacina: 1ª dose com 6 semanas', () => {
    const v = vencimentoDoPet(base('vacina_polivalente', { nascimento: d('2026-09-10') }))
    expect(v.venceEm?.toString()).toBe('2026-10-22')
    expect(v.motivo).toBe('1ª dose da série do filhote')
    expect(v.estado).toBe('em_dia')
  })

  it('série do filhote: a cada 21 dias até uma dose com 16+ semanas; depois, reforço anual', () => {
    const nasc = d('2026-05-01')
    const duas = vencimentoDoPet(base('vacina_polivalente', { nascimento: nasc, aplicacoes: [{ date: d('2026-06-12') }, { date: d('2026-07-03') }] }))
    expect(duas.motivo).toBe('3ª dose da série do filhote')
    expect(duas.venceEm?.toString()).toBe('2026-07-24')
    // 2026-08-21 = 112 dias de vida: fecha a série.
    const fechou = vencimentoDoPet(base('vacina_polivalente', { nascimento: nasc, aplicacoes: [{ date: d('2026-07-24') }, { date: d('2026-08-21') }] }))
    expect(fechou.motivo).toBe('reforço anual')
    expect(fechou.venceEm?.toString()).toBe('2027-08-21')
  })

  it('adulto que chegou vacinado sem data de nascimento: reforço anual da última dose', () => {
    const v = vencimentoDoPet(base('antirrabica', { aplicacoes: [{ date: d('2025-10-10') }] }))
    expect(v.estado).toBe('vencido')
    expect(v.venceEm?.toString()).toBe('2026-10-10')
  })

  it('sem registro e sem idade: pergunta ao tutor, nunca acusa vencido', () => {
    for (const item of ['vacina_polivalente', 'antirrabica', 'vermifugo', 'antipulgas'] as const) {
      const v = vencimentoDoPet(base(item))
      expect(v.estado, item).toBe('perguntar')
      expect(v.venceEm, item).toBeNull()
    }
  })

  it('vermífugo: mensal no filhote, a cada 3 meses no adulto (grupo B), pelo grupo de risco quando informado', () => {
    const nasc = d('2026-06-01')
    expect(vencimentoDoPet(base('vermifugo', { nascimento: nasc, aplicacoes: [{ date: d('2026-09-01') }] })).venceEm?.toString()).toBe('2026-10-01')
    expect(vencimentoDoPet(base('vermifugo', { aplicacoes: [{ date: d('2026-09-01') }] })).venceEm?.toString()).toBe('2026-12-01')
    expect(vencimentoDoPet(base('vermifugo', { aplicacoes: [{ date: d('2026-09-01') }], grupoDeRisco: 'A' })).venceEm?.toString()).toBe('2027-03-02')
  })

  it('antipulgas: vale a duração do produto aplicado', () => {
    expect(vencimentoDoPet(base('antipulgas', { aplicacoes: [{ date: d('2026-09-01'), duracaoDias: 84 }] })).venceEm?.toString()).toBe('2026-11-24')
    expect(vencimentoDoPet(base('antipulgas', { aplicacoes: [{ date: d('2026-09-20') }] })).estado).toBe('nesta_visita')
  })

  it('o protocolo da clínica substitui o padrão', () => {
    const v = vencimentoDoPet(base('vacina_polivalente', { aplicacoes: [{ date: d('2026-01-10') }], intervalos: { reforcoAnualDias: 1095 } }))
    expect(v.venceEm?.toString()).toBe('2029-01-09')
  })
})

describe('aproveitar o banho (C-010)', () => {
  it('item entra no ÚLTIMO banho até 7 dias antes de vencer (o que menos adianta); nunca depois', () => {
    const r = aproveitarOBanho(
      [d('2026-10-01'), d('2026-10-06'), d('2026-10-08'), d('2026-10-15')],
      [
        { item: 'vermifugo', venceEm: d('2026-10-12') },
        { item: 'antipulgas', venceEm: d('2026-10-07') },
        { item: 'antirrabica', venceEm: d('2026-10-30') },
      ],
    )
    expect(r.noBanho.map((x) => [x.item, x.banho.toString()])).toEqual([
      ['vermifugo', '2026-10-08'],
      ['antipulgas', '2026-10-06'],
    ])
    expect(r.aParte.map((x) => x.item)).toEqual(['antirrabica'])
  })
})

/**
 * Placar: 200 cães adultos por ritmo de banho, 2 anos. Cada item de protocolo é feito no banho quando
 * cabe (até 7 dias antes de vencer) ou no próprio vencimento, com mensagem e ida só para isso.
 * Hoje o pet shop que só acompanha o banho não lembra saúde nenhuma: 0 itens lembrados.
 */
function simular(ritmoDoBanho: number, antecipacao = 7) {
  const r = mulberry32(10)
  const inicio = d('2026-01-05')
  const fim = inicio.add({ days: 730 })
  let noBanho = 0
  let aParte = 0
  for (let animal = 0; animal < 200; animal++) {
    const banhos: Temporal.PlainDate[] = []
    for (let dia = inicio.add({ days: Math.floor(r() * ritmoDoBanho) }); Temporal.PlainDate.compare(dia, fim) <= 0; ) {
      banhos.push(dia)
      dia = dia.add({ days: Math.max(1, Math.round(ritmoDoBanho + (r() - 0.5) * 4)) })
    }
    const itens: [ItemDoPet, number][] = [
      ['vacina_polivalente', 365],
      ['antirrabica', 365],
      ['vermifugo', 91],
      ['antipulgas', r() < 0.5 ? 30 : 84],
    ]
    for (const [item, intervalo] of itens) {
      let ultima = inicio.subtract({ days: Math.floor(r() * intervalo) })
      for (;;) {
        const venceEm = ultima.add({ days: intervalo })
        if (Temporal.PlainDate.compare(venceEm, fim) > 0) break
        const { noBanho: nb } = aproveitarOBanho(banhos, [{ item, venceEm }], antecipacao)
        if (nb[0]) {
          noBanho++
          ultima = nb[0].banho
        } else {
          aParte++
          ultima = venceEm
        }
      }
    }
  }
  return { noBanhoPct: Math.round((100 * noBanho) / (noBanho + aParte)), itens: noBanho + aParte }
}

describe('placar: quanto da saúde do animal cabe na visita do banho (C-010)', () => {
  const linhas = [7, 14, 21, 30].map((ritmo) => ({ 'banho a cada (d)': ritmo, 'no banho, até 7 d antes %': simular(ritmo).noBanhoPct, 'no banho, até 14 d antes %': simular(ritmo, 14).noBanhoPct, itens: simular(ritmo).itens }))

  it('imprime o placar', () => {
    console.table(linhas)
    expect(linhas.every((l) => l.itens > 0)).toBe(true)
  })

  it('banho semanal resolve quase toda a saúde no balcão; quinzenal, mais da metade', () => {
    expect(linhas[0]!['no banho, até 7 d antes %']).toBeGreaterThanOrEqual(95)
    expect(linhas[1]!['no banho, até 7 d antes %']).toBeGreaterThanOrEqual(50)
  })
})
