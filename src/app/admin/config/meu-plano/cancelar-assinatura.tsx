'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

/**
 * "Cancelar assinatura" — um clique, sem modal de confirmação: `docs/18` Fase K manda paridade
 * literal de cliques com "Assinar" (`assinar-plano.tsx`), não um passo extra de cautela. O
 * `router.refresh()` no sucesso reidrata a tela do servidor — ela decide sozinha se mostra o link
 * de WhatsApp de novo (sem assinatura ativa) ou o aviso de graça (se a cancelação bateu num evento
 * de webhook concorrente, embora `cancelarAssinatura` já grave `gratis` na hora, sem esperar).
 */
export default function CancelarAssinatura() {
  const router = useRouter()
  const [pendente, setPendente] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function cancelar() {
    setPendente(true)
    setErro(null)
    try {
      const resposta = await fetch('/api/v1/billing/cancelar', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID() },
      })
      const corpo = (await resposta.json().catch(() => null)) as { error?: { message?: string } } | null
      if (!resposta.ok) {
        setErro(corpo?.error?.message ?? 'Não deu para cancelar agora. Tente de novo em instantes.')
        return
      }
      router.refresh()
    } catch {
      setErro('Sem conexão agora. Tente de novo quando a internet voltar.')
    } finally {
      setPendente(false)
    }
  }

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={cancelar}
        disabled={pendente}
        className="toque-48 -mx-2 px-2 text-label font-semibold text-txt-3 underline underline-offset-2 disabled:opacity-60"
      >
        {pendente ? 'Cancelando…' : 'Cancelar assinatura'}
      </button>
      {erro ? (
        <p role="alert" className="mt-2 text-secundario text-warn">
          {erro}
        </p>
      ) : null}
    </div>
  )
}
