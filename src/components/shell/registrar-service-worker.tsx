'use client'

import { useEffect } from 'react'

/** TICKET-055. Registra o service worker do app shell — só depois do load, para não competir com o primeiro paint. */
export default function RegistrarServiceWorker() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch((erro: unknown) => {
        console.error('Falha ao registrar o service worker', erro)
      })
    })
  }, [])

  return null
}
