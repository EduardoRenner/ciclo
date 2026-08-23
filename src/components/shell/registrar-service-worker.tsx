'use client'

import { useEffect } from 'react'

/**
 * TICKET-055 + docs/13-CAUSA-RAIZ-LAYOUT-LEGADO.md (T2).
 *
 * Dois defeitos corrigidos junto:
 *
 * 1. O registro pendurava o listener de `load` **dentro** de `useEffect`, que
 *    roda depois da hidratação — que normalmente já é depois do evento `load`
 *    ter disparado. Resultado medido ao vivo em produção: o service worker
 *    quase nunca registrava (`swRegistrado: false` mesmo com
 *    `document.readyState === 'complete'`). Corrigido registrando na hora se
 *    o documento já carregou, e só pendurando o listener quando ainda não.
 * 2. `?v=<build>` na URL do worker: o navegador trata `/sw.js?v=a` e
 *    `/sw.js?v=b` como scripts diferentes e instala um worker novo mesmo que
 *    o conteúdo textual do arquivo seja idêntico — é isso que faz TODO deploy
 *    disparar o `activate` do worker novo, que por sua vez apaga o cache do
 *    anterior. Sem isso, o navegador só rechecava o arquivo de tempos em
 *    tempos e podia ficar rodando um worker (e um cache) de dias atrás.
 */
export default function RegistrarServiceWorker() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    const registrar = () => {
      const versao = process.env.NEXT_PUBLIC_BUILD_ID ?? 'dev'
      navigator.serviceWorker.register(`/sw.js?v=${versao}`).catch((erro: unknown) => {
        console.error('Falha ao registrar o service worker', erro)
      })
    }

    if (document.readyState === 'complete') {
      registrar()
      return
    }

    window.addEventListener('load', registrar)
    return () => window.removeEventListener('load', registrar)
  }, [])

  return null
}
