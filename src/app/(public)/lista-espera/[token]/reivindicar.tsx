'use client'

import { CheckCircle2, XCircle } from 'lucide-react'
import { useEffect, useState } from 'react'

type Estado = 'reivindicando' | 'reivindicado' | 'erro'

export default function ReivindicarEncaixe({ token }: { token: string }) {
  const [estado, setEstado] = useState<Estado>('reivindicando')
  const [mensagem, setMensagem] = useState('')

  useEffect(() => {
    let cancelado = false

    fetch(`/api/v1/public/waitlist/claim/${token}`, { method: 'POST' })
      .then(async (r) => {
        const json = (await r.json()) as { error?: { message: string } }
        if (cancelado) return
        if (!r.ok) {
          setEstado('erro')
          setMensagem(json.error?.message ?? 'Esse encaixe não está mais disponível.')
          return
        }
        setEstado('reivindicado')
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

  if (estado === 'reivindicando') {
    return <p className="text-corpo text-txt-2">Confirmando o horário…</p>
  }

  if (estado === 'reivindicado') {
    return (
      <>
        <CheckCircle2 aria-hidden className="mb-4 size-14 text-ok" />
        <p className="text-titulo font-bold">Encaixe garantido!</p>
        <p className="mt-2 text-corpo text-txt-2">Seu horário está reservado. Te esperamos lá.</p>
      </>
    )
  }

  return (
    <>
      <XCircle aria-hidden className="mb-4 size-14 text-bad" />
      <p className="text-titulo font-bold">Não consegui reservar</p>
      <p className="mt-2 text-corpo text-txt-2">{mensagem}</p>
    </>
  )
}
