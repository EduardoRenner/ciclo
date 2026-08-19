import { describe, expect, it } from 'vitest'

import { ABAS, abaAtiva } from '@/components/shell/tabs'

describe('ABAS', () => {
  it('tem os 4 destinos que sustentam o essencial do MVP', () => {
    expect(ABAS.map((a) => a.href)).toEqual(['/admin/hoje', '/admin/agenda', '/admin/clientes', '/admin/recuperar'])
  })

  it('nenhum rótulo ou href duplicado', () => {
    expect(new Set(ABAS.map((a) => a.href)).size).toBe(ABAS.length)
    expect(new Set(ABAS.map((a) => a.rotulo)).size).toBe(ABAS.length)
  })
})

describe('abaAtiva', () => {
  it('acende na rota exata', () => {
    expect(abaAtiva('/admin/clientes', '/admin/clientes')).toBe(true)
    expect(abaAtiva('/admin/agenda', '/admin/clientes')).toBe(false)
  })

  it('acende também numa sub-rota', () => {
    expect(abaAtiva('/admin/clientes/123', '/admin/clientes')).toBe(true)
    expect(abaAtiva('/admin/clientes/123/historico', '/admin/clientes')).toBe(true)
  })

  it('não confunde prefixo textual com sub-rota — /admin/clientes não acende /admin/clientes-vip', () => {
    expect(abaAtiva('/admin/clientes-vip', '/admin/clientes')).toBe(false)
  })

  it('/admin/hoje não acende em toda rota só por casar com prefixo vazio', () => {
    // Caso que motivou o cuidado extra: sem o tratamento, toda rota do app
    // faria a primeira aba parecer sempre ativa.
    expect(abaAtiva('/admin/agenda', '/admin/hoje')).toBe(false)
    expect(abaAtiva('/admin/clientes/123', '/admin/hoje')).toBe(false)
  })
})
