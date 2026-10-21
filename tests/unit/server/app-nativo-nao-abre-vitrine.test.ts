import { describe, expect, it } from 'vitest'

import { NextRequest } from 'next/server'

import { destinoNoAppNativo, middleware } from '@/middleware'

/**
 * docs/98-aprimoramento/11 LOJA-20. O app nativo abre `https://seuciclo.com.br/` (`capacitor.config.ts`), e a
 * `/` é a landing: preços, "comece grátis" e a FAQ dizendo para abrir no navegador e adicionar à tela de
 * início. `/precos` mostra os planos com botão para assinar. Dentro do app da loja as duas são exatamente o
 * que as regras 3.1.1 e 3.1.3 recusam (caminho de compra fora da loja) e o que a 4.2 lê como "o app é o
 * site". As telas de dentro já escondem o link para `/precos` (`precos-nunca-sozinho-no-app-nativo`); faltava
 * a porta da frente.
 */
const UA_APP = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 CicloApp'
const UA_SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'

function req(caminho: string, ua: string, cookies = '') {
  return new NextRequest(`https://seuciclo.com.br${caminho}`, { headers: { 'user-agent': ua, ...(cookies ? { cookie: cookies } : {}) } })
}

describe('a vitrine não abre dentro do app nativo', () => {
  it.each(['/', '/precos', '/precos/'])('%s no app vai para /entrar', (caminho) => {
    expect(destinoNoAppNativo(caminho, UA_APP)).toBe('/entrar')
  })

  it.each(['/entrar', '/cadastro', '/admin/hoje', '/dom-rocha', '/privacidade', '/termos'])('%s no app fica onde está', (caminho) => {
    expect(destinoNoAppNativo(caminho, UA_APP)).toBeNull()
  })

  it.each(['/', '/precos'])('%s no navegador continua sendo a vitrine', (caminho) => {
    expect(destinoNoAppNativo(caminho, UA_SAFARI)).toBeNull()
    expect(destinoNoAppNativo(caminho, null)).toBeNull()
  })

  it('o middleware de verdade redireciona a landing no app', async () => {
    const r = await middleware(req('/', UA_APP))
    expect(r.status).toBe(307)
    expect(new URL(r.headers.get('location') ?? '').pathname).toBe('/entrar')
  })

  it('o middleware de verdade redireciona /precos no app', async () => {
    const r = await middleware(req('/precos', UA_APP))
    expect(new URL(r.headers.get('location') ?? '').pathname).toBe('/entrar')
  })

  it('quem já entrou e abre o app continua indo para o painel', async () => {
    const r = await middleware(req('/', UA_APP, 'sb-local-auth-token=x'))
    expect(new URL(r.headers.get('location') ?? '').pathname).toBe('/admin/hoje')
  })

  it('no navegador a landing não redireciona', async () => {
    const r = await middleware(req('/', UA_SAFARI))
    expect(r.headers.get('location')).toBeNull()
  })
})
