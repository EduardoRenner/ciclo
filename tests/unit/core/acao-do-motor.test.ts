import { describe, expect, it } from 'vitest'

import { acaoDoMotor } from '@/core/ciclo/acao-do-motor'

const base = { clientes: 3, sumindo: 0, ciclos: 2, quandoOProximoVolta: 'daqui a 6 dias (29/09)' }

describe('acaoDoMotor — o Hoje fala do Motor quando ninguém está sumindo', () => {
  it('fichas sem última visita: manda para o "Já atendo"', () => {
    const a = acaoDoMotor({ ...base, ciclos: 0, quandoOProximoVolta: null })
    expect(a?.chave).toBe('motor-sem-ultima-visita')
    expect(a?.href).toBe('/admin/clientes/ja-atendo')
  })

  it('todo mundo em dia: diz que está de olho e quando o próximo volta', () => {
    const a = acaoDoMotor(base)
    expect(a?.chave).toBe('motor-de-olho')
    expect(a?.descricao).toContain('daqui a 6 dias (29/09)')
  })

  it('alguém sumindo: cala — o alarme de "sumindo" já fala, e "ninguém sumiu" o contradiria', () => {
    expect(acaoDoMotor({ ...base, sumindo: 1 })).toBeNull()
    expect(acaoDoMotor({ ...base, ciclos: 0, sumindo: 1 })).toBeNull()
  })

  it('sem cliente nenhum: cala — é caso dos primeiros passos', () => {
    expect(acaoDoMotor({ ...base, clientes: 0, ciclos: 0 })).toBeNull()
  })

  it('com ciclo mas sem volta futura em dia: cala em vez de inventar data', () => {
    expect(acaoDoMotor({ ...base, quandoOProximoVolta: null })).toBeNull()
  })
})
