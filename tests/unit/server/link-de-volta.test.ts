import { randomUUID } from 'node:crypto'

import { describe, expect, it, vi } from 'vitest'

import { gerarTokenIndicacao } from '@/server/services/indicacao'
import { comLinksDeVolta, gerarTokenDeVolta, lerTokenDeVolta, urlDoLinkDeVolta } from '@/server/services/link-de-volta'

// Segredo por parâmetro, nunca pelo ambiente: arquivos de teste compartilham `process.env`.
const SEGREDO = 'segredo-de-teste-do-link-de-volta'

function alvo() {
  return { tenantId: randomUUID(), clientId: randomUUID(), serviceId: randomUUID() }
}

describe('link de volta (docs/95 E1)', () => {
  it('gera e lê de volta o mesmo tenant, cliente e serviço', () => {
    const a = alvo()
    expect(lerTokenDeVolta(gerarTokenDeVolta(a, SEGREDO), SEGREDO)).toEqual(a)
  })

  it('token de outra família (indicação) não é aceito como link de volta', () => {
    expect(lerTokenDeVolta(gerarTokenIndicacao(randomUUID(), SEGREDO), SEGREDO)).toBeNull()
  })

  it('token adulterado, vazio ou ausente vira null, nunca erro', () => {
    const token = gerarTokenDeVolta(alvo(), SEGREDO)
    const meio = Math.floor(token.length / 2)
    const adulterado = token.slice(0, meio) + (token[meio] === 'a' ? 'b' : 'a') + token.slice(meio + 1)
    expect(lerTokenDeVolta(adulterado, SEGREDO)).toBeNull()
    expect(lerTokenDeVolta('', SEGREDO)).toBeNull()
    expect(lerTokenDeVolta(null, SEGREDO)).toBeNull()
    expect(lerTokenDeVolta(undefined, SEGREDO)).toBeNull()
  })

  it('vale 14 dias e vence no 15º', () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date('2026-10-01T12:00:00Z'))
      const token = gerarTokenDeVolta(alvo(), SEGREDO)
      vi.setSystemTime(new Date('2026-10-14T12:00:00Z'))
      expect(lerTokenDeVolta(token, SEGREDO)).not.toBeNull()
      vi.setSystemTime(new Date('2026-10-16T12:00:00Z'))
      expect(lerTokenDeVolta(token, SEGREDO)).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('a URL aponta para o agendamento do salão, sem barra dobrada', () => {
    expect(urlDoLinkDeVolta('https://seuciclo.com.br/', 'dom-estilo', 'abc')).toBe('https://seuciclo.com.br/dom-estilo/agendar?volta=abc')
    expect(urlDoLinkDeVolta(undefined, 'dom-estilo', 'abc')).toBe('/dom-estilo/agendar?volta=abc')
  })

  it('cada item da lista ganha o seu próprio link, que aponta para o cliente e o serviço dele', () => {
    const tenantId = randomUUID()
    const itens = [
      { clientId: randomUUID(), serviceId: randomUUID(), nome: 'A' },
      { clientId: randomUUID(), serviceId: randomUUID(), nome: 'B' },
    ]
    const comLink = comLinksDeVolta(itens, tenantId, 'salao-x', 'https://seuciclo.com.br', SEGREDO)
    expect(comLink).toHaveLength(2)
    for (const [i, item] of comLink.entries()) {
      expect(item.nome).toBe(itens[i]!.nome)
      const token = decodeURIComponent(item.linkVolta?.split('volta=')[1] ?? '')
      expect(lerTokenDeVolta(token, SEGREDO)).toEqual({ tenantId, clientId: itens[i]!.clientId, serviceId: itens[i]!.serviceId })
    }
    expect(comLink[0]!.linkVolta).not.toBe(comLink[1]!.linkVolta)
  })

  it('sem chave de assinatura no ambiente, a lista não quebra: o item fica sem link', () => {
    const antes = { k: process.env.PUBLIC_LINK_SIGNING_KEY, c: process.env.CRON_SECRET }
    vi.stubEnv('PUBLIC_LINK_SIGNING_KEY', '')
    vi.stubEnv('CRON_SECRET', '')
    const erro = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const comLink = comLinksDeVolta([{ clientId: randomUUID(), serviceId: randomUUID() }], randomUUID(), 'salao-x', 'https://x')
      expect(comLink[0]!.linkVolta).toBeNull()
    } finally {
      vi.unstubAllEnvs()
      erro.mockRestore()
    }
    expect(process.env.PUBLIC_LINK_SIGNING_KEY).toBe(antes.k)
    expect(process.env.CRON_SECRET).toBe(antes.c)
  })
})
