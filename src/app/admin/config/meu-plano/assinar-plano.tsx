'use client'

import { ArrowRight } from 'lucide-react'
import { useState } from 'react'

import type { PlanoTier } from '@/core/billing/planos'

import { NOME_DO_PLANO } from '@/core/billing/planos'

/**
 * O botão "Assinar {plano}" — só aparece quando `MERCADOPAGO_ACCESS_TOKEN` está configurado
 * (`docs/57` PR 1.3). Sem isso, a tela mantém o link de WhatsApp ("Quero o {plano}"), pela regra
 * 5.4 do `docs/18`: não fingir que a cobrança automática existe.
 *
 * `fetch` direto (não `apiFetch`): precisamos do `initPoint` da resposta para redirecionar, e
 * checkout não é operação que faça sentido enfileirar offline. `try/catch` com estado local, NUNCA
 * `useTransition` com `await` solto — a Action que rejeita derruba a tela inteira no React 19
 * (armadilha do CLAUDE.md).
 */
export default function AssinarPlano({ tier }: { tier: PlanoTier }) {
  const [pendente, setPendente] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function assinar() {
    setPendente(true)
    setErro(null)
    try {
      const resposta = await fetch('/api/v1/billing/assinar', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID() },
        body: JSON.stringify({ tier }),
      })
      const corpo = (await resposta.json().catch(() => null)) as { data?: { initPoint?: string }; error?: { message?: string } } | null
      if (!resposta.ok || !corpo?.data?.initPoint) {
        setErro(corpo?.error?.message ?? 'Não deu para abrir o pagamento. Tente de novo em instantes.')
        return
      }
      window.location.href = corpo.data.initPoint
    } catch {
      setErro('Sem conexão agora. Tente de novo quando a internet voltar.')
    } finally {
      setPendente(false)
    }
  }

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={assinar}
        disabled={pendente}
        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-[var(--radius-sm)] bg-acc px-5 text-corpo font-semibold text-on-acc shadow-elevado transition duration-[var(--dur-1)] hover:brightness-110 active:scale-[.97] disabled:opacity-60"
      >
        {pendente ? 'Abrindo…' : `Assinar o ${NOME_DO_PLANO[tier]}`}
        {!pendente && <ArrowRight aria-hidden className="size-4" />}
      </button>
      {erro ? (
        <p role="alert" className="mt-2 text-secundario text-warn">
          {erro}
        </p>
      ) : null}
    </div>
  )
}
