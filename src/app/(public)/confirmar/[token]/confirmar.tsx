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
  /**
   * A falha foi da REDE (dá para tentar de novo) ou do SERVIDOR recusando o link (não dá)?
   *
   * A tela de erro tratava as duas igual e não oferecia nada: uma piscada de 4G no meio do toque
   * deixava a cliente do salão num beco com "Não consegui falar com o servidor" e nenhum botão —
   * a única saída era ela saber recarregar a página. Quem paga esse atrito é o salão, que fica
   * com um horário sem confirmação achando que a pessoa ignorou a mensagem.
   *
   * Link recusado é outra coisa e não tem retentativa que resolva: ali o caminho é falar com quem
   * vai atender, e a tela passa a dizer isso em vez de só mostrar a mensagem da rota.
   */
  const [podeTentarDeNovo, setPodeTentarDeNovo] = useState(false)

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

  function cancelar() {
    setEstado('cancelando')
    fetch(`/api/v1/public/appointments/cancel/${token}`, { method: 'POST' })
      .then(async (r) => {
        const json = (await r.json()) as { data?: { status: string; slug: string | null }; error?: { message: string } }
        if (!r.ok) {
          falhou(json.error?.message ?? 'Não consegui desmarcar esse agendamento.', r.status >= 500)
          return
        }
        setSlugParaReagendar(json.data?.slug ?? null)
        setEstado('cancelado')
      })
      .catch(() => falhou('Não consegui falar com o servidor.', true))
  }

  if (estado === 'escolhendo' || estado === 'confirmando' || estado === 'cancelando') {
    return (
      <>
        <p className="text-titulo font-bold">Confirma seu horário?</p>
        <p className="mt-2 mb-6 text-corpo text-txt-2">Toque numa opção abaixo.</p>
        <div className="flex w-full flex-col gap-2.5">
          {/*
            Cada botão trava enquanto o OUTRO está em curso — o spinner que explicaria a espera
            está no botão vizinho, não neste. No leitor de tela saía "Vou sim, indisponível" sem
            motivo nenhum. Auditoria de 2026-08-28, mesma classe do A6/A15.
          */}
          <Button
            largura="cheia"
            carregando={estado === 'confirmando'}
            disabled={estado === 'cancelando'}
            motivoDesabilitado="Aguarde: estamos desmarcando seu horário."
            onClick={confirmar}
          >
            Vou sim
          </Button>
          <Button
            largura="cheia"
            variante="secondary"
            carregando={estado === 'cancelando'}
            disabled={estado === 'confirmando'}
            motivoDesabilitado="Aguarde: estamos confirmando seu horário."
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
      {/*
        A tela terminava aqui, e terminar aqui é um beco. A regra do CLAUDE.md ("erro explica o que
        fazer") não estava sendo cumprida: a mensagem diz o que houve, e não o que fazer agora.

        Quem chega neste estado é a CLIENTE DO SALÃO, com a mensagem do WhatsApp aberta e um horário
        marcado esperando resposta. Sem saída daqui ela some, o horário fica sem confirmação, e o
        salão conclui que ela ignorou.
      */}
      {podeTentarDeNovo ? (
        <Button
          largura="cheia"
          className="mt-6"
          onClick={() => {
            setEstado('escolhendo')
            setPodeTentarDeNovo(false)
          }}
        >
          Tentar de novo
        </Button>
      ) : (
        <p className="mt-4 text-secundario text-txt-3">
          Chame quem vai te atender pelo WhatsApp para confirmar ou desmarcar seu horário.
        </p>
      )}
    </>
  )
}
