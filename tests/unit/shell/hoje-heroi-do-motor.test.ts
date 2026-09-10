import { describe, expect, it } from 'vitest'

import { escolherHeroi } from '@/app/admin/hoje/hoje'

/**
 * Qual número abre a home. Sem harness de render de componente neste projeto, testa a decisão pura.
 *
 * **Medido em 2026-09-10**, no painel local com dados de verdade: o maior elemento da tela era
 * `R$ 0,00` a 34 px, e `R$ 302,75` de receita em risco — o número que só este produto calcula —
 * não aparecia em lugar nenhum. A regra antiga (`receita === 0 && !temProximoCliente &&
 * atribuicao > 0`) quase nunca disparava: bastava um cliente marcado para as 13h.
 *
 * Os cinco casos da versão anterior continuam aqui embaixo, agora como casos desta regra — para a
 * troca não afrouxar nada em silêncio, que é onde guarda de refatoração costuma morrer.
 */

const nada = { atendidoHojeCents: 0, atribuicaoCount: 0, valorEmRiscoCents: 0 }

describe('escolherHeroi', () => {
  describe('a ordem é a da utilidade', () => {
    it('entrou dinheiro hoje: o número do dia ganha de tudo', () => {
      expect(escolherHeroi({ atendidoHojeCents: 5_000, atribuicaoCount: 3, valorEmRiscoCents: 30_275 })).toBe('atendido')
    })

    it('nada hoje mas o Motor já trouxe este mês: prova consumada vence oportunidade', () => {
      expect(escolherHeroi({ ...nada, atribuicaoCount: 3, valorEmRiscoCents: 30_275 })).toBe('motor_trouxe')
    })

    it('nada hoje, sem atribuição, com gente sumindo: mostra o que dá para recuperar', () => {
      // O caso que o conserto existe para pegar, e o mais comum de todos em conta nova.
      expect(escolherHeroi({ ...nada, valorEmRiscoCents: 30_275 })).toBe('motor_em_risco')
    })

    it('nada em lugar nenhum: R$ 0,00 mesmo, porque não há número melhor', () => {
      // Piso contra o próprio conserto: inventar manchete onde não há dado seria pior que o zero.
      expect(escolherHeroi(nada)).toBe('atendido')
    })
  })

  describe('os cinco casos da regra anterior continuam valendo', () => {
    it('dia parado e o Motor já trouxe alguém: herói do Motor', () => {
      expect(escolherHeroi({ ...nada, atribuicaoCount: 3 })).toBe('motor_trouxe')
    })

    it('dia parado e o Motor não trouxe nada, e não há ninguém sumindo: mantém o Atendido hoje', () => {
      expect(escolherHeroi(nada)).toBe('atendido')
    })

    it('já faturou algo hoje: mantém o Atendido hoje, mesmo com atribuição no mês', () => {
      expect(escolherHeroi({ atendidoHojeCents: 5_000, atribuicaoCount: 3, valorEmRiscoCents: 0 })).toBe('atendido')
    })

    it('dia cheio de movimento: mantém o Atendido hoje', () => {
      expect(escolherHeroi({ atendidoHojeCents: 12_000, atribuicaoCount: 5, valorEmRiscoCents: 30_275 })).toBe('atendido')
    })

    it('MUDOU DE PROPÓSITO: ter próximo cliente não força mais o R$ 0,00', () => {
      /*
       * Antes, `temProximoCliente` sozinho derrubava o herói do Motor — e era o caso mais comum,
       * porque quase todo salão tem alguém marcado. O parâmetro saiu da conta: o próximo cliente
       * já tem cartão próprio e destacado ("A seguir"), e ter cliente às 13h não torna `R$ 0,00`
       * uma manchete melhor que `R$ 302,75`.
       */
      expect(escolherHeroi({ ...nada, atribuicaoCount: 3 })).toBe('motor_trouxe')
      expect(escolherHeroi({ ...nada, valorEmRiscoCents: 30_275 })).toBe('motor_em_risco')
    })
  })

  describe('valores de borda', () => {
    it('um centavo atendido já conta como dia acontecendo', () => {
      expect(escolherHeroi({ atendidoHojeCents: 1, atribuicaoCount: 0, valorEmRiscoCents: 30_275 })).toBe('atendido')
    })

    it('risco zerado com contagem positiva não vira manchete de dinheiro', () => {
      // `count > 0` com `totalCents === 0` acontece quando todo mundo da lista vale zero. Uma
      // manchete de "R$ 0,00 dá para recuperar" seria pior que o Atendido hoje.
      expect(escolherHeroi({ ...nada, valorEmRiscoCents: 0 })).toBe('atendido')
    })
  })
})
