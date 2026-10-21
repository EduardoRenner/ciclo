import { readFileSync } from 'node:fs'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { provedoresSociaisParaRequisicao } from '@/server/auth/provedores-sociais'

import { semComentarios } from '../../helpers/fonte'

/**
 * docs/98-aprimoramento/11 LOJA-21. Os botões "Entrar com Google/Apple" abrem o OAuth do provedor na própria tela.
 * Dentro do app da loja essa tela é embutida, e o Google recusa login em tela embutida (`disallowed_useragent`):
 * o revisor toca, vê erro, e o app cai na 2.1. Com Google oferecido, a 4.8 ainda exigiria o Apple. Até existir
 * fluxo nativo, o app mostra só e-mail e senha; no navegador nada muda.
 */
const UA_APP = 'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36 CicloApp'
const UA_NAVEGADOR = 'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36'

describe('login social não aparece dentro do app nativo', () => {
  afterEach(() => vi.unstubAllGlobals())

  function comProvedoresLigados() {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://projeto.supabase.test')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon')
    const fetch = vi.fn(async () => new Response(JSON.stringify({ external: { google: true, apple: true } })))
    vi.stubGlobal('fetch', fetch)
    return fetch
  }

  it('no navegador, os provedores ligados aparecem (o cenário foi montado)', async () => {
    comProvedoresLigados()
    expect(await provedoresSociaisParaRequisicao(UA_NAVEGADOR)).toEqual(['google', 'apple'])
  })

  it('no app, nenhum, e sem nem perguntar ao Supabase', async () => {
    const fetch = comProvedoresLigados()
    expect(await provedoresSociaisParaRequisicao(UA_APP)).toEqual([])
    expect(fetch).not.toHaveBeenCalled()
  })

  it.each(['src/app/(auth)/entrar/page.tsx', 'src/app/(auth)/cadastro/page.tsx'])('%s passa o User-Agent', (pagina) => {
    const fonte = semComentarios(readFileSync(pagina, 'utf8'))
    expect(fonte).toMatch(/await provedoresSociaisParaRequisicao\(\(await headers\(\)\)\.get\('user-agent'\)\)/)
    expect(fonte, 'a página ainda chama a versão que não olha o aparelho').not.toMatch(/await provedoresSociaisAtivos\(/)
  })
})
