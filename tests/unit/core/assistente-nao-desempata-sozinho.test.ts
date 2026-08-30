import { describe, expect, it } from 'vitest'

import { resolverPorNome, resolverProfissional, type Candidato } from '@/core/assistente/resolver'

/**
 * A regra que impede o pré-mortem do `docs/33 §8.1` de acontecer no nível com confirmação: o
 * assistente **empatou, pergunta — nunca desempata sozinho**. Duas "Maria" na base não podem
 * virar um chute com 50% de chance de marcar horário para a cliente errada.
 */
const CLIENTES: Candidato[] = [
  { id: 'a', nome: 'Maria Silva' },
  { id: 'b', nome: 'Maria Souza' },
  { id: 'c', nome: 'Mariana Lopes' },
  { id: 'd', nome: 'Otávio Pinheiro' },
  { id: 'e', nome: 'Ana' },
]

describe('resolverPorNome', () => {
  it('nome que casa duas clientes NUNCA vira escolha — vira pergunta', () => {
    const r = resolverPorNome('Maria', CLIENTES)
    expect(r.tipo, 'desempatou sozinho: é o pré-mortem do §8.1 acontecendo').toBe('ambiguo')
    // As TRÊS, e não só as duas "Maria": "Mariana" também começa com "maria", e esconder uma
    // opção legítima para a lista ficar bonita é escolher pelo dono por outro caminho. A primeira
    // versão deste teste esperava duas — a expectativa é que estava errada, não o código.
    if (r.tipo === 'ambiguo') {
      expect(r.opcoes.map((o) => o.nome)).toEqual(['Maria Silva', 'Maria Souza', 'Mariana Lopes'])
    }
  })

  it('nome exato vence prefixo — "Ana" não vira ambiguidade por causa de "Mariana"', () => {
    // Sem a passada de exato ANTES da de "contém", "Ana" casaria "Ana" e "Mariana" juntas e o
    // assistente perguntaria onde havia resposta certa. Ruído também é defeito.
    const r = resolverPorNome('Ana', CLIENTES)
    expect(r.tipo).toBe('achou')
    if (r.tipo === 'achou') expect(r.item.nome).toBe('Ana')
  })

  it('acha sem acento, como a pessoa digita', () => {
    const r = resolverPorNome('otavio', CLIENTES)
    expect(r.tipo).toBe('achou')
    if (r.tipo === 'achou') expect(r.item.nome).toBe('Otávio Pinheiro')
  })

  it('quem não existe devolve "nenhum" — nunca o primeiro da lista', () => {
    // O modo de falha mais perigoso seria "não achei, vou de primeiro mesmo".
    expect(resolverPorNome('Fulano Inexistente', CLIENTES).tipo).toBe('nenhum')
    expect(resolverPorNome('   ', CLIENTES).tipo).toBe('nenhum')
  })

  it('sobrenome também resolve — o dono fala como fala', () => {
    const r = resolverPorNome('Souza', CLIENTES)
    expect(r.tipo).toBe('achou')
    if (r.tipo === 'achou') expect(r.item.nome).toBe('Maria Souza')
  })
})

describe('resolverProfissional', () => {
  const um: Candidato[] = [{ id: 'p1', nome: 'Dona do Salão' }]
  const varios: Candidato[] = [
    { id: 'p1', nome: 'Bruna' },
    { id: 'p2', nome: 'Carla' },
  ]

  it('salão de uma pessoa não pergunta "com quem?" — não existe alternativa', () => {
    const r = resolverProfissional(undefined, um)
    expect(r.tipo).toBe('achou')
  })

  it('com mais de um profissional e sem nome dito, pergunta em vez de escolher', () => {
    expect(resolverProfissional(undefined, varios).tipo).toBe('ambiguo')
    expect(resolverProfissional('', varios).tipo).toBe('ambiguo')
  })

  it('nome dito resolve mesmo com vários', () => {
    const r = resolverProfissional('carla', varios)
    expect(r.tipo).toBe('achou')
    if (r.tipo === 'achou') expect(r.item.nome).toBe('Carla')
  })
})
