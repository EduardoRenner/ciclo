import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { pacoteAberto, pacotesAbertos } from '@/core/pacotes/abertos'
import { pacoteDe } from '@/core/pacotes'
import { OFICINA_ABERTA } from '@/core/pacotes/oficina-aberta'
import { ADVOCACIA_ABERTA } from '@/core/pacotes/advocacia-aberta'

import { semComentarios } from '../../helpers/fonte'

/** docs/101 T0.6: nenhuma conta real de Advocacia antes de a chave ser ligada por decisão. */

describe('a chave', () => {
  it('nasce desligada', () => {
    // Ligar é decisão do Eduardo depois do checklist "pode entrar dado real". Este teste reprova no
    // commit que ligar, para que a mudança nunca entre sem alguém ler esta linha e trocá-la junto.
    expect(ADVOCACIA_ABERTA).toBe(false)
  })
})

describe('quais pacotes aceitam conta nova', () => {
  it('base sempre, com a chave ligada ou desligada', () => {
    expect(pacoteAberto('base', false)).toBe(true)
    expect(pacoteAberto('base', true)).toBe(true)
  })

  it('advocacia só com a chave ligada', () => {
    expect(pacoteAberto('advocacia', false)).toBe(false)
    expect(pacoteAberto('advocacia', true)).toBe(true)
  })

  it('a lista da tela e a regra do servidor saem da mesma função', () => {
    expect(pacotesAbertos(false)).toEqual(['base'])
    expect(pacotesAbertos(true)).toEqual(['base', 'advocacia'])
  })
})

describe('as duas leitoras usam a regra', () => {
  it('a tela de cadastro filtra o catálogo pelos pacotes abertos', () => {
    const fonte = semComentarios(readFileSync('src/app/onboarding/page.tsx', 'utf8'))
    expect(/\.in\('pacote', pacotesAbertos\(\)\)/.test(fonte), 'o cadastro lista profissão de pacote fechado').toBe(true)
  })

  it('o serviço de onboarding recusa pacote fechado no servidor', () => {
    const fonte = semComentarios(readFileSync('src/server/services/onboarding.ts', 'utf8'))
    expect(/select\('id, slug, onde, cobranca, inicio, ritmo, pacote'\)/.test(fonte), 'o serviço não lê o pacote da profissão').toBe(true)
    expect(/if \(!pacoteAberto\(normalizarPacote\(data\.pacote\)\)\)/.test(fonte), 'o serviço aceita pacote fechado').toBe(true)
  })
})

describe('o pacote Oficina nasce fechado (AUT-104, C-031)', () => {
  it('a chave está desligada: entrar no mercado de oficinas é decisão do Eduardo', () => {
    expect(OFICINA_ABERTA).toBe(false)
    expect(pacoteAberto('oficina')).toBe(false)
    expect(pacotesAbertos()).not.toContain('oficina')
  })

  it('aberta, a oficina entra; a chave dela não abre a advocacia nem o contrário', () => {
    expect(pacoteAberto('oficina', false, true)).toBe(true)
    expect(pacoteAberto('advocacia', false, true)).toBe(false)
    expect(pacoteAberto('oficina', true, false)).toBe(false)
    expect(pacotesAbertos(false, true)).toEqual(['base', 'oficina'])
  })

  it('o registro resolve o slug do banco para o pacote com o vocabulário do balcão', () => {
    expect(pacoteDe('oficina').nome).toBe('Oficina')
    expect(pacoteDe('oficina').vocabularioExtra.veiculo).toBe('veículo')
  })
})

