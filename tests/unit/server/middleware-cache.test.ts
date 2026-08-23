import { describe, expect, it } from 'vitest'

import { exigeSessao, naoCacheavel } from '@/middleware'

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
