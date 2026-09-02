import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

/**
 * `src/middleware.ts` (TICKET-057) manda um nonce NOVO a cada requisição no header
 * `Content-Security-Policy` — é o padrão oficial do Next.js para CSP com nonce. Isso só funciona
 * se toda rota HTML for renderizada de forma genuinamente dinâmica: página cacheada (estática, ISR,
 * ou o Full Route Cache interno do Next.js) grava o nonce no HTML na primeira renderização e não
 * atualiza mais — o header muda a cada chamada, o HTML não, e o navegador bloqueia todo `<script>`.
 *
 * Não é hipótese. Medido em produção em 01/09/2026, com `read_console_messages` num navegador de
 * verdade: `/`, `/precos`, `/privacidade`, `/termos` — e até `/entrar`, que o `X-Vercel-Cache: MISS`
 * fazia parecer dinâmica, mas cujo nonce embutido no HTML ficava idêntico em três chamadas seguidas.
 * Nenhuma tela pública tinha JavaScript funcionando: agendamento público, login e cadastro viravam
 * HTML morto. Corrigido com `export const dynamic = 'force-dynamic'` no layout raiz
 * (`src/app/layout.tsx`), herdado por toda rota.
 *
 * Esta guarda existe para que ninguém tire esse `force-dynamic` — por engano, ou de novo em nome de
 * performance, como aconteceu em 27/08 (`docs/DECISOES.md`) — sem entender que ele é o que faz o
 * site ter JavaScript.
 */
const LAYOUT_RAIZ = 'src/app/layout.tsx'
const MIDDLEWARE = 'src/middleware.ts'

describe('CSP com nonce por requisição exige toda rota dinâmica', () => {
  it('o layout raiz força renderização dinâmica', () => {
    const fonte = readFileSync(LAYOUT_RAIZ, 'utf8')
    expect(fonte.length, `${LAYOUT_RAIZ} veio vazio — o teste passaria por não achar nada`).toBeGreaterThan(500)

    expect(
      /export\s+const\s+dynamic\s*=\s*["']force-dynamic["']/.test(fonte),
      `${LAYOUT_RAIZ} perdeu \`export const dynamic = 'force-dynamic'\`. Sem isso, o Next.js pode ` +
        'cachear o HTML de qualquer rota — o nonce gravado nos <script> fica congelado, o header ' +
        'CSP muda a cada chamada, os dois nunca batem, e o navegador bloqueia todo JavaScript. Já ' +
        'aconteceu em produção uma vez (01/09/2026): o site inteiro ficou sem interatividade.',
    ).toBe(true)
  })

  it('o middleware continua mandando um nonce novo por requisição — a outra metade da garantia', () => {
    const fonte = readFileSync(MIDDLEWARE, 'utf8')
    expect(fonte.length, `${MIDDLEWARE} veio vazio`).toBeGreaterThan(500)

    // `force-dynamic` sem nonce por requisição não teria sentido — as duas partes precisam
    // continuar existindo juntas, senão a guarda acima passaria vazia por proteger a metade errada.
    expect(
      /crypto\.randomUUID\(\)/.test(fonte) && /Content-Security-Policy/.test(fonte),
      `${MIDDLEWARE} não gera mais nonce por requisição — se o CSP nonce saiu, o \`force-dynamic\` ` +
        'do layout raiz também pode sair (ele existe só por causa do nonce).',
    ).toBe(true)
  })
})
