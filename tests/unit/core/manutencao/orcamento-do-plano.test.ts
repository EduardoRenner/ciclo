import { Temporal } from '@js-temporal/polyfill'
import { describe, expect, it } from 'vitest'

import type { ChaveDoItem } from '@/core/manutencao/itens'
import { orcamentoDoPlano, planoDoCarro, proximoPasso, type PrecoDoItem } from '@/core/manutencao/orcamento-do-plano'
import { resolverPlano, type ItemDoPlano } from '@/core/manutencao/plano'
import { vencimentoDoItem, type VencimentoDoItem } from '@/core/manutencao/vencimento'

import { mulberry32 } from '../cycle/cenarios'

const d = (s: string) => Temporal.PlainDate.from(s)
const hoje = d('2026-10-14')

function v(p: Partial<VencimentoDoItem> & Pick<VencimentoDoItem, 'item' | 'estado'>): VencimentoDoItem {
  return { venceEm: null, relogio: null, porUso: null, porTempo: null, porDesgaste: null, ritmo: { porDia: 38, origem: 'medido', leituras: 4 }, kmDeVencimento: null, ...p }
}

const plano: ItemDoPlano[] = [
  { item: 'oleo_motor', intervalo: { km: 10_000, meses: 12 }, origem: 'modelo', fonte: 'manual do Onix 2021' },
  { item: 'fluido_freio', intervalo: { meses: 24 }, origem: 'generico', fonte: 'plano genérico do perfil' },
  { item: 'filtro_ar', intervalo: { km: 30_000, meses: 24 }, origem: 'generico', fonte: 'plano genérico do perfil' },
  { item: 'velas', intervalo: { km: 40_000 }, origem: 'generico', fonte: 'plano genérico do perfil' },
]

const vencimentos = [
  v({ item: 'oleo_motor', estado: 'nesta_visita', relogio: 'uso', kmDeVencimento: 41_600, venceEm: d('2026-10-22') }),
  v({ item: 'fluido_freio', estado: 'vencido', relogio: 'tempo', venceEm: d('2026-07-10') }),
  v({ item: 'filtro_ar', estado: 'em_dia', relogio: 'uso', venceEm: d('2027-01-20') }),
  v({ item: 'velas', estado: 'em_dia', relogio: 'uso', venceEm: d('2027-02-05') }),
  v({ item: 'bateria', estado: 'em_dia', relogio: 'tempo', venceEm: d('2028-03-01') }),
  v({ item: 'alinhamento', estado: 'perguntar' }),
]

describe('o plano do carro (AUT-402, C-019)', () => {
  it('agrupa em vencido, nesta visita, próxima visita (com data) e em dia depois; sem registro vai para conferir', () => {
    const g = planoDoCarro(vencimentos, hoje)
    expect(g.vencidos.map((x) => x.item)).toEqual(['fluido_freio'])
    expect(g.nestaVisita.map((x) => x.item)).toEqual(['oleo_motor'])
    expect(g.proxima?.quando.toString()).toBe('2027-01-20')
    expect(g.proxima?.itens.map((x) => x.item)).toEqual(['filtro_ar', 'velas'])
    expect(g.emDiaDepois).toBe(1)
    expect(g.conferir.map((x) => x.item)).toEqual(['alinhamento'])
  })
})

describe('o orçamento montado pelo plano (AUT-403, C-019)', () => {
  const precos: Partial<Record<ChaveDoItem, PrecoDoItem>> = {
    oleo_motor: { pecaCents: 18_000, maoDeObraCents: 6_000 },
    fluido_freio: { pecaCents: 6_000, maoDeObraCents: 8_000 },
    filtro_ar: { pecaCents: 5_000, maoDeObraCents: 2_000 },
  }
  const o = orcamentoDoPlano({ vencimentos, plano, precos, kmAtual: 41_300, hoje, medicoes: { oleo_motor: { valor: 30, unidade: '%', temFoto: true } } })

  it('só entra o que vence agora; cada linha diz a regra e o relógio', () => {
    expect(o.linhas.map((l) => l.item)).toEqual(['fluido_freio', 'oleo_motor'])
    expect(o.linhas[1]!.motivo).toBe('pelo manual do modelo (a cada 10.000 km ou 12 meses): pela quilometragem, faltam ~300 km')
    expect(o.linhas[0]!.motivo).toBe('pelo plano genérico (a cada 24 meses): pelo tempo desde a última troca')
    expect(o.linhas[1]!.medicao).toBe('medido: 30% (com foto)')
    expect(o.totalCents).toBe(38_000)
  })

  it('o que não venceu vai para "pode esperar" com a data; sem registro vai para "conferir", sem preço', () => {
    expect(o.podeEsperar.map((x) => [x.item, x.quando])).toEqual([
      ['filtro_ar', 'por volta de jan/2027'],
      ['velas', 'por volta de fev/2027'],
      ['bateria', 'por volta de mar/2028'],
    ])
    expect(o.conferir.map((x) => x.item)).toEqual(['alinhamento'])
  })

  it('item que vence sem preço cadastrado aparece sem valor inventado', () => {
    const r = orcamentoDoPlano({ vencimentos, plano, precos: { oleo_motor: precos.oleo_motor! }, kmAtual: 41_300, hoje })
    expect(r.semPreco.map((x) => x.item)).toEqual(['fluido_freio'])
    expect(r.totalCents).toBe(24_000)
  })
})

