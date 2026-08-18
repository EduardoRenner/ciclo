'use client'

import * as Sentry from '@sentry/nextjs'
import NextError from 'next/error'
import { useEffect } from 'react'

/**
 * TICKET-057. Só dispara quando o próprio `layout.tsx` quebra — por isso tem
 * o `<html>/<body>` próprio, sem poder reusar nada do resto do app. `Sentry`
 * pede este arquivo para capturar erro de renderização do React que nenhum
 * `error.tsx` de rota alcança.
 */
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="pt-BR" className="dark">
      <body>
        <NextError statusCode={0} />
      </body>
    </html>
  )
}
