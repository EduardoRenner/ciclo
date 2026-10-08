import { describe, expect, it } from 'vitest'

import { montarClientes, type CasoDoCliente } from '@/core/advocacia/clientes-do-pacote'

const passo = (ate: string, atrasado = false) => ({ texto: `até ${ate}`, de: 'cliente' as const, ate, atrasado, fatal: false })
const caso = (p: Partial<CasoDoCliente> & Pick<CasoDoCliente, 'clienteId'>): CasoDoCliente => ({
  estado: 'em_andamento',
  sigiloso: false,
  responsavel: 'Rafael',
  proximo: null,
  ...p,
})

const clientes = [
  { id: 'a', nome: 'Ana', telefone: null },
  { id: 'b', nome: 'Bruno', telefone: null },
  { id: 'c', nome: 'Carla', telefone: null },
  { id: 'd', nome: 'Davi', telefone: null },
]

describe('montarClientes', () => {
  const lista = montarClientes(
    clientes,
    [
      caso({ clienteId: 'a', proximo: passo('2026-10-20') }),
      caso({ clienteId: 'a', proximo: passo('2026-10-10'), responsavel: 'Camila', sigiloso: true }),
      caso({ clienteId: 'b', proximo: passo('2026-10-01', true) }),
      caso({ clienteId: 'c', estado: 'concluido' }),
    ],
    new Set(['a']),
  )

  it('atrasado sobe, depois a data; sem próximo passo vai para o fim', () => {
    expect(lista.map((c) => c.id)).toEqual(['b', 'a', 'c', 'd'])
  })

  it('o responsável é o do caso que aperta primeiro', () => {
    expect(lista.find((c) => c.id === 'a')).toMatchObject({ responsavel: 'Camila', casosAtivos: 2, sigiloso: true, holding: true })
  })

  it('fase: sem caso é prospecção; só casos encerrados é encerrado', () => {
    expect(lista.find((c) => c.id === 'c')!.fase).toBe('encerrado')
    expect(lista.find((c) => c.id === 'd')!.fase).toBe('em_prospeccao')
    expect(lista.find((c) => c.id === 'b')!.fase).toBe('ativo')
  })
})
