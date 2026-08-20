'use client'

import { Repeat } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

import Badge from '@/components/ui/badge'
import Button from '@/components/ui/button'
import Card from '@/components/ui/card'
import EmptyState from '@/components/ui/empty-state'
import { useToast } from '@/components/ui/toast'

import type { SerieDaLista } from '@/server/services/recorrencia'

function LinhaSerie({ serie, aoCancelar }: { serie: SerieDaLista; aoCancelar: (id: string) => Promise<void> }) {
  const [confirmando, setConfirmando] = useState(false)
  const [pendente, setPendente] = useState(false)
  const ativa = serie.status === 'active'

  async function cancelar() {
    setPendente(true)
    try {
      await aoCancelar(serie.id)
      setConfirmando(false)
    } finally {
      setPendente(false)
    }
  }

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-corpo font-semibold">{serie.clientName}</p>
          <p className="mt-0.5 text-secundario text-txt-2">
            {serie.serviceName} · {serie.professionalName}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge estado={ativa ? 'ok' : 'info'}>{ativa ? 'Ativa' : 'Cancelada'}</Badge>
            <span className="tabular text-secundario text-txt-3">{serie.descricao}</span>
          </div>
        </div>
      </div>

      <p className="tabular text-secundario text-txt-3">
        {serie.ocorrenciasGeradas} {serie.ocorrenciasGeradas === 1 ? 'ocorrência gerada' : 'ocorrências geradas'}
        {serie.maxOcorrencias ? ` de ${serie.maxOcorrencias}` : ''}
      </p>

      {ativa ? (
        confirmando ? (
          <div className="flex flex-col gap-2">
            <p className="text-secundario text-txt-2">Cancela a série e as ocorrências futuras ainda não atendidas.</p>
            <div className="flex gap-2">
              <Button variante="danger" tamanho="sm" carregando={pendente} onClick={cancelar}>
                Sim, cancelar
              </Button>
              <Button variante="secondary" tamanho="sm" disabled={pendente} onClick={() => setConfirmando(false)}>
                Voltar
              </Button>
            </div>
          </div>
        ) : (
          <Button variante="secondary" tamanho="sm" largura="auto" onClick={() => setConfirmando(true)} className="self-start">
            Cancelar série
          </Button>
        )
      ) : null}
    </Card>
  )
}

export default function ListaSeries({ iniciais }: { iniciais: SerieDaLista[] }) {
  const [series, setSeries] = useState(iniciais)
  const mostrarToast = useToast()

  async function cancelar(id: string) {
    const r = await fetch(`/api/v1/appointments/series/${id}/cancel`, {
      method: 'POST',
      headers: { 'idempotency-key': crypto.randomUUID() },
    })
    const json = (await r.json()) as { data?: { ocorrenciasCanceladas: number }; error?: { message: string } }
    if (!r.ok) {
      mostrarToast({ tom: 'erro', titulo: 'Não consegui cancelar', descricao: json.error?.message })
      return
    }
    setSeries((atual) => atual.map((s) => (s.id === id ? { ...s, status: 'canceled' } : s)))
    mostrarToast({
      tom: 'ok',
      titulo: 'Série cancelada',
      descricao: json.data?.ocorrenciasCanceladas ? `${json.data.ocorrenciasCanceladas} ocorrência(s) futura(s) cancelada(s) junto.` : undefined,
    })
  }

  if (series.length === 0) {
    return (
      <EmptyState
        icone={<Repeat aria-hidden className="size-6" />}
        titulo="Nenhuma série ainda"
        descricao='Ative "Repetir este horário" ao marcar um agendamento pra criar uma série.'
        acao={<Link href="/admin/agenda/novo">Novo agendamento</Link>}
      />
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {series.map((s) => (
        <LinhaSerie key={s.id} serie={s} aoCancelar={cancelar} />
      ))}
    </div>
  )
}
