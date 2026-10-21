import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { servicoPadraoDaBase } from '@/core/cycle/servico-padrao-da-base'

import { semComentarios } from '../../helpers/fonte'

/** O pacote de barbearia como ele nasce: tudo em `position` 0, então a lista sai em ordem alfabética. */
const BARBEARIA_NOVA = [
  { id: 'barba', cycleDays: 14, atendimentos: 0 },
  { id: 'corte', cycleDays: 21, atendimentos: 0 },
  { id: 'corte-barba', cycleDays: 21, atendimentos: 0 },
  { id: 'infantil', cycleDays: 25, atendimentos: 0 },
  { id: 'pigmentacao', cycleDays: 30, atendimentos: 0 },
  { id: 'platinado', cycleDays: 40, atendimentos: 0 },
]

describe('servicoPadraoDaBase (docs/82 §7)', () => {
  it('conta nova de barbearia vem com Corte, não com Barba (o ciclo mais curto, que vinha por ordem alfabética)', () => {
    expect(servicoPadraoDaBase(BARBEARIA_NOVA)).toBe('corte')
  })

  it('com histórico, vale o serviço mais atendido — mesmo que não seja o do meio', () => {
    const comHistorico = BARBEARIA_NOVA.map((s) => (s.id === 'corte-barba' ? { ...s, atendimentos: 40 } : s.id === 'corte' ? { ...s, atendimentos: 12 } : s))
    expect(servicoPadraoDaBase(comHistorico)).toBe('corte-barba')
  })

  it('um atendimento só já é histórico', () => {
    const umSo = BARBEARIA_NOVA.map((s) => (s.id === 'platinado' ? { ...s, atendimentos: 1 } : s))
    expect(servicoPadraoDaBase(umSo)).toBe('platinado')
  })

  it('número par de serviços: fica com a mediana de baixo, nunca com o mais curto', () => {
    expect(
      servicoPadraoDaBase([
        { id: 'a', cycleDays: 10, atendimentos: 0 },
        { id: 'b', cycleDays: 20, atendimentos: 0 },
        { id: 'c', cycleDays: 30, atendimentos: 0 },
        { id: 'd', cycleDays: 60, atendimentos: 0 },
      ]),
    ).toBe('b')
  })

  it('um serviço só: é ele', () => {
    expect(servicoPadraoDaBase([{ id: 'unico', cycleDays: 30, atendimentos: 0 }])).toBe('unico')
  })

  it('sem serviço: sem padrão', () => {
    expect(servicoPadraoDaBase([])).toBeNull()
  })
})

/**
 * Os três pacotes do alvo de `docs/108-norte`, como nascem numa conta nova (nomes, ritmos e chaves lidos
 * do banco local em 16/10/2026, em ordem alfabética, que é a ordem da tela).
 */
const pacote = (vertical: string, itens: [string, number][]) =>
  itens.map(([nome, cycleDays]) => ({ id: nome, cycleDays, atendimentos: 0, canonicalKey: `pack:${vertical}:${nome}` }))
const CILIOS = pacote('lashes', [['Aplicação clássica', 21], ['Aplicação híbrida', 21], ['Aplicação volume russo', 21], ['Lash lifting + botox', 45], ['Manutenção volume russo', 21], ['Remoção', 21]])
const SOBRANCELHA = pacote('brows', [['Brow lamination', 45], ['Design com henna', 25], ['Design simples', 21], ['Micropigmentação', 365], ['Retoque de micro', 30]])
const UNHAS = pacote('nails', [['Alongamento em fibra', 25], ['Banho de gel', 21], ['Esmaltação em gel', 18], ['Manicure simples', 15], ['Manutenção de alongamento', 25], ['Pedicure', 21], ['Remoção', 21]])

describe('serviço de volta do pacote (docs/108-norte, teste de 10 minutos)', () => {
  it('cílios vem com a manutenção, não com a aplicação (a primeira vez da cliente)', () => {
    expect(servicoPadraoDaBase(CILIOS)).toBe('Manutenção volume russo')
  })

  it('sobrancelha vem com o design simples, não com o retoque de micropigmentação', () => {
    expect(servicoPadraoDaBase(SOBRANCELHA)).toBe('Design simples')
  })

  it('unhas vem com a manicure simples, não com o banho de gel', () => {
    expect(servicoPadraoDaBase(UNHAS)).toBe('Manicure simples')
  })

  it('a chave vale mesmo com o serviço renomeado pelo dono', () => {
    const renomeado = CILIOS.map((s) => (s.id === 'Manutenção volume russo' ? { ...s, id: 'Manutenção da Ju' } : s))
    expect(servicoPadraoDaBase(renomeado)).toBe('Manutenção da Ju')
  })

  it('o histórico continua mandando: a mais atendida ganha do serviço de volta', () => {
    const comHistorico = CILIOS.map((s) => (s.id === 'Aplicação híbrida' ? { ...s, atendimentos: 9 } : s))
    expect(servicoPadraoDaBase(comHistorico)).toBe('Aplicação híbrida')
  })

  it('sem o serviço de volta (o dono apagou), cai na mediana', () => {
    expect(servicoPadraoDaBase(SOBRANCELHA.filter((s) => s.id !== 'Design simples'))).toBe('Retoque de micro')
  })

  it('pacote fora da lista cai na mediana, sem inventar principal', () => {
    expect(servicoPadraoDaBase(pacote('tattoo', [['Fechamento', 60], ['Retoque', 30], ['Flash', 90]]))).toBe('Fechamento')
  })
})

describe('a importação usa a mesma regra (a esteira nascia com servicos[0], o primeiro do alfabeto)', () => {
  const pagina = semComentarios(readFileSync('src/app/admin/clientes/importar/page.tsx', 'utf8'))
  const esteira = semComentarios(readFileSync('src/app/admin/clientes/importar/esteira.tsx', 'utf8'))

  it('a página calcula o padrão pela regra e entrega à esteira', () => {
    expect(pagina).toMatch(/=\s*servicoPadraoDaBase\(/)
    expect(pagina).toMatch(/<EsteiraDeImportacao[^>]*servicoPadrao=\{servicoPadrao\}/)
  })

  it('a esteira começa no padrão recebido, e só sem ele no primeiro da lista', () => {
    expect(esteira).toMatch(/useState\(servicoPadrao \?\? servicos\[0\]/)
  })
})
