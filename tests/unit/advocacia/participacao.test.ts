// Origem: LUBI tests/unit/ownership.test.ts @ db8aeac. Casos de referência calculados à mão ANTES da
// função; a função é escrita para passar neles, eles não são editados para a função passar.
import { describe, expect, it } from 'vitest'

import {
  camadaDe,
  participacaoEfetiva,
  totaisPorEmpresa,
  validarEstrutura,
  type ArestaDeParticipacao,
} from '@/core/advocacia/participacao'

const P = (id: string) => ({ kind: 'person' as const, id })
const E = (id: string) => ({ kind: 'entity' as const, id })
const efetiva = (arestas: ArestaDeParticipacao[], dono: string, empresa: string) => participacaoEfetiva(arestas).get(dono)?.get(empresa)

describe('percentual efetivo: casos de referência', () => {
  it('1. direto simples', () => {
    expect(
      efetiva(
        [
          { owner: P('a'), entityId: 'x', percent: 60 },
          { owner: P('b'), entityId: 'x', percent: 40 },
        ],
        'person:a',
        'x',
      ),
    ).toBe(60)
  })

  it('2. dois níveis: A 60% de H; H 100% de E → A 60% em E', () => {
    const arestas: ArestaDeParticipacao[] = [
      { owner: P('a'), entityId: 'h', percent: 60 },
      { owner: P('b'), entityId: 'h', percent: 40 },
      { owner: E('h'), entityId: 'e', percent: 100 },
    ]
    expect(efetiva(arestas, 'person:a', 'h')).toBe(60)
    expect(efetiva(arestas, 'person:a', 'e')).toBe(60)
    expect(efetiva(arestas, 'person:b', 'e')).toBe(40)
  })

  it('3. participação cruzada: A 30% direto de E + 60% × 50% via H → 60%', () => {
    const arestas: ArestaDeParticipacao[] = [
      { owner: P('a'), entityId: 'e', percent: 30 },
      { owner: P('b'), entityId: 'e', percent: 20 },
      { owner: E('h'), entityId: 'e', percent: 50 },
      { owner: P('a'), entityId: 'h', percent: 60 },
      { owner: P('b'), entityId: 'h', percent: 40 },
    ]
    expect(efetiva(arestas, 'person:a', 'e')).toBe(60)
    expect(efetiva(arestas, 'person:b', 'e')).toBe(40)
  })

  it('4. três níveis: A 50% de H1; H1 50% de H2; H2 80% de E → A 20% em E', () => {
    const arestas: ArestaDeParticipacao[] = [
      { owner: P('a'), entityId: 'h1', percent: 50 },
      { owner: P('b'), entityId: 'h1', percent: 50 },
      { owner: E('h1'), entityId: 'h2', percent: 50 },
      { owner: P('c'), entityId: 'h2', percent: 50 },
      { owner: E('h2'), entityId: 'e', percent: 80 },
      { owner: P('d'), entityId: 'e', percent: 20 },
    ]
    expect(efetiva(arestas, 'person:a', 'e')).toBe(20)
    expect(efetiva(arestas, 'person:c', 'e')).toBe(40)
    expect(efetiva(arestas, 'person:d', 'e')).toBe(20)
  })

  it('5. fração com casas: 33,3333% de H (100% de E) → 33,3333%', () => {
    const arestas: ArestaDeParticipacao[] = [
      { owner: P('a'), entityId: 'h', percent: 33.3333 },
      { owner: P('b'), entityId: 'h', percent: 33.3333 },
      { owner: P('c'), entityId: 'h', percent: 33.3334 },
      { owner: E('h'), entityId: 'e', percent: 100 },
    ]
    expect(efetiva(arestas, 'person:a', 'e')).toBeCloseTo(33.3333, 4)
  })

  it('6. a soma dos efetivos das pessoas na empresa final é 100% quando só há pessoas no topo', () => {
    const arestas: ArestaDeParticipacao[] = [
      { owner: P('a'), entityId: 'h', percent: 70 },
      { owner: P('b'), entityId: 'h', percent: 30 },
      { owner: E('h'), entityId: 'e1', percent: 60 },
      { owner: P('c'), entityId: 'e1', percent: 40 },
    ]
    const soma = ['a', 'b', 'c'].reduce((s, p) => s + (efetiva(arestas, `person:${p}`, 'e1') ?? 0), 0)
    expect(soma).toBeCloseTo(100, 6)
  })

  it('7. família de exemplo: titular 40% da holding de participações → 32% efetivo na operacional', () => {
    const arestas: ArestaDeParticipacao[] = [
      { owner: P('titular'), entityId: 'holding', percent: 40 },
      { owner: P('conjuge'), entityId: 'holding', percent: 40 },
      { owner: P('filha'), entityId: 'holding', percent: 10 },
      { owner: P('filho'), entityId: 'holding', percent: 10 },
      { owner: E('holding'), entityId: 'operacional', percent: 80 },
      { owner: P('filho'), entityId: 'operacional', percent: 20 },
    ]
    expect(efetiva(arestas, 'person:titular', 'operacional')).toBe(32)
    expect(efetiva(arestas, 'person:filho', 'operacional')).toBe(28) // 20 direto + 10% × 80%
  })

  it('8. usufruto não muda o percentual de propriedade', () => {
    const com: ArestaDeParticipacao[] = [
      { owner: P('filha'), entityId: 'h', percent: 100, usufructPersonId: 'titular' },
    ]
    expect(efetiva(com, 'person:filha', 'h')).toBe(100)
    expect(participacaoEfetiva(com).get('person:titular')).toBeUndefined()
  })
})

