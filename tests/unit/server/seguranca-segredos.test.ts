import { randomUUID } from 'node:crypto'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { compararSegredo } from '@/server/http/segredo'
import { gerarTokenAssinado, verificarTokenAssinado } from '@/server/services/token-assinado'

/**
 * Achados S1 e S2 de `docs/16-AUDITORIA-SEGURANCA.md`.
 */

describe('S2 · comparação de segredo sem vazar tempo', () => {
  it('aceita só o valor exato', () => {
    expect(compararSegredo('abc123', 'abc123')).toBe(true)
    expect(compararSegredo('abc124', 'abc123')).toBe(false)
  })

  it('recusa ausente, vazio e tamanho diferente sem estourar', () => {
    expect(compararSegredo(null, 'abc123')).toBe(false)
    expect(compararSegredo(undefined, 'abc123')).toBe(false)
    expect(compararSegredo('', 'abc123')).toBe(false)
    expect(compararSegredo('abc123', undefined)).toBe(false)
    // Tamanhos diferentes fariam `timingSafeEqual` lançar — tem que devolver false, não quebrar.
    expect(compararSegredo('abc', 'abc123')).toBe(false)
    expect(compararSegredo('abc123456', 'abc123')).toBe(false)
  })

  it('não trata o segredo vazio como coringa', () => {
    // Se `esperado` vier vazio (env não configurada), nada pode passar.
    expect(compararSegredo('', '')).toBe(false)
    expect(compararSegredo('qualquer', '')).toBe(false)
  })
})

describe('S1 · chave de link público separada do CRON_SECRET', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  const ANTIGA = 'cron-secret-antigo-do-ambiente'
  const NOVA = 'chave-nova-de-assinatura-de-link-publico'

  it('link assinado antes da rotação continua valendo depois dela', () => {
    // Antes: só existe CRON_SECRET, e é ele que assina.
    vi.stubEnv('CRON_SECRET', ANTIGA)
    const id = randomUUID()
    const tokenAntigo = gerarTokenAssinado('confirmacao_agendamento', id, 72)

    // Depois: o Eduardo cria a chave nova. O link que já está no WhatsApp da cliente não pode
    // morrer por causa disso — é o ponto todo da transição.
    vi.stubEnv('PUBLIC_LINK_SIGNING_KEY', NOVA)
    expect(verificarTokenAssinado('confirmacao_agendamento', tokenAntigo)).toBe(id)
  })

  it('depois da rotação, o link novo é assinado com a chave NOVA, não com a antiga', () => {
    vi.stubEnv('CRON_SECRET', ANTIGA)
    vi.stubEnv('PUBLIC_LINK_SIGNING_KEY', NOVA)
    const id = randomUUID()
    const tokenNovo = gerarTokenAssinado('orcamento', id, 24)

    expect(verificarTokenAssinado('orcamento', tokenNovo)).toBe(id)
    // O ponto do S1: quem só tem o CRON_SECRET vazado não consegue mais validar (nem forjar)
    // link novo.
    expect(verificarTokenAssinado('orcamento', tokenNovo, ANTIGA)).toBeNull()
    expect(verificarTokenAssinado('orcamento', tokenNovo, NOVA)).toBe(id)
  })

  it('chave alheia continua sendo recusada', () => {
    vi.stubEnv('CRON_SECRET', ANTIGA)
    vi.stubEnv('PUBLIC_LINK_SIGNING_KEY', NOVA)
    const token = gerarTokenAssinado('orcamento', randomUUID(), 24, 'chave-de-um-atacante')
    expect(verificarTokenAssinado('orcamento', token)).toBeNull()
  })

  it('escopo continua preso à assinatura — token de um fluxo não serve em outro', () => {
    vi.stubEnv('CRON_SECRET', ANTIGA)
    vi.stubEnv('PUBLIC_LINK_SIGNING_KEY', NOVA)
    const id = randomUUID()
    const daListaDeEspera = gerarTokenAssinado('lista_espera', id, 24)
    expect(verificarTokenAssinado('orcamento', daListaDeEspera)).toBeNull()
    expect(verificarTokenAssinado('lista_espera', daListaDeEspera)).toBe(id)
  })
})
