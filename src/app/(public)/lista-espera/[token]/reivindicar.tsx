'use client'

import { CheckCircle2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

import ErroPublico from '@/components/ui/erro-publico'
import TituloDeEstado from '@/components/ui/titulo-de-estado'
import { diaPorExtensoNoFuso } from '@/core/agenda/resumo-do-horario'
import { horaLocal } from '@/lib/formato'

type Estado = 'reivindicando' | 'reivindicado' | 'erro'

export default function ReivindicarEncaixe({ token }: { token: string }) {
  const [estado, setEstado] = useState<Estado>('reivindicando')
  const [mensagem, setMensagem] = useState('')
  // APR-119 (F-18): o horário garantido (para dizer QUAL, sobretudo quando a pessoa reabre o link) e a saída do erro.
  const [garantido, setGarantido] = useState<{ quando: string; jaGarantido: boolean } | null>(null)
  const [saida, setSaida] = useState<{ href: string; rotulo: string } | null>(null)
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
        const json = (await r.json()) as {
          data?: { appointment: { starts_at: string }; jaGarantido: boolean; timezone: string }
          error?: { message: string; details?: { slug?: string; negocio?: string } }
        }
        if (cancelado) return
        if (!r.ok) {
          setEstado('erro')
          setMensagem(json.error?.message ?? 'Esse encaixe não está mais disponível.')
          setPodeTentarDeNovo(r.status >= 500)
          const slug = json.error?.details?.slug
          setSaida(slug ? { href: `/${slug}`, rotulo: `Ver a página de ${json.error?.details?.negocio ?? 'quem atende'}` } : null)
          return
        }
        if (json.data) {
          const { appointment, jaGarantido, timezone } = json.data
          setGarantido({ quando: `${diaPorExtensoNoFuso(appointment.starts_at, timezone)}, às ${horaLocal(appointment.starts_at, timezone)}`, jaGarantido })
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
        <TituloDeEstado>{garantido?.jaGarantido ? 'Você já garantiu' : 'Encaixe garantido!'}</TituloDeEstado>
        <p className="mt-2 text-corpo text-txt-2">
          {garantido ? `Seu horário: ${garantido.quando}. ` : 'Seu horário está reservado. '}Até lá!
        </p>
      </>
    )
  }

  return (
    <ErroPublico
      titulo="Não consegui reservar"
      mensagem={mensagem}
      {...(podeTentarDeNovo ? { aoTentarDeNovo: tentarDeNovo } : {})}
      {...(saida ? { saida } : {})}
    />
  )
}
