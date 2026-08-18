import * as Sentry from '@sentry/nextjs'

import { redigirEventoSentry } from '@/lib/observability/redact'

/**
 * TICKET-057. Um `register()` só para servidor e edge (em vez de
 * `sentry.server.config.ts`/`sentry.edge.config.ts` separados) — o próprio
 * Next chama isto uma vez por runtime e `NEXT_RUNTIME` já diz qual é.
 *
 * `beforeSend`/`beforeSendTransaction` chamam `redigirEventoSentry` sempre —
 * é a regra 9 do CLAUDE.md ("dado de saúde nunca em log, Sentry ou
 * analytics") virando código, não promessa. Sem `SENTRY_DSN`, o SDK só não
 * manda nada; não é erro, é o mesmo padrão de credencial ausente do
 * WhatsApp/Asaas.
 */
export async function register() {
  const dsn = process.env.SENTRY_DSN

  if (process.env.NEXT_RUNTIME === 'nodejs' || process.env.NEXT_RUNTIME === 'edge') {
    Sentry.init({
      dsn,
      environment: process.env.NEXT_PUBLIC_APP_ENV ?? 'local',
      tracesSampleRate: 0.1,
      sendDefaultPii: false,
      beforeSend: (event) => redigirEventoSentry(event),
      beforeSendTransaction: (event) => redigirEventoSentry(event),
    })
  }
}

export const onRequestError = Sentry.captureRequestError
