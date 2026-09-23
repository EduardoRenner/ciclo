import { describe, expect, it } from 'vitest'

import type { NextRequest } from 'next/server'

import { lerOrigem, linkComOrigem, origemDaUrl, primeiroToque, serializarOrigem } from '@/core/aquisicao/origem'
import { origemParaGravar } from '@/middleware'

const HOJE = '2026-09-23'

function params(qs: string): URLSearchParams {
  return new URLSearchParams(qs)
}

/** Um `NextRequest` de mentira com só o que `origemParaGravar` toca. */
function req(caminhoEQuery: string, cookies: Record<string, string> = {}, cabecalhos: Record<string, string> = {}): NextRequest {
  const url = new URL(caminhoEQuery, 'https://seuciclo.com.br')
  return {
    nextUrl: url,
    headers: new Headers(cabecalhos),
    cookies: { get: (nome: string) => (nome in cookies ? { name: nome, value: cookies[nome] } : undefined) },
  } as unknown as NextRequest
}

describe('origemDaUrl (docs/82 §6)', () => {
  it('lê canal e quem indicou do link do convite', () => {
    expect(origemDaUrl(params('origem=convite&ref=dom-rocha'), HOJE)).toEqual({ canal: 'convite', ref: 'dom-rocha', em: HOJE })
  })

  it('aceita utm_source, que é o que ferramenta de terceiro já escreve', () => {
    expect(origemDaUrl(params('utm_source=instagram'), HOJE)).toEqual({ canal: 'instagram', ref: null, em: HOJE })
  })

  it('`origem` ganha de `utm_source` quando os dois vêm', () => {
    expect(origemDaUrl(params('origem=visita&utm_source=instagram'), HOJE)?.canal).toBe('visita')
  })

  it('ref sozinho é indicação', () => {
    expect(origemDaUrl(params('ref=parceiro-joao'), HOJE)).toEqual({ canal: 'convite', ref: 'parceiro-joao', em: HOJE })
  })

  it('canal bem-formado fora da lista vira `outro`, não uma chave nova no placar', () => {
    expect(origemDaUrl(params('origem=tiktok'), HOJE)?.canal).toBe('outro')
  })

  it('normaliza maiúscula e espaço nas pontas', () => {
    expect(origemDaUrl(params('origem=%20Instagram%20&ref=Dom-Rocha'), HOJE)).toEqual({ canal: 'instagram', ref: 'dom-rocha', em: HOJE })
  })

  it('visita sem origem não diz nada — e não pode ocupar o primeiro toque', () => {
    expect(origemDaUrl(params(''), HOJE)).toBeNull()
    expect(origemDaUrl(params('servico=abc'), HOJE)).toBeNull()
  })

  it.each([
    'origem=<script>',
    'origem=a%3Bb',
    'origem=' + 'x'.repeat(60),
    'origem=-comeca-com-hifen',
    'ref=../../admin',
  ])('descarta o que não tem formato de slug: %s', (qs) => {
    expect(origemDaUrl(params(qs), HOJE)).toBeNull()
  })
})

describe('serializarOrigem / lerOrigem', () => {
  it('ida e volta preservam a origem', () => {
    const origem = { canal: 'selo' as const, ref: 'dom-rocha', em: HOJE }
    expect(lerOrigem(serializarOrigem(origem))).toEqual(origem)
    expect(lerOrigem(serializarOrigem({ canal: 'google', ref: null, em: HOJE }))).toEqual({ canal: 'google', ref: null, em: HOJE })
  })

  it.each([
    ['vazio', ''],
    ['sem data', 'canal=selo'],
    ['data fora do formato', 'canal=selo&em=ontem'],
    ['canal que não é slug', 'canal=%3Cx%3E&em=2026-09-23'],
    ['ref adulterado', 'canal=selo&em=2026-09-23&ref=%27%3B%20drop'],
  ])('cookie adulterado (%s) vira "sem origem", nunca linha inventada', (_nome, valor) => {
    expect(lerOrigem(valor)).toBeNull()
  })

  it('sem cookie, sem origem', () => {
    expect(lerOrigem(undefined)).toBeNull()
    expect(lerOrigem(null)).toBeNull()
  })
})

