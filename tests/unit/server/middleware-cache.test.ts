import { describe, expect, it } from 'vitest'

import type { NextRequest } from 'next/server'

import { exigeSessao, naoCacheavel, precisaRenovarSessao, temCookieDeSessao } from '@/middleware'

/** Um `NextRequest` de mentira com só o `cookies.getAll` que `temCookieDeSessao` toca. */
function reqComCookies(nomes: string[]): NextRequest {
  return { cookies: { getAll: () => nomes.map((name) => ({ name, value: 'x' })) } } as unknown as NextRequest
}

/**
 * Achado S10 da auditoria de 2026-08-23: `Cache-Control: no-store` era aplicado só onde o
 * middleware pedia sessão — `/admin` e `/onboarding`. Nenhuma resposta de `/api/v1` levava o
 * header, incluindo `GET /clients/{id}/vault`, que devolve **ficha de saúde decifrada**, e
 * `GET /media/{id}/url`, que devolve URL assinada de foto de cliente.
 *
 * O CLAUDE.md deste projeto proíbe cachear `/vault` no service worker, e o service worker
 * obedece (a deny-list cobre `/api`). Faltava a mesma regra na camada HTTP, que é a que
 * sobrevive ao PWA e a qualquer proxy no meio.
 *
 * As duas perguntas ficaram separadas porque juntá-las quebraria a API: marcar `/api/*` como
 * "exige sessão" faria toda chamada não autenticada virar `302` para `/entrar` em vez de `401`
 * em JSON — e nenhum `fetch()` sabe o que fazer com isso.
 */

describe('naoCacheavel (achado S10)', () => {
  it.each([
    '/api/v1/clients/00000000-0000-4000-8000-000000000000/vault',
    '/api/v1/media/00000000-0000-4000-8000-000000000000/url',
    '/api/v1/clients',
    '/api/v1/cash/daily',
    '/api/v1/public/dom-rocha/availability',
    '/api/cron/reminders',
    '/api/health',
  ])('%s nunca pode ser cacheada', (caminho) => {
    expect(naoCacheavel(caminho)).toBe(true)
  })

  it.each(['/admin/hoje', '/admin', '/onboarding', '/admin/clientes/abc'])(
    '%s continua sem cache, como já era',
    (caminho) => {
      expect(naoCacheavel(caminho)).toBe(true)
    },
  )

  it.each(['/', '/dom-rocha', '/dom-rocha/agendar', '/entrar', '/avaliar/token123'])(
    '%s é pública e pode ser cacheada — é o que o service worker serve offline',
    (caminho) => {
      expect(naoCacheavel(caminho)).toBe(false)
    },
  )

  it('não pega rota que apenas COMEÇA com as letras de /api', () => {
    // `/apiario` não é `/api`. Prefixo sem barra é como allow-list vira buraco.
    expect(naoCacheavel('/apiario')).toBe(false)
    expect(naoCacheavel('/api')).toBe(true)
  })
})

describe('exigeSessao continua valendo só para telas', () => {
  it.each(['/admin/hoje', '/admin', '/onboarding'])('%s redireciona quem não tem sessão', (caminho) => {
    expect(exigeSessao(caminho)).toBe(true)
  })

  it.each(['/api/v1/clients', '/api/v1/clients/x/vault', '/api/cron/jobs'])(
    '%s NÃO redireciona — precisa de 401 em JSON, não de 302 para o login',
    (caminho) => {
      expect(exigeSessao(caminho)).toBe(false)
    },
  )

  it('rota pública não exige sessão', () => {
    expect(exigeSessao('/dom-rocha/agendar')).toBe(false)
  })
})