describe('validação', () => {
  it('soma acima de 100 é acusada; abaixo avisa; 100 passa (com a tolerância de casas)', () => {
    const base = (p: number): ArestaDeParticipacao[] => [
      { owner: P('a'), entityId: 'x', percent: 60 },
      { owner: P('b'), entityId: 'x', percent: p },
    ]
    expect(validarEstrutura(base(40))).toEqual([])
    expect(validarEstrutura(base(40.00001))).toEqual([])
    expect(validarEstrutura(base(40.01)).map((i) => i.kind)).toEqual(['acima-de-100'])
    expect(validarEstrutura(base(39.9)).map((i) => i.kind)).toEqual(['abaixo-de-100'])
  })

  it('a inconsistência plantada do escritório-modelo (soma 110%) é acusada com o total', () => {
    const problemas = validarEstrutura([
      { owner: P('a'), entityId: 'x', percent: 60 },
      { owner: P('b'), entityId: 'x', percent: 50 },
    ])
    expect(problemas).toEqual([{ kind: 'acima-de-100', entityId: 'x', total: 110 }])
  })

  it('ciclo direto, de 2 e de 3 empresas é recusado', () => {
    const ciclo = (...ids: string[]): ArestaDeParticipacao[] =>
      ids.map((id, i) => ({ owner: E(id), entityId: ids[(i + 1) % ids.length]!, percent: 100 }))
    for (const ids of [['a'], ['a', 'b'], ['a', 'b', 'c']]) {
      expect(validarEstrutura(ciclo(...ids)).some((i) => i.kind === 'ciclo'), ids.join()).toBe(true)
      expect(() => participacaoEfetiva(ciclo(...ids))).toThrow(/ciclo/i)
    }
  })

  it('controle: cadeia sem ciclo não acusa ciclo', () => {
    const cadeia: ArestaDeParticipacao[] = [
      { owner: P('p'), entityId: 'a', percent: 100 },
      { owner: E('a'), entityId: 'b', percent: 100 },
      { owner: E('b'), entityId: 'c', percent: 100 },
    ]
    expect(validarEstrutura(cadeia)).toEqual([])
  })

  it('percentual fora de (0, 100] é acusado', () => {
    for (const p of [0, -5, 100.01]) {
      expect(validarEstrutura([{ owner: P('a'), entityId: 'x', percent: p }]).some((i) => i.kind === 'percentual-invalido'), String(p)).toBe(
        true,
      )
    }
  })

  it('totais por empresa', () => {
    expect(
      totaisPorEmpresa([
        { owner: P('a'), entityId: 'x', percent: 25 },
        { owner: P('b'), entityId: 'x', percent: 75 },
      ]).get('x'),
    ).toBe(100)
  })

  it('camadas: pessoa 0; empresa = 1 + dono mais alto', () => {
    const arestas: ArestaDeParticipacao[] = [
      { owner: P('a'), entityId: 'h', percent: 100 },
      { owner: E('h'), entityId: 'e', percent: 100 },
    ]
    const l = camadaDe(arestas, ['h', 'e'])
    expect(l.get('h')).toBe(1)
    expect(l.get('e')).toBe(2)
  })
})
