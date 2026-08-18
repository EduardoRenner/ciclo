import { describe, expect, it } from 'vitest'

import { ABAS, abaAtiva } from '@/components/shell/tabs'

describe('ABAS', () => {
  it('tem os 4 destinos que sustentam o essencial do MVP', () => {
    expect(ABAS.map((a) => a.href)).toEqual(['/hoje', '/agenda', '/clientes', '/recuperar'])
  })

  it('nenhum rótulo ou href duplicado', () => {
    expect(new Set(ABAS.map((a) => a.href)).size).toBe(ABAS.length)
    expect(new Set(ABAS.map((a) => a.rotulo)).size).toBe(ABAS.length)
  })
})

describe('abaAtiva', () => {
  it('acende na rota exata', () => {
    expect(abaAtiva('/clientes', '/clientes')).toBe(true)
    expect(abaAtiva('/agenda', '/clientes')).toBe(false)
  })

  it('acende também numa sub-rota', () => {
    expect(abaAtiva('/clientes/123', '/clientes')).toBe(true)
    expect(abaAtiva('/clientes/123/historico', '/clientes')).toBe(true)
  })

  it('não confunde prefixo textual com sub-rota — /clientes não acende /clientes-vip', () => {
    expect(abaAtiva('/clientes-vip', '/clientes')).toBe(false)
  })

  it('/hoje não acende em toda rota só por casar com prefixo vazio', () => {
    // Caso que motivou o cuidado extra: sem o tratamento, toda rota do app
    // faria a primeira aba parecer sempre ativa.
    expect(abaAtiva('/agenda', '/hoje')).toBe(false)
    expect(abaAtiva('/clientes/123', '/hoje')).toBe(false)
  })
})
