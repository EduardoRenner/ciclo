import { Temporal } from '@js-temporal/polyfill'
import { describe, expect, it } from 'vitest'

import { ITENS, type ChaveDoItem } from '@/core/manutencao/itens'
import { resolverPlano } from '@/core/manutencao/plano'
import { agruparEmVisitas } from '@/core/manutencao/visitas'

const d = (s: string) => Temporal.PlainDate.from(s)

describe('agrupar em visitas (AUT-303)', () => {
  it('junta o que vence dentro da janela, na data do primeiro vencimento, e conta a antecipação', () => {
    const v = agruparEmVisitas(
      [
        { item: 'oleo_motor', venceEm: d('2026-05-10') },
        { item: 'alinhamento', venceEm: d('2026-05-25') },
        { item: 'fluido_freio', venceEm: d('2026-09-01') },
      ],
      d('2026-04-01'),
      30,
    )
    expect(v).toHaveLength(2)
    expect(v[0]).toMatchObject({ itens: ['oleo_motor', 'alinhamento'], antecipacaoDias: 15, temCritico: false })
    expect(v[0]!.data.equals(d('2026-05-10'))).toBe(true)
    expect(v[1]).toMatchObject({ itens: ['fluido_freio'], temCritico: true })
  })

  it('item já vencido vira visita HOJE, nunca no passado', () => {
    const v = agruparEmVisitas([{ item: 'fluido_freio', venceEm: d('2026-01-01') }], d('2026-04-01'))
    expect(v[0]!.data.equals(d('2026-04-01'))).toBe(true)
  })
})

/**
 * Placar: dois anos de um carro em cada perfil, todos os itens do plano genérico de carro flex manual,
 * com o vencimento de cada item dirigido pelo ritmo de uso (km/dia). Compara "um item por visita"
 * (o que um lembrete por item faz) com as visitas agrupadas. Sintético, determinístico.
 */
function simular(kmPorDia: number, janelaDias: number) {
  const plano = resolverPlano({ perfil: 'carro_flex_aspirado', cambio: 'manual' })
  const inicio = d('2026-01-05')
  const fim = inicio.add({ days: 730 })
  const proximo = new Map<ChaveDoItem, Temporal.PlainDate>()
  const dias = (p: (typeof plano)[number]) => {
    const porKm = p.intervalo.km ? Math.round(p.intervalo.km / kmPorDia) : Infinity
    const porTempo = p.intervalo.meses ? Math.round(p.intervalo.meses * 30.4375) : Infinity
    return Math.min(porKm, porTempo)
  }
  for (const p of plano) proximo.set(p.item, inicio.add({ days: dias(p) }))

  let visitasAgrupadas = 0
  let criticoVencido = 0
  let antecipacao = 0
  let itensFeitos = 0
  let hoje = inicio
  while (true) {
    const fila = [...proximo].map(([item, venceEm]) => ({ item, venceEm })).filter((x) => Temporal.PlainDate.compare(x.venceEm, fim) <= 0)
    if (fila.length === 0) break
    const [visita] = agruparEmVisitas(fila, hoje, janelaDias)
    if (!visita) break
    visitasAgrupadas++
    antecipacao += visita.antecipacaoDias
    for (const item of visita.itens) {
      if (ITENS[item].critico && Temporal.PlainDate.compare(proximo.get(item)!, visita.data) < 0) criticoVencido++
      itensFeitos++
      const p = plano.find((x) => x.item === item)!
      proximo.set(item, visita.data.add({ days: dias(p) }))
    }
    hoje = visita.data
  }
  return { visitasAgrupadas, itensFeitos, criticoVencido, antecipacaoMediaDias: itensFeitos ? Math.round(antecipacao / itensFeitos) : 0 }
}

describe('placar das visitas: dois anos por perfil (AUT-303)', () => {
  const perfis = { 'pouco uso (16 km/dia)': 16, 'médio (36 km/dia)': 36, 'muito uso (70 km/dia)': 70, 'aplicativo (137 km/dia)': 137 }
  const linhas = Object.entries(perfis).map(([perfil, kmDia]) => {
    const r = simular(kmDia, 30)
    return { perfil, 'visitas (1 item cada)': r.itensFeitos, 'visitas agrupadas': r.visitasAgrupadas, 'antecipação média (d)': r.antecipacaoMediaDias, 'crítico vencido': r.criticoVencido }
  })

  it('imprime o placar', () => {
    console.table(linhas)
    expect(linhas).toHaveLength(4)
  })

  it.each(linhas.map((l) => l.perfil))('%s: agrupar corta as visitas pela metade ou mais, sem nenhum item crítico vencido', (perfil) => {
    const l = linhas.find((x) => x.perfil === perfil)!
    expect(l['crítico vencido']).toBe(0)
    expect(l['visitas agrupadas']).toBeLessThanOrEqual(l['visitas (1 item cada)'] / 2)
    expect(l['antecipação média (d)']).toBeLessThanOrEqual(30)
  })
})
