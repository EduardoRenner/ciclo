'use client'

import { CheckCircle2, XCircle } from 'lucide-react'
import { useEffect, useState } from 'react'

type Estado = 'confirmando' | 'confirmado' | 'erro'

export default function ConfirmarAgendamento({ token }: { token: string }) {
  const [estado, setEstado] = useState<Estado>('confirmando')
  const [mensagem, setMensagem] = useState('')

  useEffect(() => {
    let cancelado = false

    fetch(`/api/v1/public/appointments/confirm/${token}`, { method: 'POST' })
      .then(async (r) => {
        const json = (await r.json()) as { data?: { status: string }; error?: { message: string } }
        if (cancelado) return
        if (!r.ok) {
          setEstado('erro')
          setMensagem(json.error?.message ?? 'Não consegui confirmar esse agendamento.')
          return
        }
        setEstado('confirmado')
      })
      .catch(() => {
        if (!cancelado) {
          setEstado('erro')
          setMensagem('Não consegui falar com o servidor. Tente de novo em instantes.')
        }
      })

    return () => {
      cancelado = true
    }
  }, [token])

  if (estado === 'confirmando') {
    return <p className="text-corpo text-txt-2">Confirmando seu horário…</p>
  }

  if (estado === 'confirmado') {
    return (
      <>
        <CheckCircle2 aria-hidden className="mb-4 size-14 text-ok" />
        <p className="text-titulo font-extrabold">Prontinho!</p>
        <p className="mt-2 text-corpo text-txt-2">Seu horário está confirmado. Te esperamos lá.</p>
      </>
    )
  }

  return (
    <>
      <XCircle aria-hidden className="mb-4 size-14 text-bad" />
      <p className="text-titulo font-extrabold">Não consegui confirmar</p>
      <p className="mt-2 text-corpo text-txt-2">{mensagem}</p>
    </>
  )
}
