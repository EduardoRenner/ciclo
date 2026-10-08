import { describe, expect, it } from 'vitest'

import { compararEfetivas, montarEstrutura, simular } from '@/core/advocacia/estrutura-da-familia'
import type { ArestaDeParticipacao } from '@/core/advocacia/participacao'

// Contas feitas à mão antes do código: a família do escritório-modelo.
const pessoas = [
  { id: 'a', nome: 'Antônio', vinculo: 'titular' },
  { id: 'm', nome: 'Marina', vinculo: 'conjuge' },
  { id: 'l', nome: 'Lucas', vinculo: 'filho_filha' },
]
const empresas = [
  { id: 'H', nome: 'MA Participações', tipo: 'holding_patrimonial' },
  { id: 'O', nome: 'Alves Transportes', tipo: 'operacional' },
]
const p = (id: string) => ({ kind: 'person' as const, id })
const arestas: ArestaDeParticipacao[] = [
  { owner: p('a'), entityId: 'H', percent: 55 },
  { owner: p('m'), entityId: 'H', percent: 40 },
  { owner: p('l'), entityId: 'H', percent: 5, usufructPersonId: 'a' },
  { owner: { kind: 'entity', id: 'H' }, entityId: 'O', percent: 80 },
  { owner: p('a'), entityId: 'O', percent: 20 },
]

describe('montarEstrutura', () => {
  it('efetiva de Antônio na operacional: 20% direto + 55% × 80% = 64%, com a conta escrita', () => {
    const { efetivas } = montarEstrutura(pessoas, empresas, arestas)
    const op = efetivas.find((x) => x.pessoaId === 'a')!.porEmpresa.find((e) => e.empresaId === 'O')!
    expect(op).toMatchObject({ direta: 20, indireta: 44, total: 64 })
    expect(op.conta).toBe('20% direto + 55% × 80% via MA Participações')
  })

  it('usufruto aparece no dono sem mudar o percentual de propriedade', () => {
    const { empresas: e } = montarEstrutura(pessoas, empresas, arestas)
    expect(e.find((x) => x.id === 'H')!.donos.find((d) => d.nome === 'Lucas')).toMatchObject({ percent: 5, usufruto: 'Antônio' })
  })

  it('soma de 110% vira problema na empresa, e nada é corrigido', () => {
    const errada = [...arestas, { owner: p('m'), entityId: 'O', percent: 10 }]
    const { empresas: e } = montarEstrutura(pessoas, empresas, errada)
    expect(e.find((x) => x.id === 'O')).toMatchObject({ total: 110, problema: 'acima-de-100' })
  })

  it('empresa sem dono lançado não é "abaixo de 100"', () => {
    const { empresas: e } = montarEstrutura(pessoas, [...empresas, { id: 'X', nome: 'Nova', tipo: 'outra' }], arestas)
    expect(e.find((x) => x.id === 'X')!.problema).toBeNull()
  })

  it('com ciclo, não inventa efetiva', () => {
    const ciclo = [...arestas, { owner: { kind: 'entity' as const, id: 'O' }, entityId: 'H', percent: 1 }]
    const r = montarEstrutura(pessoas, empresas, ciclo)
    expect(r.efetivas).toEqual([])
    expect(r.problemas.some((x) => x.kind === 'ciclo')).toBe(true)
  })
})

describe('simular', () => {
  it('mover 10% de Antônio para Marina na holding muda a efetiva dos dois na operacional', () => {
    const r = simular(arestas, { empresaId: 'H', de: 'person:a', para: 'person:m', percent: 10 })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const antes = montarEstrutura(pessoas, empresas, arestas).efetivas
    const depois = montarEstrutura(pessoas, empresas, r.arestas).efetivas
    const diff = compararEfetivas(antes, depois)
    // Antônio: H 55→45; O 20+44=64 → 20+36=56. Marina: H 40→50; O 32→40.
    expect(diff).toEqual([
      { nome: 'Antônio', empresa: 'Alves Transportes', antes: 64, depois: 56 },
      { nome: 'Antônio', empresa: 'MA Participações', antes: 55, depois: 45 },
      { nome: 'Marina', empresa: 'Alves Transportes', antes: 32, depois: 40 },
      { nome: 'Marina', empresa: 'MA Participações', antes: 40, depois: 50 },
    ])
  })

  it('não move mais do que a pessoa tem', () => {
    expect(simular(arestas, { empresaId: 'H', de: 'person:l', para: 'person:m', percent: 6 })).toEqual({ ok: false, motivo: 'Só há 5% para mover.' })
  })

  it('não altera a lista recebida', () => {
    const copia = JSON.stringify(arestas)
    simular(arestas, { empresaId: 'H', de: 'person:a', para: 'person:m', percent: 10 })
    expect(JSON.stringify(arestas)).toBe(copia)
  })
})
