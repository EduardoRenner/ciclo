'use client'

import { CalendarX2, CheckCircle2, Clock } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

import Button from '@/components/ui/button'
import ErroPublico from '@/components/ui/erro-publico'
import TituloDeEstado from '@/components/ui/titulo-de-estado'
import { diaPorExtensoNoFuso } from '@/core/agenda/resumo-do-horario'
import { horaLocal } from '@/lib/formato'

import type { HorarioParaConfirmar } from '@/server/services/confirmacao-publica'

type Estado = 'escolhendo' | 'confirmando' | 'confirmado' | 'conferindo' | 'desfazivel' | 'cancelando' | 'cancelado' | 'passou' | 'erro'

/** Janela para desfazer o "desmarcar": o pedido só sai para o servidor depois dela (ou se a página fechar antes). */
export const SEGUNDOS_PARA_DESFAZER = 10

function estadoInicial(status: HorarioParaConfirmar['status']): Estado {
  if (status === 'pending') return 'escolhendo'
  if (status === 'confirmed') return 'confirmado'
  if (status === 'canceled') return 'cancelado'
  return 'passou'
}

/**
 * docs/09-PLATAFORMA.md G12 (P5.5): até 2026-08-19 esta tela disparava a confirmação sozinha ao
 * abrir. Virou uma escolha: "Vou sim" ou "Preciso desmarcar". A ação só dispara no toque.
 *
 * APR-117 (I-15, C-21, A-03, F-07): a tela diz QUAL horário antes de qualquer toque (cartão vindo do
 * servidor); desmarcar pede um segundo passo e, depois dele, dá 10 segundos para desfazer — o pedido
 * de cancelar só sai no fim da janela, ou na hora se a página for fechada antes (`pagehide`, por
 * `sendBeacon`). Um toque errado num link do WhatsApp apagava um horário com a profissional já
 * contando com ele; agora precisa de dois toques e ainda volta atrás.
 */
