import * as Sentry from '@sentry/nextjs'

import { redigirEventoSentry } from '@/lib/observability/redact'

/**
 * TICKET-057. Mesma redação de `src/instrumentation.ts`, para o lado do
 * navegador — é de onde mais vazaria PII sem querer (formulário de cliente,
 * URL com query de busca por nome). `NEXT_PUBLIC_SENTRY_DSN` porque o
 * navegador não lê variável sem esse prefixo.
 */
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_APP_ENV ?? 'local',
  tracesSampleRate: 0.1,
  sendDefaultPii: false,
  beforeSend: (event) => redigirEventoSentry(event),
  beforeSendTransaction: (event) => redigirEventoSentry(event),
})

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
