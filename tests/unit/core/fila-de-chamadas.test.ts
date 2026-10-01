import { describe, expect, it } from 'vitest'

import { chaveDaFila, filtrarFila, ordenarFila, prioridade, proximoDaFila, type ItemDaFila } from '@/core/ciclo/fila-de-chamadas'

function item(name: string, parcial: Partial<ItemDaFila> = {}): ItemDaFila {
  return { clientId: name, serviceId: 's', name, profitCents: 1_000, valueCents: 2_000, lateDays: 5, nota: null, classe: null, perfil: null, ...parcial }
}

const FILA = [
  item('Bruno', { profitCents: 4_000, nota: 20, lateDays: 3, classe: 'bronze', perfil: 'atrasado' }),
  item('Ana', { profitCents: 2_000, nota: 90, lateDays: 40, classe: 'ouro', perfil: 'fiel' }),
  item('Carla', { profitCents: 3_000, nota: null, lateDays: 10 }),
]

describe('fila de chamadas (docs/95 E2)', () => {
  it('prioridade = lucro pesado pela nota; sem nota vale o meio-termo', () => {
    expect(prioridade({ profitCents: 4_000, nota: 20 })).toBe(800)
    expect(prioridade({ profitCents: 2_000, nota: 90 })).toBe(1_800)
    expect(prioridade({ profitCents: 3_000, nota: null })).toBe(1_500)
  })

  it('ordena por cada critério', () => {
    expect(ordenarFila(FILA, 'prioridade').map((i) => i.name)).toEqual(['Ana', 'Carla', 'Bruno'])
    expect(ordenarFila(FILA, 'lucro').map((i) => i.name)).toEqual(['Bruno', 'Carla', 'Ana'])
    expect(ordenarFila(FILA, 'nota').map((i) => i.name)).toEqual(['Ana', 'Bruno', 'Carla'])
    expect(ordenarFila(FILA, 'atraso').map((i) => i.name)).toEqual(['Ana', 'Carla', 'Bruno'])
    expect(ordenarFila(FILA, 'nome').map((i) => i.name)).toEqual(['Ana', 'Bruno', 'Carla'])
  })

  it('empate cai no nome, e a lista original não muda', () => {
    const empate = [item('Zeca'), item('Alice')]
    expect(ordenarFila(empate, 'lucro').map((i) => i.name)).toEqual(['Alice', 'Zeca'])
    expect(empate.map((i) => i.name)).toEqual(['Zeca', 'Alice'])
  })

  it('filtra por perfil e por classe; sem filtro passa todo mundo; sem nota só passa sem filtro', () => {
    expect(filtrarFila(FILA, {}).length).toBe(3)
    expect(filtrarFila(FILA, { perfis: ['fiel'] }).map((i) => i.name)).toEqual(['Ana'])
    expect(filtrarFila(FILA, { classes: ['ouro', 'bronze'] }).map((i) => i.name)).toEqual(['Bruno', 'Ana'])
    expect(filtrarFila(FILA, { perfis: ['fiel'], classes: ['bronze'] })).toEqual([])
  })

  it('o próximo da fila pula quem já foi tratado hoje e acaba em null', () => {
    const fila = ordenarFila(FILA, 'nome')
    expect(proximoDaFila(fila, new Set())?.name).toBe('Ana')
    expect(proximoDaFila(fila, new Set([chaveDaFila(fila[0]!)]))?.name).toBe('Bruno')
    expect(proximoDaFila(fila, new Set(fila.map(chaveDaFila)))).toBeNull()
  })
})