export default function ConfirmarAgendamento({ token, horario }: { token: string; horario: HorarioParaConfirmar }) {
  const [estado, setEstado] = useState<Estado>(() => estadoInicial(horario.status))
  const jaEstavaConfirmado = horario.status === 'confirmed'
  const [mensagem, setMensagem] = useState('')
  const [slugParaReagendar, setSlugParaReagendar] = useState<string | null>(horario.slug)
  const [segundos, setSegundos] = useState(SEGUNDOS_PARA_DESFAZER)
  /**
   * A falha foi da REDE (dá para tentar de novo) ou do SERVIDOR recusando o link (não dá)? Link
   * recusado não tem retentativa que resolva: ali o caminho é falar com quem vai atender.
   */
  const [podeTentarDeNovo, setPodeTentarDeNovo] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const contagem = useRef<ReturnType<typeof setInterval> | null>(null)
  const enviado = useRef(false)

  function falhou(msg: string, transitoria: boolean) {
    setEstado('erro')
    setMensagem(msg)
    setPodeTentarDeNovo(transitoria)
  }

  function confirmar() {
    setEstado('confirmando')
    fetch(`/api/v1/public/appointments/confirm/${token}`, { method: 'POST' })
      .then(async (r) => {
        const json = (await r.json()) as { data?: { status: string }; error?: { message: string } }
        if (!r.ok) {
          // 5xx é problema nosso e passa: tentar de novo daqui a pouco pode funcionar. 4xx é o
          // link recusado, e insistir só repete a recusa.
          falhou(json.error?.message ?? 'Não consegui confirmar esse agendamento.', r.status >= 500)
          return
        }
        setEstado('confirmado')
      })
      .catch(() => falhou('Não consegui falar com o servidor.', true))
  }

  function limparJanela() {
    if (timer.current) clearTimeout(timer.current)
    if (contagem.current) clearInterval(contagem.current)
    timer.current = null
    contagem.current = null
  }

  function cancelarAgora(aoFechar = false) {
    if (enviado.current) return
    enviado.current = true
    limparJanela()
    const url = `/api/v1/public/appointments/cancel/${token}`
    if (aoFechar) {
      // A página está fechando: o pedido tem que sair mesmo assim, senão "desfazer em 10 s" vira um
      // cancelamento que some junto com a aba. Medido no Chrome com a navegação real: `fetch` com
      // `keepalive` dentro de `pagehide` NÃO chegou ao servidor; `sendBeacon` é feito para isto.
      if (!navigator.sendBeacon(url)) void fetch(url, { method: 'POST', keepalive: true }).catch(() => {})
      return
    }
    setEstado('cancelando')
    fetch(url, { method: 'POST' })
      .then(async (r) => {
        const json = (await r.json()) as { data?: { status: string; slug: string | null }; error?: { message: string } }
        if (!r.ok) {
          enviado.current = false
          falhou(json.error?.message ?? 'Não consegui desmarcar esse agendamento.', r.status >= 500)
          return
        }
        setSlugParaReagendar(json.data?.slug ?? horario.slug)
        setEstado('cancelado')
      })
      .catch(() => {
        enviado.current = false
        falhou('Não consegui falar com o servidor.', true)
      })
  }

  function abrirJanelaDeDesfazer() {
    setEstado('desfazivel')
    setSegundos(SEGUNDOS_PARA_DESFAZER)
    contagem.current = setInterval(() => setSegundos((s) => Math.max(0, s - 1)), 1000)
    timer.current = setTimeout(() => cancelarAgora(), SEGUNDOS_PARA_DESFAZER * 1000)
  }

  function desfazer() {
    limparJanela()
    setEstado('escolhendo')
  }

  useEffect(() => {
    if (estado !== 'desfazivel') return
    const aoFechar = () => cancelarAgora(true)
    window.addEventListener('pagehide', aoFechar)
    return () => {
      window.removeEventListener('pagehide', aoFechar)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `cancelarAgora` só muda com o token, que é fixo nesta página
  }, [estado])

  useEffect(() => () => limparJanela(), [])

  const cartao = (
    <div className="mt-4 mb-6 w-full max-w-xs rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 p-4 text-left">
      <p className="text-corpo font-semibold text-txt">
        {horario.serviceName}
        {horario.professionalName ? ` com ${horario.professionalName}` : ''}
      </p>
      <p className="mt-1 text-secundario text-txt-2">
        {diaPorExtensoNoFuso(horario.startsAt, horario.timezone)}, às {horaLocal(horario.startsAt, horario.timezone)}
      </p>
      {horario.businessName ? <p className="mt-0.5 text-secundario text-txt-2">{horario.businessName}</p> : null}
    </div>
  )

  if (estado === 'escolhendo' || estado === 'confirmando') {
    return (
      <>
        <h1 className="text-titulo font-bold">Confirma seu horário?</h1>
        {cartao}
        <div className="flex w-full flex-col gap-2.5">
          <Button largura="cheia" carregando={estado === 'confirmando'} onClick={confirmar}>
            Vou sim
          </Button>
          <Button largura="cheia" variante="secondary" disabled={estado === 'confirmando'} motivoDesabilitado="Aguarde: estamos confirmando seu horário." onClick={() => setEstado('conferindo')}>
            Preciso desmarcar
          </Button>
        </div>
      </>
    )
  }

  if (estado === 'conferindo' || estado === 'cancelando') {
    return (
      <>
        <h1 className="text-titulo font-bold">Desmarcar esse horário?</h1>
        {cartao}
        <div className="flex w-full flex-col gap-2.5">
          <Button largura="cheia" variante="secondary" carregando={estado === 'cancelando'} onClick={abrirJanelaDeDesfazer}>
            Sim, desmarcar
          </Button>
          <Button largura="cheia" disabled={estado === 'cancelando'} motivoDesabilitado="Aguarde: estamos desmarcando seu horário." onClick={() => setEstado('escolhendo')}>
            Não, vou sim
          </Button>
        </div>
      </>
    )
  }

  if (estado === 'desfazivel') {
    return (
      <>
        <Clock aria-hidden className="mb-4 size-14 text-txt-3" />
        <TituloDeEstado>Horário desmarcado</TituloDeEstado>
        {/* O anúncio é um só; a contagem visual muda a cada segundo e não vai para o leitor de tela. */}
        <p className="mt-2 text-corpo text-txt-2" aria-live="polite">
          Se foi sem querer, dá para desfazer nos próximos {SEGUNDOS_PARA_DESFAZER} segundos.
        </p>
        <p aria-hidden className="mt-1 text-secundario tabular text-txt-3">
          {segundos} s
        </p>
        <Button largura="cheia" className="mt-6" onClick={desfazer}>
          Desfazer
        </Button>
      </>
    )
  }

  if (estado === 'confirmado') {
    return (
      <>
        <CheckCircle2 aria-hidden className="mb-4 size-14 text-ok" />
        <TituloDeEstado>{jaEstavaConfirmado ? 'Você já confirmou' : 'Prontinho!'}</TituloDeEstado>
        <p className="mt-2 text-corpo text-txt-2">Seu horário está confirmado. Até lá!</p>
        {cartao}
        {jaEstavaConfirmado ? (
          <Button largura="cheia" variante="secondary" onClick={() => setEstado('conferindo')}>
            Preciso desmarcar
          </Button>
        ) : null}
      </>
    )
  }

  if (estado === 'cancelado') {
    return (
      <>
        <CalendarX2 aria-hidden className="mb-4 size-14 text-txt-3" />
        <TituloDeEstado>Desmarcado</TituloDeEstado>
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

  if (estado === 'passou') {
    return (
      <>
        <CheckCircle2 aria-hidden className="mb-4 size-14 text-txt-3" />
        <TituloDeEstado>Esse horário já passou</TituloDeEstado>
        {cartao}
        {slugParaReagendar ? (
          <Link
            href={`/${slugParaReagendar}/agendar`}
            className="mt-2 inline-flex h-12 items-center justify-center rounded-[var(--radius-sm)] bg-acc px-5 text-corpo font-semibold text-on-acc"
          >
            Marcar outro horário
          </Link>
        ) : null}
      </>
    )
  }

  return (
    <ErroPublico
      titulo="Não deu certo"
      mensagem={mensagem}
      {...(podeTentarDeNovo
        ? {
            aoTentarDeNovo: () => {
              // Volta para a ESCOLHA, e não refaz a ação: entre confirmar e desmarcar, decidir
              // por ela enquanto a rede estava fora seria pior que perguntar de novo.
              setEstado('escolhendo')
              setPodeTentarDeNovo(false)
            },
          }
        : {})}
    />
  )
}
