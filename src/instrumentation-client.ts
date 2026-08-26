import { redigirEventoSentry } from '@/lib/observability/redact'

/**
 * TICKET-057. Mesma redação de `src/instrumentation.ts`, para o lado do
 * navegador — é de onde mais vazaria PII sem querer (formulário de cliente,
 * URL com query de busca por nome). `NEXT_PUBLIC_SENTRY_DSN` porque o
 * navegador não lê variável sem esse prefixo.
 *
 * ## Por que o SDK entra por `import()` e não por `import` no topo
 *
 * Medido em 2026-08-25 (`docs/21` §5.1) e confirmado ainda em 26/08 varrendo os
 * 13 chunks de produção: **não existe DSN no bundle publicado**. O SDK inicializa
 * com `dsn: undefined`, não envia nada — e mesmo assim viajava no chunk
 * compartilhado de **toda** tela: 129 kB dos 188 kB de First Load JS. Metade do
 * que a página baixa era observabilidade que não observava, num produto
 * mobile-first para quem atende de celular em 4G ruim.
 *
 * `NEXT_PUBLIC_*` é inlinado em tempo de build, então `dsn` aqui é uma constante
 * literal depois do bundling: sem DSN, o `import()` vira código morto e o
 * empacotador descarta o SDK inteiro; com DSN, o comportamento é o de antes,
 * só que o SDK chega num chunk próprio, fora do caminho crítico.
 *
 * **Já houve uma tentativa que não funcionou, e ela está registrada para não se
 * repetir:** `bundleSizeOptimizations` no `withSentryConfig` rendeu 208 bytes
 * (0,0%) e foi revertida — o Sentry v10 já removia aquilo sozinho. A diferença
 * aqui é que o problema nunca foi *o que* o SDK carrega dentro, e sim ele estar
 * no grafo estático de todas as telas.
 *
 * O custo aceito: erro disparado nos primeiros milissegundos, antes de o
 * `import()` resolver, não é capturado. Com o DSN ausente — que é o estado de
 * hoje — não se perde nada, porque nada era capturado de qualquer forma.
 */
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN

const sentry = dsn
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

/**
 * O Next exige este export de forma SÍNCRONA — ele lê o módulo para descobrir o
 * gancho, e não pode esperar uma promessa. Por isso a função existe sempre e
 * encaminha para o SDK só quando ele foi carregado; sem DSN é um no-op, que é
 * exatamente o que `Sentry.init({ dsn: undefined })` já era na prática.
 */
export function onRouterTransitionStart(href: string, navigationType: string): void {
  void sentry?.then((Sentry) => Sentry.captureRouterTransitionStart(href, navigationType))
}
