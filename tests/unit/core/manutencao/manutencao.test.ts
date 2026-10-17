import { Temporal } from '@js-temporal/polyfill'
import { describe, expect, it } from 'vitest'

import { ITENS, type ChaveDoItem } from '@/core/manutencao/itens'
import { PERFIS } from '@/core/manutencao/perfis'
import { resolverPlano } from '@/core/manutencao/plano'
import { vencimentoDoItem } from '@/core/manutencao/vencimento'

const d = (s: string) => Temporal.PlainDate.from(s)

describe('catálogo de itens e perfis (AUT-202/203)', () => {
  it('todo item tem pelo menos um relógio, e item de moto não aparece em perfil de carro (e vice-versa)', () => {
    for (const [k, item] of Object.entries(ITENS)) expect(item.relogios.length, k).toBeGreaterThan(0)
    for (const [perfil, plano] of Object.entries(PERFIS)) {
      for (const k of Object.keys(plano) as ChaveDoItem[]) {
        expect(ITENS[k].veiculo, `${perfil}:${k}`).toBe(perfil.startsWith('moto') ? 'moto' : 'carro')
      }
    }
  })

  it('todo intervalo de perfil tem km ou meses — o plano nunca resolve um item sem relógio', () => {
    for (const plano of Object.values(PERFIS)) for (const intervalo of Object.values(plano)) expect(Boolean(intervalo.km || intervalo.meses)).toBe(true)
  })

  it('elétrico não tem óleo do motor nem velas; diesel não tem velas', () => {
    expect(PERFIS.carro_eletrico.oleo_motor).toBeUndefined()
    expect(PERFIS.carro_eletrico.velas).toBeUndefined()
    expect(PERFIS.carro_diesel.velas).toBeUndefined()
  })
})

describe('resolver o plano por herança (AUT-204/205)', () => {
  it('a camada mais específica vence, item a item, e a origem vem junto', () => {
    const plano = resolverPlano({
      perfil: 'carro_turbo',
      cambio: 'manual',
      modelo: { plano: { oleo_motor: { km: 10_000, meses: 12, fatorSevero: 0.5 } }, fonte: 'manual Onix 2021' },
      oficina: { plano: { correia_dentada: { km: 50_000, meses: 36 } }, fonte: 'Oficina do Zé' },
    })
    const porItem = new Map(plano.map((p) => [p.item, p]))
    expect(porItem.get('oleo_motor')?.origem).toBe('modelo')
    expect(porItem.get('oleo_motor')?.fonte).toBe('manual Onix 2021')
    expect(porItem.get('correia_dentada')).toMatchObject({ origem: 'oficina', intervalo: { km: 50_000 } })
    expect(porItem.get('velas')?.origem).toBe('generico')
  })

  it('o câmbio filtra: manual não tem fluido de câmbio automático; automático não tem kit de embreagem', () => {
    const manual = resolverPlano({ perfil: 'carro_flex_aspirado', cambio: 'manual' }).map((p) => p.item)
    const automatico = resolverPlano({ perfil: 'carro_flex_aspirado', cambio: 'automatico' }).map((p) => p.item)
    expect(manual).not.toContain('fluido_cambio')
    expect(manual).toContain('embreagem')
    expect(automatico).toContain('fluido_cambio')
    expect(automatico).not.toContain('embreagem')
  })
})

describe('vencimento por item: o que vencer primeiro de três relógios (AUT-301/302/305)', () => {
  const leituras = [
    { date: d('2026-01-10'), uso: 30_000 },
    { date: d('2026-04-10'), uso: 33_600 }, // 90 dias, 3.600 km = 40/dia
  ]

  it('óleo: vence pela quilometragem antes dos 12 meses, e diz quantos km faltam', () => {
    const r = vencimentoDoItem({
      item: 'oleo_motor',
      intervalo: { km: 10_000, meses: 12 },
      ultimoFeito: { date: d('2026-01-10'), km: 30_000 },
      leituras,
      severo: false,
      hoje: d('2026-04-10'),
      ritmoDeReferencia: 36,
    })
    expect(r.relogio).toBe('uso')
    expect(r.kmDeVencimento).toBe(40_000)
    // faltam 6.400 km a 40/dia = 160 dias depois de 10/4
    expect(r.venceEm?.equals(d('2026-04-10').add({ days: 160 }))).toBe(true)
    expect(r.estado).toBe('em_dia')
  })

  it('uso severo corta o intervalo pela metade onde o manual manda', () => {
    const r = vencimentoDoItem({
      item: 'oleo_motor',
      intervalo: { km: 10_000, meses: 12, fatorSevero: 0.5 },
      ultimoFeito: { date: d('2026-01-10'), km: 30_000 },
      leituras,
      severo: true,
      hoje: d('2026-04-10'),
      ritmoDeReferencia: 36,
      janelaDias: 45,
    })
    expect(r.kmDeVencimento).toBe(35_000)
    // faltam 1.400 km a 40/dia = 35 dias: dentro de uma janela de 45 dias, entra no orçamento de hoje
    expect(r.venceEm?.equals(d('2026-04-10').add({ days: 35 }))).toBe(true)
    expect(r.estado).toBe('nesta_visita')
  })

  it('fluido de freio vence por TEMPO mesmo com o carro parado', () => {
    const r = vencimentoDoItem({
      item: 'fluido_freio',
      intervalo: { meses: 24 },
      ultimoFeito: { date: d('2024-03-01'), km: 20_000 },
      leituras: [{ date: d('2024-03-01'), uso: 20_000 }, { date: d('2026-04-10'), uso: 21_000 }],
      severo: false,
      hoje: d('2026-04-10'),
      ritmoDeReferencia: 36,
    })
    expect(r.relogio).toBe('tempo')
    expect(r.estado).toBe('vencido')
  })

  it('pastilha medida duas vezes: o desgaste prevê a data, antes do intervalo de km', () => {
    const r = vencimentoDoItem({
      item: 'pastilhas_freio',
      intervalo: { km: 30_000 },
      ultimoFeito: { date: d('2025-06-01'), km: 25_000 },
      leituras,
      medicoes: [
        { date: d('2026-01-10'), km: 30_000, valor: 70 },
        { date: d('2026-04-10'), km: 33_600, valor: 52 }, // 18 pontos em 3.600 km = 0,005/km
      ],
      severo: false,
      hoje: d('2026-04-10'),
      ritmoDeReferencia: 36,
    })
    // até 15%: 37 pontos / 0,005 = 7.400 km / 40 por dia = 185 dias
    expect(r.porDesgaste?.equals(d('2026-04-10').add({ days: 185 }))).toBe(true)
    expect(r.relogio).toBe('desgaste')
  })

  it('item nunca feito aqui e sem medição: pergunta em vez de afirmar vencido (AUT-305)', () => {
    const r = vencimentoDoItem({ item: 'velas', intervalo: { km: 40_000 }, ultimoFeito: null, leituras, severo: false, hoje: d('2026-04-10'), ritmoDeReferencia: 36 })
    expect(r.estado).toBe('perguntar')
    expect(r.venceEm).toBeNull()
  })
})
