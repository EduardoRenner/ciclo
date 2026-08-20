import { describe, expect, it } from 'vitest'

import { MODELOS_PADRAO } from '@/server/services/mensagens-prontas'

/**
 * docs/09-PLATAFORMA.md §2 G10: até 2026-08-19, 8 dos 10 modelos semeados assumiam que o
 * cliente vem até o negócio — errado para quem vai até o cliente (faxineira, eletricista,
 * encanador) e semeado na PRIMEIRA LEITURA da tela, então uma regressão aqui volta a afetar
 * todo tenant novo até alguém notar. Trava contra as frases exatas que causaram o problema, e
 * contra o padrão geral "na {{negocio}}" (que sempre presume "o cliente vem até aqui").
 */
const FRASES_QUE_PRESUMEM_LOCAL = [
  'te espero',
  'passa aqui',
  'pela visita',
  'cliente da casa',
  'segura essa casa',
  'na {{negocio}}',
  'aqui na {{negocio}}',
]

describe('MODELOS_PADRAO não presume onde o atendimento acontece (G10)', () => {
  it.each(MODELOS_PADRAO)('$slug não usa linguagem de "cliente vem até você"', (modelo) => {
    const corpo = modelo.body.toLowerCase()
    for (const frase of FRASES_QUE_PRESUMEM_LOCAL) {
      expect(corpo, `"${modelo.slug}" contém "${frase}": ${modelo.body}`).not.toContain(frase)
    }
  })

  it('continua com os 10 modelos — nenhum foi perdido na reescrita', () => {
    expect(MODELOS_PADRAO).toHaveLength(10)
  })

  it('nenhum corpo passa do limite de 1000 caracteres do EsquemaModelo', () => {
    for (const modelo of MODELOS_PADRAO) {
      expect(modelo.body.length, modelo.slug).toBeLessThanOrEqual(1000)
    }
  })
})
