import { Temporal } from '@js-temporal/polyfill'
import { describe, expect, it } from 'vitest'

import { aproveitarOBanho } from '@/core/pet/aproveitar-o-banho'
import { mensagemDoPet, type EntradaDaMensagemDoPet } from '@/core/pet/mensagem'
import type { ItemDoPet, VencimentoDoPet } from '@/core/pet/protocolo'

import { mulberry32 } from '../cycle/cenarios'

const d = (s: string) => Temporal.PlainDate.from(s)
const v = (p: Pick<VencimentoDoPet, 'item' | 'estado'> & Partial<VencimentoDoPet>): VencimentoDoPet => ({ venceEm: d('2026-10-20'), motivo: 'a cada 3 meses', ...p })
const base = (p: Partial<EntradaDaMensagemDoPet> = {}): EntradaDaMensagemDoPet => ({
  nomeDoTutor: 'Ana',
  nomeDoAnimal: 'Thor',
  nomeDoNegocio: 'Pet do Bairro',
  vencimentos: [],
  aplicaVacina: false,
  ...p,
})

describe('a mensagem do pet (C-012)', () => {
  it('item que cabe no banho marcado vira "aproveitar", não ida extra', () => {
    const t = mensagemDoPet(
      base({ vencimentos: [v({ item: 'vermifugo', estado: 'nesta_visita' })], banhoMarcado: { quando: 'sexta, 17/10', itens: ['vermifugo'] } }),
    )
    expect(t).toBe(
      'Oi, Ana! Aqui é da Pet do Bairro.\nNo banho de Thor (sexta, 17/10) dá pra aproveitar e fazer: vermífugo (a cada 3 meses).\nQuer que a gente já deixe separado?',
    )
  })

  it('pet shop que não aplica vacina não oferece vacina no banho: manda combinar com o veterinário', () => {
    const t = mensagemDoPet(
      base({
        vencimentos: [v({ item: 'antirrabica', estado: 'vencido', motivo: 'reforço anual' })],
        banhoMarcado: { quando: 'sexta, 17/10', itens: ['antirrabica'] },
      }),
    )
    expect(t).not.toContain('dá pra aproveitar')
    expect(t).toContain('vacina antirrábica (reforço anual): já está na data (vale combinar com o veterinário)')
  })

  it('quem aplica vacina oferece a vacina no banho', () => {
    const t = mensagemDoPet(
      base({
        aplicaVacina: true,
        vencimentos: [v({ item: 'antirrabica', estado: 'vencido', motivo: 'reforço anual' })],
        banhoMarcado: { quando: 'sexta, 17/10', itens: ['antirrabica'] },
      }),
    )
    expect(t).toContain('dá pra aproveitar e fazer: vacina antirrábica (reforço anual)')
    expect(t).not.toContain('veterinário')
  })

  it('sem registro: pede a carteirinha, nunca "venceu"', () => {
    const t = mensagemDoPet(base({ vencimentos: [v({ item: 'antipulgas', estado: 'perguntar', venceEm: null })] }))
    expect(t).toContain('não temos o registro, vale conferir a carteirinha')
    expect(t).not.toMatch(/venc/i)
    expect(t.endsWith('Quer marcar um horário?')).toBe(true)
  })

  it('vencido primeiro, no máximo 3 motivos, o resto contado; em dia não aparece', () => {
    const t = mensagemDoPet(
      base({
        vencimentos: [
          v({ item: 'antipulgas', estado: 'nesta_visita', motivo: 'fim da proteção do produto aplicado' }),
          v({ item: 'vacina_polivalente', estado: 'perguntar', venceEm: null }),
          v({ item: 'vermifugo', estado: 'vencido' }),
          v({ item: 'antirrabica', estado: 'nesta_visita', motivo: 'reforço anual' }),
          v({ item: 'vermifugo', estado: 'em_dia' }),
        ],
      }),
    )
    const linhas = t.split('\n')
    expect(linhas[1]).toBe('Pela carteirinha de Thor:')
    expect(linhas[2]).toContain('vermífugo')
    expect(t).toContain('e mais 1 item para ver no balcão')
    expect(t.match(/^• /gm)).toHaveLength(4)
  })

  it('nada a lembrar: mensagem vazia', () => {
    expect(mensagemDoPet(base({ vencimentos: [v({ item: 'vermifugo', estado: 'em_dia' })] }))).toBe('')
  })

  it('sem promessa de canal, sem pressão de venda, sem supor gênero', () => {
    const t = mensagemDoPet(base({ vencimentos: [v({ item: 'vermifugo', estado: 'vencido' })], banhoMarcado: { quando: 'sexta', itens: [] } }))
    expect(t).not.toMatch(/vamos (te )?(avisar|mandar|enviar)|automaticamente|urgente|última chance|promoção/i)
    expect(t).not.toMatch(/\b(do|da) Thor\b|obrigad[oa]\b/)
  })
})

