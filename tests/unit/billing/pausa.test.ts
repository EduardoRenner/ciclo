import { describe, expect, it } from 'vitest'

import { ROTAS_DE_ESCRITA, regraDaEscritaNaPausa } from '@/core/billing/pausa'
import { cortesiaDoCadastro, fimDaGraca, situacaoDaConta } from '@/core/billing/prelancamento'
import { AppError } from '@/server/http/errors'
import { exigirContaQueEscreve } from '@/server/services/planos'

describe('regraDaEscritaNaPausa', () => {
  it('leitura nunca é recusada, mesmo em rota que bloqueia escrita', () => {
    expect(regraDaEscritaNaPausa('GET', '/api/v1/clients')).toBe('leitura')
    expect(regraDaEscritaNaPausa('HEAD', '/api/v1/appointments')).toBe('leitura')
    expect(regraDaEscritaNaPausa('get', '/api/v1/professionals')).toBe('leitura')
  })

  it('criar algo novo bloqueia; mexer no que existe, não', () => {
    expect(regraDaEscritaNaPausa('POST', '/api/v1/clients')).toBe('bloqueia')
    expect(regraDaEscritaNaPausa('POST', '/api/v1/appointments')).toBe('bloqueia')
    expect(regraDaEscritaNaPausa('POST', '/api/v1/clients/3f0c1a52-7e0b-4a53-9d2e-0c4b8f6a1d11/notes')).toBe('bloqueia')
    expect(regraDaEscritaNaPausa('PATCH', '/api/v1/clients/3f0c1a52-7e0b-4a53-9d2e-0c4b8f6a1d11')).toBe('permite')
    expect(regraDaEscritaNaPausa('POST', '/api/v1/appointments/3f0c1a52-7e0b-4a53-9d2e-0c4b8f6a1d11/complete')).toBe('permite')
  })

  it('assinar, cancelar a assinatura, apagar cliente (LGPD) e configurar o negócio seguem liberados', () => {
    for (const [m, c] of [
      ['POST', '/api/v1/billing/assinar'],
      ['POST', '/api/v1/billing/cancelar'],
      ['POST', '/api/v1/clients/3f0c1a52-7e0b-4a53-9d2e-0c4b8f6a1d11/erase'],
      ['PATCH', '/api/v1/tenant'],
    ] as const) {
      expect(regraDaEscritaNaPausa(m, c), `${m} ${c}`).toBe('permite')
    }
  })

  it('a rota fixa ganha da dinâmica: /clients/import não é /clients/[id]', () => {
    expect(regraDaEscritaNaPausa('POST', '/api/v1/clients/import')).toBe('bloqueia')
    expect(regraDaEscritaNaPausa('POST', '/api/v1/services/reorder')).toBe('permite')
    expect(regraDaEscritaNaPausa('POST', '/api/v1/appointments/series')).toBe('bloqueia')
  })

  it('barra final e método em minúsculas não escapam da tabela', () => {
    expect(regraDaEscritaNaPausa('post', '/api/v1/clients/')).toBe('bloqueia')
  })

  it('escrita que a tabela não conhece é RECUSADA (negar por padrão)', () => {
    expect(regraDaEscritaNaPausa('POST', '/api/v1/rota-que-ninguem-classificou')).toBe('bloqueia')
    expect(regraDaEscritaNaPausa('DELETE', '/api/v1/clients')).toBe('bloqueia') // método que a rota não tem
  })

  it('a tabela montou os casos acima: tem rotas dos três tipos (controle contra tabela vazia)', () => {
    const valores = new Set(Object.values(ROTAS_DE_ESCRITA))
    expect([...valores].sort()).toEqual(['bloqueia', 'fora', 'permite'])
    expect(Object.keys(ROTAS_DE_ESCRITA).length).toBeGreaterThan(90)
  })
})

describe('exigirContaQueEscreve', () => {
  const plano = 'gratis'
  const cadastro = new Date('2026-12-01T15:00:00Z')
  const cortesia = cortesiaDoCadastro(cadastro)
  const dentro = new Date('2026-12-20T15:00:00Z')
  const pausada = new Date(fimDaGraca(cortesia).getTime() + 3 * 24 * 3600 * 1000)

  it('os relógios do teste são os que dizem: cortesia vigente num, pausa no outro', () => {
    // Controle: sem isto, "não lança" passaria numa conta que nunca pausou.
    expect(situacaoDaConta('gratis', cortesia, dentro).estado).toBe('cortesia')
    expect(situacaoDaConta('gratis', cortesia, pausada).estado).toBe('pausada')
  })

  it('na pausa, criar lança PLAN_LIMIT com contaPausada; ler, editar e assinar passam', () => {
    let erro: unknown
    try {
      exigirContaQueEscreve('POST', '/api/v1/clients', plano, cortesia, pausada)
    } catch (e) {
      erro = e
    }
    expect(erro).toBeInstanceOf(AppError)
    expect((erro as AppError).code).toBe('PLAN_LIMIT')
    expect((erro as AppError).details).toEqual({ contaPausada: true })

    expect(() => exigirContaQueEscreve('GET', '/api/v1/clients', plano, cortesia, pausada)).not.toThrow()
    expect(() => exigirContaQueEscreve('PATCH', '/api/v1/tenant', plano, cortesia, pausada)).not.toThrow()
    expect(() => exigirContaQueEscreve('POST', '/api/v1/billing/assinar', plano, cortesia, pausada)).not.toThrow()
  })

  it('com a cortesia vigente, criar passa', () => {
    expect(() => exigirContaQueEscreve('POST', '/api/v1/clients', plano, cortesia, dentro)).not.toThrow()
  })

  it('quem assinou nunca pausa, mesmo com a cortesia vencida', () => {
    expect(() => exigirContaQueEscreve('POST', '/api/v1/clients', 'equipe', cortesia, pausada)).not.toThrow()
  })

  it('conta sem cortesia (anterior ao programa) segue como antes: não pausa', () => {
    expect(() => exigirContaQueEscreve('POST', '/api/v1/clients', 'gratis', null, pausada)).not.toThrow()
  })
})
