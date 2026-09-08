import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { semComentarios } from '../../helpers/fonte'

/**
 * Achado da auditoria de 2026-09-08.
 *
 * O default do `@supabase/ssr` é `httpOnly: false` (`dist/main/utils/constants.js`), e nenhum dos
 * dois lugares que montam o cliente passava `cookieOptions`. Access e refresh token ficavam
 * legíveis por `document.cookie` — qualquer XSS deixava de ser sequestro de aba e virava takeover
 * duradouro, porque o refresh token continua valendo depois de a aba fechar.
 *
 * **Os DOIS pontos, e por que um só não basta.** `server-client.ts` monta o cliente das rotas e
 * Server Components; `middleware.ts` é quem RENOVA o access token de 15 em 15 minutos. Corrigir
 * só o primeiro deixaria cada token renovado nascendo legível — o buraco voltaria sozinho, a cada
 * renovação, sem ninguém mexer em nada.
 *
 * A CSP com nonce e `strict-dynamic` do middleware torna XSS improvável, e é o que segura a
 * severidade disto. Mas defesa que depende de uma camada só não é defesa: se a CSP for afrouxada
 * um dia, é este `httpOnly` que decide se o estrago é uma aba ou a conta inteira.
 *
 * Não cobre o `createBrowserClient`: ele escreve por `document.cookie`, que não tem como marcar
 * `httpOnly` nem se quisesse. E nada no cliente depende de ler a sessão — `criarClienteDoNavegador`
 * é usado num lugar só, para `signInWithOAuth`, que não lê sessão existente.
 */

const PONTOS = [
  { arquivo: join('src', 'server', 'db', 'server-client.ts'), papel: 'cliente das rotas e Server Components' },
  { arquivo: join('src', 'middleware.ts'), papel: 'renovação do access token a cada 15 minutos' },
]

describe('o cookie de sessão não é legível por JavaScript', () => {
  it.each(PONTOS)('$arquivo ($papel) passa httpOnly', ({ arquivo }) => {
    const fonte = semComentarios(readFileSync(arquivo, 'utf8'))

    // Piso: se o arquivo parar de montar o cliente, esta guarda passaria vazia sem denunciar.
    expect(/createServerClient/.test(fonte), `${arquivo} não monta mais o cliente do Supabase`).toBe(true)

    expect(
      /cookieOptions:\s*{[^}]*httpOnly:\s*true/.test(fonte),
      `${arquivo} deixou de passar httpOnly. O default do @supabase/ssr é false, então o token ` +
        'volta a ser legível por document.cookie e um XSS vira takeover duradouro.',
    ).toBe(true)
  })

  it.each(PONTOS)('$arquivo também marca secure e sameSite', ({ arquivo }) => {
    const fonte = semComentarios(readFileSync(arquivo, 'utf8'))
    const bloco = fonte.match(/cookieOptions:\s*{[^}]*}/)?.[0] ?? ''
    expect(bloco, `${arquivo}: cookie de sessão sem secure`).toMatch(/secure:\s*true/)
    expect(bloco, `${arquivo}: cookie de sessão sem sameSite`).toMatch(/sameSite:/)
  })

  it('o detector distingue presente de ausente', () => {
    // Guarda contra o próprio detector: sem isto, um regex quebrado deixaria tudo verde.
    const com = 'createServerClient(u, a, { cookieOptions: { httpOnly: true, secure: true }, cookies: {} })'
    const sem = 'createServerClient(u, a, { cookies: {} })'
    const casa = (t: string) => /cookieOptions:\s*{[^}]*httpOnly:\s*true/.test(t)
    expect(casa(com)).toBe(true)
    expect(casa(sem)).toBe(false)
  })
})
