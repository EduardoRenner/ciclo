'use client'

import { CalendarX2, CheckCircle2, XCircle } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

import Button from '@/components/ui/button'

type Estado = 'escolhendo' | 'confirmando' | 'confirmado' | 'cancelando' | 'cancelado' | 'erro'

/**
 * docs/09-PLATAFORMA.md G12 (P5.5): até 2026-08-19 esta tela disparava a
 * confirmação sozinha ao abrir — não dava pra desmarcar por aqui, só ligar
 * ou simplesmente faltar. Virou uma escolha: "Vou sim" ou "Preciso
 * desmarcar". A ação só dispara no toque, nunca ao carregar a página — com
 * duas ações possíveis, disparar uma sozinha deixaria de fazer sentido.
 */
export default function ConfirmarAgendamento({ token }: { token: string }) {
  const [estado, setEstado] = useState<Estado>('escolhendo')
  const [mensagem, setMensagem] = useState('')
  const [slugParaReagendar, setSlugParaReagendar] = useState<string | null>(null)

  function confirmar() {
    setEstado('confirmando')
    fetch(`/api/v1/public/appointments/confirm/${token}`, { method: 'POST' })
      .then(async (r) => {
        const json = (await r.json()) as { data?: { status: string }; error?: { message: string } }
        if (!r.ok) {
          setEstado('erro')
          setMensagem(json.error?.message ?? 'Não consegui confirmar esse agendamento.')
          return
        }
        setEstado('confirmado')
      })
      .catch(() => {
        setEstado('erro')
        setMensagem('Não consegui falar com o servidor. Tente de novo em instantes.')
      })
  }

  function cancelar() {
    setEstado('cancelando')
    fetch(`/api/v1/public/appointments/cancel/${token}`, { method: 'POST' })
      .then(async (r) => {
        const json = (await r.json()) as { data?: { status: string; slug: string | null }; error?: { message: string } }
        if (!r.ok) {
          setEstado('erro')
          setMensagem(json.error?.message ?? 'Não consegui desmarcar esse agendamento.')
          return
        }
        setSlugParaReagendar(json.data?.slug ?? null)
        setEstado('cancelado')
      })
      .catch(() => {
        setEstado('erro')
        setMensagem('Não consegui falar com o servidor. Tente de novo em instantes.')
      })
  }

  if (estado === 'escolhendo' || estado === 'confirmando' || estado === 'cancelando') {
    return (
      <>
        <p className="text-titulo font-bold">Confirma seu horário?</p>
        <p className="mt-2 mb-6 text-corpo text-txt-2">Toque numa opção abaixo.</p>
        <div className="flex w-full flex-col gap-2.5">
          <Button largura="cheia" carregando={estado === 'confirmando'} disabled={estado === 'cancelando'} onClick={confirmar}>
            Vou sim
          </Button>
          <Button
            largura="cheia"
            variante="secondary"
            carregando={estado === 'cancelando'}
            disabled={estado === 'confirmando'}
            onClick={cancelar}
          >
            Preciso desmarcar
          </Button>
        </div>
      </>
    )
  }

  if (estado === 'confirmado') {
    return (
      <>
        <CheckCircle2 aria-hidden className="mb-4 size-14 text-ok" />
        <p className="text-titulo font-bold">Prontinho!</p>
        <p className="mt-2 text-corpo text-txt-2">Seu horário está confirmado. Te esperamos lá.</p>
      </>
    )
  }

  if (estado === 'cancelado') {
    return (
      <>
        <CalendarX2 aria-hidden className="mb-4 size-14 text-txt-3" />
        <p className="text-titulo font-bold">Desmarcado</p>
        <p className="mt-2 text-corpo text-txt-2">Sentimos falta! Quando quiser, é só marcar de novo.</p>
        {slugParaReagendar ? (
          <Link
            href={`/${slugParaReagendar}/agendar`}
            className="mt-6 inline-flex h-12 items-center justify-center rounded-[var(--radius-sm)] bg-acc px-5 text-corpo font-semibold text-on-acc"
          >
            Marcar outro horário
          </Link>
        ) : null}
      </>
    )
  }

  return (
    <>
      <XCircle aria-hidden className="mb-4 size-14 text-bad" />
      <p className="text-titulo font-bold">Não deu certo</p>
      <p className="mt-2 text-corpo text-txt-2">{mensagem}</p>
    </>
  )
}