/**
 * Placar do C-012: mensagens por animal por ano. "Um lembrete por item" é o que um sistema de
 * lembrete comum faria; "juntando" = o que cabe no banho vai na confirmação do banho (mensagem que já
 * existe), e o resto que vence na mesma semana sai numa mensagem só. 200 cães, 2 anos, sintético.
 */
function mensagensPorAnimalAno(ritmoDoBanho: number) {
  const r = mulberry32(12)
  const inicio = d('2026-01-05')
  const fim = inicio.add({ days: 730 })
  let porItem = 0
  let juntando = 0
  for (let animal = 0; animal < 200; animal++) {
    const banhos: Temporal.PlainDate[] = []
    for (let dia = inicio.add({ days: Math.floor(r() * ritmoDoBanho) }); Temporal.PlainDate.compare(dia, fim) <= 0; ) {
      banhos.push(dia)
      dia = dia.add({ days: Math.max(1, Math.round(ritmoDoBanho + (r() - 0.5) * 4)) })
    }
    const itens: [ItemDoPet, number][] = [['vacina_polivalente', 365], ['antirrabica', 365], ['vermifugo', 91], ['antipulgas', r() < 0.5 ? 30 : 84]]
    const aParte: Temporal.PlainDate[] = []
    for (const [item, intervalo] of itens) {
      let ultima = inicio.subtract({ days: Math.floor(r() * intervalo) })
      for (;;) {
        const venceEm = ultima.add({ days: intervalo })
        if (Temporal.PlainDate.compare(venceEm, fim) > 0) break
        porItem++
        const nb = aproveitarOBanho(banhos, [{ item, venceEm }]).noBanho[0]
        if (nb) ultima = nb.banho
        else {
          aParte.push(venceEm)
          ultima = venceEm
        }
      }
    }
    aParte.sort(Temporal.PlainDate.compare)
    for (let i = 0; i < aParte.length; ) {
      juntando++
      const limite = aParte[i]!.add({ days: 7 })
      while (i < aParte.length && Temporal.PlainDate.compare(aParte[i]!, limite) <= 0) i++
    }
  }
  const anos = 200 * 2
  return { porItem: Math.round((10 * porItem) / anos) / 10, juntando: Math.round((10 * juntando) / anos) / 10 }
}

describe('placar: mensagens de saúde por animal por ano (C-012)', () => {
  const linhas = [7, 14, 21, 30].map((ritmo) => ({ 'banho a cada (d)': ritmo, ...mensagensPorAnimalAno(ritmo) }))

  it('imprime o placar', () => {
    console.table(linhas)
    expect(linhas.every((l) => l.porItem > 0)).toBe(true)
  })

  it('juntando no banho e na semana, o tutor quinzenal recebe menos de 1/3 das mensagens de um lembrete por item', () => {
    const quinzenal = linhas.find((l) => l['banho a cada (d)'] === 14)!
    expect(quinzenal.juntando).toBeLessThan(quinzenal.porItem / 3)
  })
})
