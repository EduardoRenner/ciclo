import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { PLANOS } from '@/core/billing/planos'
import { SLUGS_DE_DEMONSTRACAO } from '@/core/tenants/demonstracao'

import {
  CONTAS,
  FAIXA_DE_ATRASADAS,
  FAIXA_DE_OCUPACAO,
  HOMENS,
  oficiosDe,
  ocupacaoPorProfissional,
  pctAtrasadas,
  planoDeClientes,
} from '../../../scripts/contas-de-salao.mjs'

/**
 * docs/112 EXP-S02: a vitrine é o que quem nunca ouviu falar do produto vê primeiro. O seed antigo
 * tinha a lash fazendo escova cinco vezes, 13 de 28 nomes de homem e 5 visitas por cliente
 * qualquer que fosse o ritmo. Cada linha parecia certa; o conjunto era impossível.
 */

/** O ofício que o NOME do serviço denuncia. Remoção existe em cílios e em unhas, então fica de fora. */
const OFICIO_PELO_NOME: ReadonlyArray<[RegExp, string]> = [
  [/c[íi]lios|lash|fio a fio|volume/i, 'cilios'],
  [/sobrancelha|design|brow|henna/i, 'sobrancelha'],
  [/corte|escova|hidrata|progressiva/i, 'cabelo'],
  [/colora|raiz|mechas/i, 'cor'],
  [/alongamento/i, 'alongamento'],
  // `\b` não serve: depois de "é" o JS não vê fronteira de palavra (`regex-pt-br-w-nao-casa-acento`).
  [/^p[ée](?=\s|$)|^m[ãa]o(?=\s|$)|esmalta|blindagem/i, 'unhas'],
  [/bu[çc]o|virilha|perna|axila/i, 'depilacao'],
]

/** Ofícios que uma pessoa faz junto. A lash faz sobrancelha; não faz escova. */
const FAMILIAS: readonly (readonly string[])[] = [
  ['cilios', 'sobrancelha'],
  ['sobrancelha', 'depilacao'],
  ['unhas', 'alongamento'],
  ['cabelo', 'cor'],
]

const SEED = readFileSync('scripts/seed-demo-salao.mjs', 'utf8')

describe('seed de vitrine de salão é coerente (docs/112 EXP-S02)', () => {
  it('são as 4 contas do §5.1', () => {
    expect(CONTAS.map((c) => c.slug)).toEqual(['demo-carol-cilios', 'demo-salao-encanto', 'demo-esmalteria-rosa-cha', 'demo-ana-paula-unhas'])
  })

  it.each(CONTAS)('$slug: todo serviço tem o ofício que o nome diz, e o ritmo declarado', (conta) => {
    for (const s of conta.servicos) {
      expect(Object.hasOwn(s, 'ritmo'), `${s.nome} sem ritmo declarado`).toBe(true)
      if (s.ritmo === null) {
        expect(s.peso, `${s.nome} não tem retorno e não pode ser o serviço de costume de ninguém`).toBe(0)
      } else {
        expect(Number.isInteger(s.ritmo) && s.ritmo >= 1 && s.ritmo <= 365, `${s.nome}: ritmo ${s.ritmo}`).toBe(true)
      }
      if (/remo[çc][ãa]o/i.test(s.nome)) continue
      const casam = OFICIO_PELO_NOME.filter(([re]) => re.test(s.nome))
      expect(casam.map(([, o]) => o), `${s.nome} casa com quantos ofícios?`).toHaveLength(1)
      expect(s.oficio, s.nome).toBe(casam[0]![1])
    }
  })

  it.each(CONTAS)('$slug: cada profissional faz ofícios de uma família só', (conta) => {
    for (const prof of conta.equipe) {
      const oficios = oficiosDe(prof)
      expect(
        FAMILIAS.some((f) => oficios.every((o) => f.includes(o))),
        `${prof.nome} faz ${oficios.join(' + ')}`,
      ).toBe(true)
    }
  })

  it.each(CONTAS)('$slug: ocupação de cada profissional dentro da faixa, saída do ritmo', (conta) => {
    for (const { nome, pct } of ocupacaoPorProfissional(conta)) {
      expect(pct, `${nome}: ${pct}%`).toBeGreaterThanOrEqual(FAIXA_DE_OCUPACAO.min)
      expect(pct, `${nome}: ${pct}%`).toBeLessThanOrEqual(FAIXA_DE_OCUPACAO.max)
    }
  })

  it.each(CONTAS)('$slug: 15% a 20% passaram do dia, nomes únicos, ~90% de mulher', (conta) => {
    const clientes = planoDeClientes(conta)
    const pct = pctAtrasadas(clientes)
    expect(pct).toBeGreaterThanOrEqual(FAIXA_DE_ATRASADAS.min)
    expect(pct).toBeLessThanOrEqual(FAIXA_DE_ATRASADAS.max)
    expect(new Set(clientes.map((c) => c.nome)).size).toBe(clientes.length)
    const deles = clientes.filter((c) => HOMENS.includes(c.nome.split(' ')[0]!)).length
    expect(deles / clientes.length).toBeGreaterThan(0.05)
    expect(deles / clientes.length).toBeLessThan(0.15)
  })

  it.each(CONTAS)('$slug: cabe no plano', (conta) => {
    const plano = PLANOS[conta.plano]
    if (plano.maxProfissionais !== null) expect(conta.equipe.length).toBeLessThanOrEqual(plano.maxProfissionais)
    if (plano.maxClientes !== null) expect(planoDeClientes(conta).length).toBeLessThanOrEqual(plano.maxClientes)
  })

  it('todo slug está na lista de demonstração ANTES de o seed apagar e recriar por slug', () => {
    for (const c of CONTAS) expect(SLUGS_DE_DEMONSTRACAO, c.slug).toContain(c.slug)
  })

  it('o seed só roda no banco local, liga serviço a profissional pelo ofício e confere o cruzamento', () => {
    expect(SEED).toMatch(/if \(!\/\^https\?:\\\/\\\/\(127\\\.0\\\.0\\\.1\|localhost/)
    expect(SEED).toMatch(/servicosDe\(conta, prof\)/)
    expect(SEED).toMatch(/cruzamentos\.length\) precisa\(/)
    expect(SEED).toMatch(/foraDaFaixa\.length\) precisa\(/)
  })
})
