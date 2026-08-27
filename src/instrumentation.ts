import { redigirEventoSentry } from '@/lib/observability/redact'

import type { Instrumentation } from 'next'

/**
 * TICKET-057, revisto em 2026-08-27 pela lentidão (`docs/28-LATENCIA-DE-CLIQUE-PLANO.md` §6).
 *
 * ## Por que o SDK entra por `import()` e não por `import` no topo
 *
 * É a mesma correção que `instrumentation-client.ts` já tinha recebido em 26/08, aplicada ao
 * lado que ficou de fora — o servidor, que é justamente onde ela custa mais caro.
 *
 * Medido em 27/08: `require('@sentry/nextjs')` sozinho leva **~500 ms** numa máquina quente com
 * SSD. Isso era pago em **todo cold start de toda função**, e as funções deste projeto rodam com
 * tráfego baixo — quase toda visita é um cold start. O chunk compartilhado que toda rota de
 * `/api/v1` carrega tinha 1,58 MB dominados por `@sentry` + `@opentelemetry` (88 e 84 ocorrências
 * do nome; `meriyah`, o parser de JS do `import-in-the-middle`, entrava junto com 320 kB).
 *
 * E não havia nada do outro lado da balança: **não existe `SENTRY_DSN` em produção** (conferido
 * com `vercel env ls production` em 27/08). O SDK inicializava com `dsn: undefined`, instalava a
 * auto-instrumentação de OpenTelemetry em cima de todo `http` de saída — inclusive de toda
 * chamada ao Supabase — e não mandava um evento sequer.
 *
 * Com `SENTRY_DSN` presente, o comportamento volta a ser exatamente o de antes; sem DSN, o
 * `import()` nunca resolve e o empacotador não tem por que arrastar o SDK.
 *
 * `beforeSend`/`beforeSendTransaction` continuam chamando `redigirEventoSentry` sempre — é a
 * regra 9 do CLAUDE.md ("dado de saúde nunca em log, Sentry ou analytics") virando código.
 */
const dsn = process.env.SENTRY_DSN

const sentry =
  dsn && (process.env.NEXT_RUNTIME === 'nodejs' || process.env.NEXT_RUNTIME === 'edge')
    ? import('@sentry/nextjs').then((Sentry) => {
        Sentry.init({
          dsn,
          environment: process.env.NEXT_PUBLIC_APP_ENV ?? 'local',
          tracesSampleRate: 0.1,
          sendDefaultPii: false,
          beforeSend: (event) => redigirEventoSentry(event),
          beforeSendTransaction: (event) => redigirEventoSentry(event),
        })
        return Sentry
      })
    : null

export async function register(): Promise<void> {
  await sentry
}

/**
 * O Next lê este export do módulo para descobrir o gancho, então ele precisa existir de forma
 * síncrona — mesmo motivo do `onRouterTransitionStart` do lado do navegador. Sem DSN vira um
 * no-op, que é o que `Sentry.init({ dsn: undefined })` já era na prática.
 */
export const onRequestError: Instrumentation.onRequestError = async (erro, requisicao, contexto) => {
  const Sentry = await sentry
  Sentry?.captureRequestError(erro, requisicao, contexto)
}
