'use client'

import Link from 'next/link'

import { useState, useTransition } from 'react'

import Button from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'

import { proximosEstados, type EstadoAgendamento } from '@/core/scheduling/state'

import type { LinhaAgendaDia } from '@/server/services/agendamentos'

const dinheiro = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

const ROTULO_ACAO: Partial<Record<EstadoAgendamento, string>> = {
  confirmed: 'Confirmar',
  arrived: 'Chegou',
  done: 'Concluir',
  no_show: 'Marcar falta',
}

const ROTA_ACAO: Partial<Record<EstadoAgendamento, string>> = {
  confirmed: 'confirm',
  arrived: 'arrive',
  done: 'complete',
  no_show: 'no-show',
}

async function post(url: string) {
  const r = await fetch(url, { method: 'POST', headers: { 'idempotency-key': crypto.randomUUID() } })
  const json = (await r.json()) as { data?: unknown; error?: { message: string } }
  if (!r.ok) throw new Error(json.error?.message ?? 'Não consegui completar a ação.')
  return json.data
}

function paraInputLocal(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/**
 * TICKET-023/024: as duas telas viraram uma só — os botões de estado nascem
 * direto de `proximosEstados()`, o mesmo módulo que valida no servidor. Uma
 * transição que o servidor recusaria nunca aparece como botão: não tem como
 * a tela e a regra de negócio discordarem.
 */
export default function DetalheAgendamento({
  agendamento,
  onFechar,
  onAtualizado,
}: {
  agendamento: LinhaAgendaDia
  onFechar: () => void
  onAtualizado: () => void
}) {
  const [pendente, iniciarTransicao] = useTransition()
  const [mostrarCancelar, setMostrarCancelar] = useState(false)
  const [mostrarRemarcar, setMostrarRemarcar] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [novoHorario, setNovoHorario] = useState(() => paraInputLocal(agendamento.starts_at))
  const [erro, setErro] = useState<string | null>(null)
  const mostrarToast = useToast()

  const estadoAtual = agendamento.status as EstadoAgendamento
  const acoesDeEstado = proximosEstados(estadoAtual).filter((e) => e in ROTULO_ACAO)
  const podeCancelar = proximosEstados(estadoAtual).includes('canceled')
  // Remarcar não é uma transição de status — cabe enquanto ainda não chegou.
  const podeRemarcar = estadoAtual === 'pending' || estadoAtual === 'confirmed'

  function executar(novoEstado: EstadoAgendamento) {
    setErro(null)
    iniciarTransicao(async () => {
      try {
        await post(`/api/v1/appointments/${agendamento.id}/${ROTA_ACAO[novoEstado]}`)
        mostrarToast({ tom: 'ok', titulo: 'Prontinho' })
        onAtualizado()
      } catch (e) {
        setErro((e as Error).message)
      }
    })
  }

  function confirmarCancelamento() {
    setErro(null)
    iniciarTransicao(async () => {
      const r = await fetch(`/api/v1/appointments/${agendamento.id}`, {
        method: 'DELETE',
        headers: { 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID() },
        body: JSON.stringify({ canceledBy: 'professional', reason: motivo || undefined }),
      })
      const json = (await r.json()) as { error?: { message: string } }
      if (!r.ok) {
        setErro(json.error?.message ?? 'Não consegui cancelar.')
        return
      }
      mostrarToast({ tom: 'ok', titulo: 'Agendamento cancelado' })
      onAtualizado()
    })
  }

  function confirmarRemarcacao() {
    setErro(null)
    iniciarTransicao(async () => {
      const r = await fetch(`/api/v1/appointments/${agendamento.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID() },
        body: JSON.stringify({ startsAt: new Date(novoHorario).toISOString() }),
      })
      const json = (await r.json()) as { error?: { code: string; message: string } }
      if (!r.ok) {
        // SLOT_TAKEN é o caso mais comum aqui — a mensagem do servidor já
        // explica; não precisa de tratamento especial além de mostrar.
        setErro(json.error?.message ?? 'Não consegui remarcar.')
        return
      }
      mostrarToast({ tom: 'ok', titulo: 'Agendamento remarcado' })
      onAtualizado()
    })
  }

  return (
    <div aria-busy={pendente} className="flex flex-col gap-4">
      <div>
        <p className="text-corpo font-semibold">{new Date(agendamento.starts_at).toLocaleString('pt-BR')}</p>
        <p className="mt-0.5 text-secundario text-txt-2">{dinheiro.format(agendamento.price_cents / 100)}</p>
      </div>

      {erro ? (
        <p role="alert" className="text-secundario text-bad">
          {erro}
        </p>
      ) : null}

      {!mostrarCancelar && !mostrarRemarcar ? (
        <div className="flex flex-col gap-2">
          {acoesDeEstado.map((estado) => (
            <Button key={estado} largura="cheia" carregando={pendente} onClick={() => executar(estado)}>
              {ROTULO_ACAO[estado]}
            </Button>
          ))}
          {podeRemarcar ? (
            <Button variante="secondary" largura="cheia" disabled={pendente} onClick={() => setMostrarRemarcar(true)}>
              Remarcar
            </Button>
          ) : null}
          {podeCancelar ? (
            <Button variante="danger" largura="cheia" disabled={pendente} onClick={() => setMostrarCancelar(true)}>
              Cancelar
            </Button>
          ) : null}
          {estadoAtual === 'done' ? (
            <Link
              href={`/comanda/agendamento/${agendamento.id}`}
              className="flex h-12 w-full items-center justify-center rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 text-corpo font-semibold text-txt"
            >
              Ver comanda
            </Link>
          ) : null}
          {acoesDeEstado.length === 0 && !podeRemarcar && !podeCancelar ? (
            <p className="text-secundario text-txt-2">Esse agendamento não tem mais ação disponível.</p>
          ) : null}
        </div>
      ) : null}

      {mostrarRemarcar ? (
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-label font-semibold text-txt-2">Novo horário</span>
            <input
              type="datetime-local"
              value={novoHorario}
              onChange={(e) => setNovoHorario(e.target.value)}
              className="h-12 rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 px-3 text-corpo tabular text-txt"
            />
          </label>
          <Button largura="cheia" carregando={pendente} onClick={confirmarRemarcacao}>
            Confirmar novo horário
          </Button>
          <Button variante="secondary" largura="cheia" disabled={pendente} onClick={() => setMostrarRemarcar(false)}>
            Voltar
          </Button>
        </div>
      ) : null}

      {mostrarCancelar ? (
        <div className="flex flex-col gap-3">
          <p className="text-corpo font-semibold">Cancelar esse agendamento?</p>
          <label className="flex flex-col gap-1">
            <span className="text-label font-semibold text-txt-2">Motivo (opcional)</span>
            <input
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              className="h-12 rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 px-3 text-corpo text-txt"
            />
          </label>
          <Button variante="danger" largura="cheia" carregando={pendente} onClick={confirmarCancelamento}>
            Sim, cancelar
          </Button>
          <Button variante="secondary" largura="cheia" disabled={pendente} onClick={() => setMostrarCancelar(false)}>
            Voltar
          </Button>
        </div>
      ) : null}

      <Button variante="secondary" largura="cheia" disabled={pendente} onClick={onFechar}>
        Fechar
      </Button>
    </div>
  )
}