/**
 * `docs/28-LATENCIA-DE-CLIQUE-PLANO.md` §3 P1-a. O `getUser()` do middleware é uma ida de rede
 * ao servidor de auth, e ela acontecia em toda requisição — inclusive nas ~90 rotas de
 * `/api/v1`, que refazem a mesma pergunta pelo `contextoAtual` um instante depois.
 *
 * O risco de errar aqui é de segurança, não de performance: se este predicado devolvesse `false`
 * para uma **tela que renderiza dado de usuário**, a renovação de token pararia de acontecer no
 * único lugar em que ela pode acontecer (Server Component não escreve cookie) e a pessoa cairia em
 * `/entrar` a cada 15 minutos.
 *
 * `perf/csp-borda` (2026-09-08) acrescentou um terceiro grupo: as rotas de CONTEÚDO ESTÁTICO
 * (`rotaDeConteudoEstatico`: `/`, `/precos`, `/privacidade`, `/termos`) também saem da renovação —
 * o HTML delas é igual para todo visitante, nenhum Server Component lê sessão ali, e o `getUser()`
 * do middleware (que roda ANTES do prerender do Vercel) era o que fazia `/precos` responder em
 * centenas de ms. Quem só navega no site institucional tem o token renovado na próxima tela de
 * `/admin` ou na próxima chamada de `/api` — o `@supabase/ssr` renova nos dois. A `/` mantém o
 * desvio de quem já entrou, mas por presença de cookie, sem ida de rede.
 */
describe('precisaRenovarSessao (§3 P1-a — ida de rede duplicada)', () => {
  it.each(['/api', '/api/v1/clients', '/api/v1/appointments/abc/confirm', '/api/cron/reminders', '/api/health'])(
    '%s não paga a ida ao servidor de auth — a própria rota pergunta e renova',
    (caminho) => {
      expect(precisaRenovarSessao(caminho)).toBe(false)
    },
  )

  it.each(['/', '/precos', '/privacidade', '/termos'])(
    '%s é conteúdo estático — não lê sessão em Server Component, sai da renovação para poder ser servida da borda',
    (caminho) => {
      expect(precisaRenovarSessao(caminho)).toBe(false)
      // …e continua CACHEÁVEL (é o ponto): o S10 só proíbe cache em `/api/*`, não aqui.
      expect(naoCacheavel(caminho)).toBe(false)
    },
  )

  it.each(['/admin/hoje', '/admin/agenda', '/onboarding', '/entrar', '/dom-rocha/agendar', '/salao-da-bia'])(
    '%s renderiza dado de quem pede e continua renovando a sessão no middleware',
    (caminho) => {
      expect(precisaRenovarSessao(caminho)).toBe(true)
    },
  )
})

describe('temCookieDeSessao (desvio otimista da / sem ida de rede)', () => {
  it('reconhece o cookie de auth do @supabase/ssr, inteiro ou fatiado', () => {
    expect(temCookieDeSessao(reqComCookies(['sb-eqzlvthz-auth-token']))).toBe(true)
    expect(temCookieDeSessao(reqComCookies(['sb-eqzlvthz-auth-token.0', 'sb-eqzlvthz-auth-token.1']))).toBe(true)
  })

  it('não confunde outros cookies do Supabase nem lixo de terceiro', () => {
    expect(temCookieDeSessao(reqComCookies([]))).toBe(false)
    expect(temCookieDeSessao(reqComCookies(['sb-eqzlvthz-auth-token-code-verifier']))).toBe(false)
    expect(temCookieDeSessao(reqComCookies(['_ga', 'sb-provider-token']))).toBe(false)
    // `auth-token` sem o prefixo `sb-<ref>-` não é o cookie de sessão.
    expect(temCookieDeSessao(reqComCookies(['auth-token']))).toBe(false)
  })

  it('não confunde rota que apenas COMEÇA com as letras de /api', () => {
    // Mesma armadilha de prefixo sem barra que `naoCacheavel` já cobre: `/apiario` é uma tela
    // pública qualquer e precisa da renovação como qualquer outra.
    expect(precisaRenovarSessao('/apiario')).toBe(true)
  })

  it('toda rota que sai da renovação continua sendo não-cacheável (S10 não afrouxa)', () => {
    // As duas regras coincidem em `/api/*` hoje. Se alguém mexer numa e esquecer da outra, a
    // resposta de `/vault` volta a poder ser guardada por proxy — este teste é o que impede.
    for (const caminho of ['/api/v1/clients/x/vault', '/api/v1/media/x/url', '/api/health']) {
      expect(precisaRenovarSessao(caminho)).toBe(false)
      expect(naoCacheavel(caminho)).toBe(true)
    }
  })
})
