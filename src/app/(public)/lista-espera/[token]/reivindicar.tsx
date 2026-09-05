'use client'

import { CheckCircle2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

import ErroPublico from '@/components/ui/erro-publico'

type Estado = 'reivindicando' | 'reivindicado' | 'erro'

export default function ReivindicarEncaixe({ token }: { token: string }) {
  const [estado, setEstado] = useState<Estado>('reivindicando')
  const [mensagem, setMensagem] = useState('')
  /**
   * A reivindicação dispara ao ABRIR a página. Uma piscada de rede na hora em que a cliente toca
   * no link do WhatsApp derrubava a tela num erro sem saída — e o encaixe, que é por ordem de
   * chegada, ia para outra pessoa enquanto ela olhava para "não consegui falar com o servidor".
   */
  const [podeTentarDeNovo, setPodeTentarDeNovo] = useState(false)
  const [tentativa, setTentativa] = useState(0)

  useEffect(() => {
    let cancelado = false

    fetch(`/api/v1/public/waitlist/claim/${token}`, { method: 'POST' })
      .then(async (r) => {
        const json = (await r.json()) as { error?: { message: string } }
        if (cancelado) return
        if (!r.ok) {
          setEstado('erro')
          setMensagem(json.error?.message ?? 'Esse encaixe não está mais disponível.')
          setPodeTentarDeNovo(r.status >= 500)
          return
        }
        setEstado('reivindicado')
      })
      .catch(() => {
        if (!cancelado) {
          setEstado('erro')
          setMensagem('Não consegui falar com o servidor.')
          setPodeTentarDeNovo(true)
        }
      })

    return () => {
      cancelado = true
    }
  }, [token, tentativa])

  const tentarDeNovo = useCallback(() => {
    setEstado('reivindicando')
    setPodeTentarDeNovo(false)
    setTentativa((n) => n + 1)
  }, [])

  if (estado === 'reivindicando') {
    return <p className="text-corpo text-txt-2">Confirmando o horário…</p>
  }

  if (estado === 'reivindicado') {
    return (
      <>
        <CheckCircle2 aria-hidden className="mb-4 size-14 text-ok" />
        <h1 className="text-titulo font-bold">Encaixe garantido!</h1>
        <p className="mt-2 text-corpo text-txt-2">Seu horário está reservado. Te esperamos lá.</p>
      </>
    )
  }

  return (
    <ErroPublico
      titulo="Não consegui reservar"
      mensagem={mensagem}
      {...(podeTentarDeNovo ? { aoTentarDeNovo: tentarDeNovo } : {})}
    />
  )
}
