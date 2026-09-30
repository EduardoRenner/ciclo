import { describe, expect, it } from 'vitest'

import { BASES_EM, ROTA_AO_PULAR_PERFIL, rotaAposResponderPerfil } from '@/core/onboarding/perfil'

/**
 * `docs/83` §5.3 — a tabela de roteamento da Pergunta 1. Um caso por linha da tabela, para a
 * tabela e o código nunca divergirem em silêncio.
 */
describe('rotaAposResponderPerfil (docs/83 §5.3)', () => {
  it('cabeça ou caderno cai em ja-atendo — digitar de memória', () => {
    expect(rotaAposResponderPerfil('cabeca_caderno')).toBe('/admin/clientes/ja-atendo')
  })

  it('WhatsApp ou contatos do celular também cai em ja-atendo', () => {
    expect(rotaAposResponderPerfil('whatsapp_contatos')).toBe('/admin/clientes/ja-atendo')
  })

  it('planilha cai no importador de CSV', () => {
    expect(rotaAposResponderPerfil('planilha')).toBe('/admin/clientes/importar')
  })

  it('outro sistema cai na tela "Vindo de outro sistema" (placeholder de P2)', () => {
    expect(rotaAposResponderPerfil('outro_sistema')).toBe('/admin/clientes/vindo-de-outro-sistema')
  })

  it('começando agora pula a importação e vai direto pro painel/link', () => {
    expect(rotaAposResponderPerfil('comecando_agora')).toBe('/admin/hoje')
  })

  it('toda base_em conhecida tem uma rota — nenhuma cai no `undefined` do switch', () => {
    for (const baseEm of BASES_EM) {
      expect(typeof rotaAposResponderPerfil(baseEm)).toBe('string')
    }
  })
})

describe('pular (docs/83 §5.1: "Pular tudo" e o "Pular" de cada pergunta)', () => {
  it('sempre leva pro painel, sem depender de nenhuma resposta', () => {
    expect(ROTA_AO_PULAR_PERFIL).toBe('/admin/hoje')
  })
})

describe('P5 — a dor escolhida sobe para o topo da Central de Ações', () => {
  it('os cartões da dor vão primeiro, na ordem em que estavam; o resto segue igual', async () => {
    const { priorizarPelaDor } = await import('@/core/onboarding/perfil')
    const acoes = [{ chave: 'recuperar' }, { chave: 'aniversariantes' }, { chave: 'completude-custo-fixo' }, { chave: 'completude-taxa' }]
    expect(priorizarPelaDor(acoes, 'quanto_sobra').map((a) => a.chave)).toEqual(['completude-custo-fixo', 'completude-taxa', 'recuperar', 'aniversariantes'])
    expect(priorizarPelaDor(acoes, 'cliente_some').map((a) => a.chave)).toEqual(['recuperar', 'aniversariantes', 'completude-custo-fixo', 'completude-taxa'])
  })

  it('sem cartão da dor, ou sem dor, nada muda', async () => {
    const { priorizarPelaDor } = await import('@/core/onboarding/perfil')
    const acoes = [{ chave: 'aniversariantes' }, { chave: 'pontos' }]
    expect(priorizarPelaDor(acoes, 'quanto_sobra')).toEqual(acoes)
    expect(priorizarPelaDor(acoes, null)).toEqual(acoes)
  })

  // As outras chaves da dor são tipadas pela união de quem as emite; 'recuperar' nasce em server/ e
  // a regra 5 impede importar o tipo. Casa com o EMISSOR (o push do cartão), não com a string solta.
  it("o cartão 'recuperar' que a dor prioriza ainda é emitido pela Central de Ações", async () => {
    const { readFileSync } = await import('node:fs')
    const crm = readFileSync('src/server/services/crm.ts', 'utf8')
    expect(crm).toMatch(/acoes\.push\(\{\s*chave: 'recuperar',/)
  })

  it('lerDorPrincipal só aceita as dores que existem', async () => {
    const { lerDorPrincipal } = await import('@/core/onboarding/perfil')
    expect(lerDorPrincipal({ dor_principal: 'quanto_sobra' })).toBe('quanto_sobra')
    expect(lerDorPrincipal({ dor_principal: 'falta' })).toBeNull()
    expect(lerDorPrincipal(null)).toBeNull()
  })
})

describe('P6 — "O que muda por aqui" só diz o que é verdade no plano da conta', () => {
  it('plano com tudo: link, ritmo, e comanda, pacote e fidelidade', async () => {
    const { oQueMudaPorAqui } = await import('@/core/onboarding/perfil')
    expect(oQueMudaPorAqui({ paginaPublica: true, comanda: true, fidelidade: true })).toEqual([
      'Seu cliente marca pelo seu link, sem baixar app nenhum.',
      'Você não escolhe prazo de retorno: o CICLO calcula o ritmo de cada cliente pelas visitas.',
      'Comanda, pacote e fidelidade funcionam do jeito que você já conhece.',
    ])
  })

  it('sem comanda e sem fidelidade no plano: não promete nenhuma das duas', async () => {
    const { oQueMudaPorAqui } = await import('@/core/onboarding/perfil')
    const frases = oQueMudaPorAqui({ paginaPublica: true, comanda: false, fidelidade: false })
    expect(frases[2]).toBe('Pacote funciona do jeito que você já conhece.')
    expect(frases.join(' ')).not.toMatch(/comanda|fidelidade/i)
  })

  it('só uma das duas: a lista e o verbo concordam', async () => {
    const { oQueMudaPorAqui } = await import('@/core/onboarding/perfil')
    expect(oQueMudaPorAqui({ paginaPublica: true, comanda: true, fidelidade: false })[2]).toBe('Comanda e pacote funcionam do jeito que você já conhece.')
    expect(oQueMudaPorAqui({ paginaPublica: true, comanda: false, fidelidade: true })[2]).toBe('Pacote e fidelidade funcionam do jeito que você já conhece.')
  })

  it('página pública desligada: some a frase do link, e o resto segue', async () => {
    const { oQueMudaPorAqui } = await import('@/core/onboarding/perfil')
    const frases = oQueMudaPorAqui({ paginaPublica: false, comanda: false, fidelidade: false })
    expect(frases).toHaveLength(2)
    expect(frases.join(' ')).not.toMatch(/link/)
  })
})
