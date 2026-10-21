import { describe, expect, it } from 'vitest'

import { passoDoCheckIn, toquesAteAbrir, type VeiculoConhecido } from '@/core/manutencao/check-in'

const veiculos: VeiculoConhecido[] = [
  { subjectId: 'onix', clientId: 'ana', chave: 'ABC1C34', descricao: 'Onix 2021', ativo: true },
  { subjectId: 'gol-velho', clientId: 'bia', chave: 'XYZ9A87', descricao: 'Gol 2012', ativo: false },
]

describe('o check-in pela placa (AUT-401, C-036)', () => {
  it('carro conhecido do mesmo cliente, digitado no formato antigo: só pede o km', () => {
    const p = passoDoCheckIn({ placaDigitada: 'abc-1234', clientId: 'ana', veiculos })
    expect(p).toMatchObject({ tipo: 'veiculo_do_cliente', subjectId: 'onix', pedir: ['km'] })
    expect(toquesAteAbrir(p)).toBe(3)
  })

  it('carro de OUTRO cliente: pergunta se mudou de dono, nunca transfere sozinho', () => {
    const p = passoDoCheckIn({ placaDigitada: 'ABC1C34', clientId: 'carla', veiculos })
    expect(p.tipo).toBe('veiculo_de_outro_cliente')
    expect(p.tipo === 'veiculo_de_outro_cliente' && p.pergunta).toContain('O carro mudou de dono?')
    expect(p.tipo === 'veiculo_de_outro_cliente' && p.donoAtual).toBe('ana')
    expect(toquesAteAbrir(p)).toBe(4)
  })

  it('carro novo: marca, modelo, ano e km — dentro da meta de 6 toques', () => {
    const p = passoDoCheckIn({ placaDigitada: 'QWE1R23', clientId: 'ana', veiculos })
    expect(p).toEqual({ tipo: 'veiculo_novo', chave: 'QWE1R23', pedir: ['marca', 'modelo', 'ano', 'km'] })
    expect(toquesAteAbrir(p)).toBe(6)
  })

  it('placa de veículo INATIVO (vendido) não responde: vira carro novo', () => {
    expect(passoDoCheckIn({ placaDigitada: 'XYZ-9087', clientId: 'carla', veiculos }).tipo).toBe('veiculo_novo')
  })

  it('placa inválida: pede de novo, com exemplo, e não abre OS', () => {
    const p = passoDoCheckIn({ placaDigitada: 'AB12', clientId: 'ana', veiculos })
    expect(p.tipo).toBe('placa_invalida')
    expect(toquesAteAbrir(p)).toBe(Infinity)
  })

  it('placar: todo caminho válido cabe na meta de 6 toques do plano 106', () => {
    const caminhos = [
      passoDoCheckIn({ placaDigitada: 'ABC1C34', clientId: 'ana', veiculos }),
      passoDoCheckIn({ placaDigitada: 'ABC1C34', clientId: 'carla', veiculos }),
      passoDoCheckIn({ placaDigitada: 'QWE1R23', clientId: 'ana', veiculos }),
    ]
    expect(Math.max(...caminhos.map(toquesAteAbrir))).toBeLessThanOrEqual(6)
  })
})
