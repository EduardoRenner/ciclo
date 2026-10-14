import { describe, expect, it } from 'vitest'

import { EsquemaFichaDoVeiculo, mesmaPlaca, normalizarPlaca } from '@/core/manutencao/placa'

describe('placa (AUT-102, C-028)', () => {
  it('antiga: limpa a digitação, mostra com hífen e guarda a chave na forma Mercosul', () => {
    expect(normalizarPlaca(' abc-1234 ')).toEqual({ exibida: 'ABC-1234', chave: 'ABC1C34', formato: 'antiga' })
    expect(normalizarPlaca('XYZ 9087')).toEqual({ exibida: 'XYZ-9087', chave: 'XYZ9A87', formato: 'antiga' })
    expect(normalizarPlaca('KLM0999')?.chave).toBe('KLM0J99')
  })

  it('Mercosul: a chave é a própria placa', () => {
    expect(normalizarPlaca('abc1c34')).toEqual({ exibida: 'ABC1C34', chave: 'ABC1C34', formato: 'mercosul' })
  })

  it('o mesmo carro antes e depois da conversão é a mesma placa', () => {
    expect(mesmaPlaca('ABC-1234', 'abc1c34')).toBe(true)
    expect(mesmaPlaca('ABC-1234', 'ABC1D34')).toBe(false)
  })

  it('o que não é placa brasileira volta nulo, não é "consertado"', () => {
    for (const ruim of ['', 'AB1234', 'ABCD123', '1234ABC', 'ABC12345', 'ABC1CC4', 'ÁBC1234']) expect(normalizarPlaca(ruim), ruim).toBeNull()
  })

  it('a ficha do veículo: marca, modelo e ano obrigatórios; campo desconhecido é recusado', () => {
    expect(EsquemaFichaDoVeiculo.safeParse({ marca: 'Chevrolet', modelo: 'Onix 1.0 Turbo', ano: 2021, combustivel: 'flex', cambio: 'manual' }).success).toBe(true)
    expect(EsquemaFichaDoVeiculo.safeParse({ marca: 'Chevrolet', modelo: 'Onix', ano: 1890 }).success).toBe(false)
    expect(EsquemaFichaDoVeiculo.safeParse({ marca: 'Chevrolet', modelo: 'Onix', ano: 2021, cor: 'prata' }).success).toBe(false)
    expect(EsquemaFichaDoVeiculo.safeParse({ marca: ' ', modelo: 'Onix', ano: 2021 }).success).toBe(false)
  })
})
