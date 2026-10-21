import { describe, expect, it } from 'vitest'

import { buscarProfissoes, EM_DESTAQUE, separarDestaque } from '@/core/onboarding/buscar-profissao'

const LISTA = [
  { slug: 'lashes', nome: 'Cílios', sinonimos: ['lash'] },
  { slug: 'nails', nome: 'Unhas', sinonimos: ['manicure', 'alongamento de unhas'] },
  { slug: 'faxina', nome: 'Faxina e diarista', sinonimos: ['limpeza'] },
  { slug: 'aesthetics', nome: 'Estética facial e corporal', sinonimos: ['limpeza de pele'] },
]

const slugs = (termo: string) => buscarProfissoes(LISTA, termo).map((p) => p.slug)

describe('busca de profissão do cadastro (docs/112 EXP-S03)', () => {
  it('termo vazio devolve a lista inteira, na ordem que veio', () => {
    expect(slugs('  ')).toEqual(['lashes', 'nails', 'faxina', 'aesthetics'])
  })

  it('acha por sinônimo e perdoa acento e caixa', () => {
    expect(slugs('LASH')).toEqual(['lashes'])
    expect(slugs('cilios')).toEqual(['lashes'])
    expect(slugs('estetica')).toEqual(['aesthetics'])
  })

  it('o nome vem antes do sinônimo, e o começo antes do meio', () => {
    // "limpeza" é sinônimo das duas; nenhuma casa pelo nome, então vale a ordem do banco.
    expect(slugs('limpeza')).toEqual(['faxina', 'aesthetics'])
    // "unha" casa com o NOME de Unhas; nada mais.
    expect(slugs('unha')).toEqual(['nails'])
    const lista = [
      { slug: 'x', nome: 'Tatuagem', sinonimos: ['unha decorada'] },
      { slug: 'nails', nome: 'Unhas', sinonimos: [] },
    ]
    expect(buscarProfissoes(lista, 'unha').map((p) => p.slug)).toEqual(['nails', 'x'])
  })

  it('termo de várias palavras não casa com sinônimo mais curto', () => {
    expect(slugs('limpeza de pele')).toEqual(['aesthetics'])
  })

  it('nada casa: lista vazia', () => {
    expect(slugs('advogado')).toEqual([])
  })
})

describe('destaque da lista de profissões (docs/112 EXP-S04)', () => {
  const lista = Array.from({ length: 10 }, (_, i) => ({ slug: `p${i}`, nome: `P${i}`, sinonimos: [] }))

  it('as primeiras ficam abertas e o resto vai para "Outras áreas", na ordem que veio', () => {
    const { destaque, outras } = separarDestaque(lista)
    expect(EM_DESTAQUE).toBe(6)
    expect(destaque.map((p) => p.slug)).toEqual(['p0', 'p1', 'p2', 'p3', 'p4', 'p5'])
    expect(outras.map((p) => p.slug)).toEqual(['p6', 'p7', 'p8', 'p9'])
  })

  it('lista curta não ganha grupo vazio', () => {
    expect(separarDestaque(lista.slice(0, 4)).outras).toEqual([])
  })
})
