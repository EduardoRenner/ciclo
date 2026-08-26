'use client'

import NextError from 'next/error'
import { useEffect } from 'react'

/**
 * TICKET-057. Só dispara quando o próprio `layout.tsx` quebra — por isso tem
 * o `<html>/<body>` próprio, sem poder reusar nada do resto do app. `Sentry`
 * pede este arquivo para capturar erro de renderização do React que nenhum
 * `error.tsx` de rota alcança.
 *
 * O `import()` dentro do efeito existe pelo mesmo motivo de
 * `src/instrumentation-client.ts`: com `import` no topo, `@sentry/nextjs` entra
 * no grafo estático e volta para o chunk compartilhado de toda tela — o que
 * anularia a economia de 129 kB pelo caminho de trás. Aqui o SDK só é buscado
 * quando o app inteiro já quebrou, que é o único momento em que este arquivo
 * roda; um round-trip a mais nesse instante não custa nada.
 *
 * Guardado pelo DSN pela mesma razão: sem destino configurado, baixar o SDK
 * para reportar num vazio seria pagar a rede duas vezes por nada.
 */
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return
    void import('@sentry/nextjs').then((Sentry) => Sentry.captureException(error))
  }, [error])

  return (
    <html lang="pt-BR" className="dark">
      <body>
        <NextError statusCode={0} />
      </body>
    </html>
  )
}
