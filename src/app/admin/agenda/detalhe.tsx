'use client'

import { MapPin } from 'lucide-react'
import Link from 'next/link'

import { useState, useTransition } from 'react'

import Button from '@/components/ui/button'
import Input from '@/components/ui/input'
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

/** Confirmação específica no toast — na mesma voz de "Agendamento cancelado"/"remarcado" logo abaixo. */
const TITULO_FEITO: Partial<Record<EstadoAgendamento, string>> = {
  confirmed: 'Agendamento confirmado',
  arrived: 'Chegada registrada',
  done: 'Atendimento concluído',
  no_show: 'Falta registrada',
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
  const [linkAvaliacao, setLinkAvaliacao] = useState<string | null>(null)
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
        const resultado = await post(`/api/v1/appointments/${agendamento.id}/${ROTA_ACAO[novoEstado]}`)
        // Só `complete` devolve link de avaliação — os outros estados (confirmar, chegou,
        // faltou) não têm o que avaliar ainda.
        const link = (resultado as { reviewLink?: string } | undefined)?.reviewLink
        if (novoEstado === 'done' && link) setLinkAvaliacao(link)
        mostrarToast({ tom: 'ok', titulo: TITULO_FEITO[novoEstado] ?? 'Feito' })
        onAtualizado()
      } catch (e) {
        setErro((e as Error).message)
      }
    })
  }

  function confirmarCancelamento() {
    setErro(null)
    iniciarTransicao(async () => {
      try {
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
      } catch {
        // Rede caiu antes de chegar resposta — sem isto, o React 19 relança para o error
        // boundary da raiz e a tela inteira some (docs/21 §5.4).
        setErro('Não consegui falar com o servidor. Confira a conexão e tente de novo.')
      }
    })
  }

  function confirmarRemarcacao() {
    setErro(null)
    iniciarTransicao(async () => {
      try {
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
      } catch {
        setErro('Não consegui falar com o servidor. Confira a conexão e tente de novo.')
      }
    })
  }

  return (
    <div aria-busy={pendente} className="flex flex-col gap-4">
      <div>
        <p className="text-corpo font-semibold">
          {new Date(agendamento.starts_at).toLocaleString('pt-BR', {
            weekday: 'short',
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
        <p className="mt-0.5 text-secundario text-txt-2">{dinheiro.format(agendamento.price_cents / 100)}</p>
      </div>

      {/* docs/09-PLATAFORMA.md G3+G13 (P2.5): endereço do atendimento, quando
          não é no endereço fixo do negócio — sem ele, faxineira/eletricista
          não sabem pra onde ir. §10 (P9) prometia "link pra abrir no mapa" —
          não geocodifica nada (não sabe lat/lng), só manda o texto pro app
          de mapa do celular decidir; zero custo, zero precisão exigida. */}
      {agendamento.address ? (
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(agendamento.address)}`}
          target="_blank"
          rel="noreferrer"
          className="flex items-start gap-2 text-secundario text-acc-2 underline-offset-2 hover:underline"
        >
          <MapPin aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span>{agendamento.address}</span>
        </a>
      ) : null}

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
              href={`/admin/comanda/agendamento/${agendamento.id}`}
              className="flex h-12 w-full items-center justify-center rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 text-corpo font-semibold text-txt transition duration-[var(--dur-1)] hover:bg-surface-3 active:scale-[.98]"
            >
              Ver comanda
            </Link>
          ) : null}
          {linkAvaliacao ? (
            // `api.whatsapp.com/send?text=` (sem número) abre o seletor de contato do
            // WhatsApp — não precisa do telefone da cliente, que esta tela nem carrega.
            <a
              href={`https://api.whatsapp.com/send?text=${encodeURIComponent(`Oi! Poderia avaliar seu atendimento? ${linkAvaliacao}`)}`}
              target="_blank"
              rel="noreferrer"
              className="flex h-12 w-full items-center justify-center rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 text-corpo font-semibold text-acc-2 transition duration-[var(--dur-1)] hover:bg-surface-3 active:scale-[.98]"
            >
              Pedir avaliação
            </a>
          ) : null}
          {acoesDeEstado.length === 0 && !podeRemarcar && !podeCancelar ? (
            <p className="text-secundario text-txt-2">Esse agendamento não tem mais ação disponível.</p>
          ) : null}
        </div>
      ) : null}

      {mostrarRemarcar ? (
        <div className="flex flex-col gap-3">
          <Input
            rotulo="Novo horário"
            type="datetime-local"
            value={novoHorario}
            onChange={(e) => setNovoHorario(e.target.value)}
            classNameCampo="tabular"
          />
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
          <Input
            rotulo="Motivo (opcional)"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            ajuda="Fica no histórico da cliente."
          />
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
