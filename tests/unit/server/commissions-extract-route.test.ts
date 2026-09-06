import { describe, expect, it } from 'vitest'

import { resolverProfessionalIdDoExtrato } from '@/app/api/v1/commissions/extract/route'
import { AppError } from '@/server/http/errors'

const PROPRIO = '11111111-1111-4111-8111-111111111111'
const DE_COLEGA = '22222222-2222-4222-8222-222222222222'

/**
 * `docs/53` C-01 — a lógica exata que impede um profissional de ler o extrato de um colega.
 * Sem HTTP, sem banco, sem mock: é uma decisão pura, e por isso não tem desculpa para ter teste
 * frágil.
 */
describe('resolverProfessionalIdDoExtrato', () => {
  describe('alcance own (papel professional)', () => {
    it('usa o próprio id, mesmo que a query peça outro', () => {
      expect(resolverProfessionalIdDoExtrato('own', DE_COLEGA, PROPRIO)).toBe(PROPRIO)
    })

    it('usa o próprio id quando a query não pede nada', () => {
      expect(resolverProfessionalIdDoExtrato('own', null, PROPRIO)).toBe(PROPRIO)
    })

    it('sem registro de professionals, falha fechado — nunca cai para "mostra tudo"', () => {
      expect(() => resolverProfessionalIdDoExtrato('own', null, null)).toThrow(AppError)
      try {
        resolverProfessionalIdDoExtrato('own', null, null)
      } catch (e) {
        expect((e as AppError).code).toBe('FORBIDDEN')
      }
    })
  })

  describe('alcance all (owner/finance)', () => {
    it('usa o id pedido na query', () => {
      expect(resolverProfessionalIdDoExtrato('all', DE_COLEGA, null)).toBe(DE_COLEGA)
    })

    it('exige um uuid válido — sem ele, erro de validação, não um extrato vazio', () => {
      expect(() => resolverProfessionalIdDoExtrato('all', null, null)).toThrow(AppError)
      expect(() => resolverProfessionalIdDoExtrato('all', 'nao-e-uuid', null)).toThrow(AppError)
    })
  })
})