describe('o próximo passo no comprovante (AUT-405, C-019)', () => {
  it('km pela regra e a data do que vencer primeiro', () => {
    const t = proximoPasso({ item: 'oleo_motor', intervalo: { km: 10_000, meses: 12 }, feitoEm: { date: hoje, km: 41_300 }, ritmoMedidoKmPorDia: 38 })
    expect(t).toBe('Próxima vez (óleo do motor e filtro de óleo): ~51.300 km, por volta de jul/2027.')
  })

  it('sem ritmo medido, a data sai só pelo tempo', () => {
    const t = proximoPasso({ item: 'oleo_motor', intervalo: { km: 10_000, meses: 12 }, feitoEm: { date: hoje, km: 41_300 }, ritmoMedidoKmPorDia: null })
    expect(t).toContain('por volta de out/2027')
  })
})

/**
 * Placar: 200 carros sintéticos (perfil flex, 4 leituras de km, última troca de cada item sorteada).
 * "Revisão completa" = o orçamento de quem cobra tudo que vence nos próximos 90 dias. Pelo plano, só o
 * que vence agora (30 dias) e o resto em "pode esperar". Preço sintético por item, igual nos dois.
 */
describe('placar: valor que o orçamento pelo plano deixa de empurrar (C-019)', () => {
  const r = mulberry32(19)
  const planoGenerico = resolverPlano({ perfil: 'carro_flex_aspirado', cambio: 'manual' })
  const precos = Object.fromEntries(planoGenerico.map((p, i) => [p.item, { pecaCents: 5_000 + 1_000 * i, maoDeObraCents: 4_000 }])) as Partial<Record<ChaveDoItem, PrecoDoItem>>
  let revisaoCompleta = 0
  let peloPlano = 0
  let linhasComMotivo = 0
  let linhas = 0
  for (let carro = 0; carro < 200; carro++) {
    const kmPorDia = 15 + r() * 60
    const leituras = [0, 1, 2, 3].map((k) => ({ date: hoje.subtract({ days: 90 * (3 - k) }), uso: Math.round(40_000 + kmPorDia * 90 * k) }))
    const kmAtual = leituras[3]!.uso
    const vs = planoGenerico.map((p) => {
      const diasAtras = Math.floor(r() * 900)
      return vencimentoDoItem({
        item: p.item,
        intervalo: p.intervalo,
        ultimoFeito: { date: hoje.subtract({ days: diasAtras }), km: Math.max(0, Math.round(kmAtual - kmPorDia * diasAtras)) },
        leituras,
        severo: false,
        hoje,
        ritmoDeReferencia: 36,
      })
    })
    const o = orcamentoDoPlano({ vencimentos: vs, plano: planoGenerico, precos, kmAtual, hoje })
    peloPlano += o.totalCents
    linhas += o.linhas.length
    linhasComMotivo += o.linhas.filter((l) => /^pelo .+: .+/.test(l.motivo)).length
    const limite = hoje.add({ days: 90 })
    revisaoCompleta += vs
      .filter((x) => x.venceEm && Temporal.PlainDate.compare(x.venceEm, limite) <= 0)
      .reduce((s, x) => s + (precos[x.item]!.pecaCents + precos[x.item]!.maoDeObraCents), 0)
  }
  const reais = (c: number) => Math.round(c / 100 / 200)

  it('imprime o placar', () => {
    console.table([{ 'revisão completa (R$/carro)': reais(revisaoCompleta), 'pelo plano (R$/carro)': reais(peloPlano), 'linhas com motivo %': Math.round((100 * linhasComMotivo) / linhas) }])
    expect(linhas).toBeGreaterThan(0)
  })

  it('toda linha diz a regra e o relógio; o orçamento pelo plano cobra menos que a "revisão completa"', () => {
    expect(linhasComMotivo).toBe(linhas)
    expect(peloPlano).toBeLessThan(revisaoCompleta)
  })
})
