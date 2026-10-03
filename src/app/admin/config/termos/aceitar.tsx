'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import Button from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'

/**
 * O botão "Li e aceito" (docs/86 J8). `fetch` com `try/catch` e estado local, NUNCA `useTransition` com
 * `await` solto: a Action que rejeita derruba a tela inteira no React 19 (armadilha do CLAUDE.md), e a
 * pessoa perderia a página de leitura no meio de uma piscada de rede.
 */
export default function AceitarVersaoNova() {
  const router = useRouter()
  const mostrarToast = useToast()
  const [pendente, setPendente] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function aceitar() {
    setPendente(true)
    setErro(null)
    try {
      const r = await fetch('/api/v1/legal/accept', { method: 'POST', headers: { 'idempotency-key': crypto.randomUUID() } })
      if (!r.ok) {
        const json = (await r.json().catch(() => null)) as { error?: { message?: string } } | null
        setErro(json?.error?.message ?? 'Não deu para registrar o aceite agora. Tente de novo em instantes.')
        return
      }
      mostrarToast({ tom: 'ok', titulo: 'Aceite registrado', descricao: 'Você pode rever os textos quando quiser.' })
      router.refresh()
    } catch {
      setErro('Sem conexão agora. Nada foi registrado; tente de novo quando a internet voltar.')
    } finally {
      setPendente(false)
    }
  }

  return (
    <div className="mt-4">
      <Button largura="cheia" onClick={aceitar} carregando={pendente}>
        Li e aceito
      </Button>
      {erro ? (
        <p role="alert" className="mt-2 text-secundario text-bad">
          {erro}
        </p>
      ) : null}
    </div>
  )
}