describe('linkComOrigem', () => {
  it('link absoluto do convite', () => {
    expect(linkComOrigem('https://seuciclo.com.br', 'convite', 'dom-rocha')).toBe('https://seuciclo.com.br/?origem=convite&ref=dom-rocha')
  })

  it('caminho relativo do selo continua relativo', () => {
    expect(linkComOrigem('/', 'selo', 'dom-rocha')).toBe('/?origem=selo&ref=dom-rocha')
  })

  it('ref inválido some do link em vez de ir escapado', () => {
    expect(linkComOrigem('/', 'selo', 'Não É Slug!')).toBe('/?origem=selo')
  })

  it('o link que ele monta é lido de volta pelo middleware com a mesma origem', () => {
    const link = new URL(linkComOrigem('https://seuciclo.com.br', 'convite', 'dom-rocha'))
    expect(origemDaUrl(link.searchParams, HOJE)).toEqual({ canal: 'convite', ref: 'dom-rocha', em: HOJE })
  })
})

describe('origemParaGravar (middleware)', () => {
  it('grava quando a visita chega por um link com origem', () => {
    expect(lerOrigem(origemParaGravar(req('/?origem=selo&ref=dom-rocha'), HOJE))).toEqual({ canal: 'selo', ref: 'dom-rocha', em: HOJE })
  })

  it('primeiro toque vence: não sobrescreve origem já guardada', () => {
    expect(origemParaGravar(req('/?origem=google', { ciclo_origem: 'canal=convite&em=2026-09-01' }), HOJE)).toBeNull()
  })

  it('não grava sem origem no link', () => {
    expect(origemParaGravar(req('/precos'), HOJE)).toBeNull()
  })

  it('não grava em /api — quem chama API é o app, não uma pessoa chegando por link', () => {
    expect(origemParaGravar(req('/api/v1/public/dom-rocha/availability?origem=selo'), HOJE)).toBeNull()
  })

  it.each([
    [{ 'next-router-prefetch': '1' }],
    [{ 'sec-purpose': 'prefetch' }],
    [{ purpose: 'prefetch' }],
    [{ 'sec-purpose': 'prefetch;prerender' }],
  ])('prefetch não é visita (%o): o <Link> do selo visível no rodapé não pode gravar origem', (cabecalhos) => {
    expect(origemParaGravar(req('/?origem=selo&ref=dom-rocha', {}, cabecalhos), HOJE)).toBeNull()
  })

  it('navegação de verdade por <Link> (RSC, sem prefetch) grava', () => {
    expect(origemParaGravar(req('/?origem=selo&ref=dom-rocha&_rsc=abc', {}, { rsc: '1' }), HOJE)).not.toBeNull()
  })

  it('grava em qualquer tela de entrada, não só na raiz', () => {
    expect(origemParaGravar(req('/cadastro?origem=visita'), HOJE)).not.toBeNull()
    expect(origemParaGravar(req('/precos?utm_source=instagram'), HOJE)).not.toBeNull()
  })
})

describe('primeiroToque (conta × navegador)', () => {
  const conta = { canal: 'convite' as const, ref: 'dom-rocha', em: '2026-09-10' }
  const navegador = { canal: 'google' as const, ref: null, em: '2026-09-20' }

  it('link de confirmação aberto em outro navegador: sem cookie, vale a origem da conta', () => {
    expect(primeiroToque(conta, null)).toEqual(conta)
  })

  it('conta sem origem (cadastro antigo ou sem link): vale o cookie', () => {
    expect(primeiroToque(null, navegador)).toEqual(navegador)
  })

  it('as duas existem: a mais antiga ganha', () => {
    expect(primeiroToque(conta, navegador)).toEqual(conta)
    expect(primeiroToque({ ...conta, em: '2026-09-25' }, navegador)).toEqual(navegador)
  })

  it('empate de data fica com a da conta, registrada no momento do cadastro', () => {
    expect(primeiroToque(conta, { ...navegador, em: conta.em })).toEqual(conta)
  })

  it('nenhuma: sem origem', () => {
    expect(primeiroToque(null, null)).toBeNull()
  })
})
