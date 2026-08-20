'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import Button from '@/components/ui/button'
import Input from '@/components/ui/input'

export default function FormularioVerificar({ factorId, proximo }: { factorId: string; proximo: string | null }) {
  const router = useRouter()
  const [codigo, setCodigo] = useState('')
  const [pendente, setPendente] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    setPendente(true)
    setErro(null)
    try {
      const resposta = await fetch('/api/v1/auth/mfa/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID() },
        body: JSON.stringify({ factorId, code: codigo }),
      })
      const json = (await resposta.json()) as { error?: { message: string; details?: { fields?: Record<string, string> } } }
      if (!resposta.ok) {
        const primeiroCampo = json.error?.details?.fields ? Object.values(json.error.details.fields)[0] : undefined
        setErro(primeiroCampo ?? json.error?.message ?? 'Não consegui confirmar o código.')
        return
      }

      router.push(proximo ?? '/admin/hoje')
      router.refresh()
    } catch {
      setErro('Não consegui falar com o servidor. Tente de novo.')
    } finally {
      setPendente(false)
    }
  }

  return (
    <form onSubmit={enviar} className="flex w-full max-w-sm flex-col gap-3">
      <Input
        rotulo="Código de 6 dígitos"
        value={codigo}
        onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))}
        inputMode="numeric"
        autoComplete="one-time-code"
        autoFocus
        required
        classNameCampo="tabular text-center text-titulo tracking-[0.3em]"
      />
      {erro ? (
        <p role="alert" className="text-secundario text-bad">
          {erro}
        </p>
      ) : null}
      <Button type="submit" largura="cheia" carregando={pendente} disabled={codigo.length !== 6}>
        Confirmar
      </Button>
    </form>
  )
}
