'use client'

import { MapPin, StickyNote } from 'lucide-react'
import Link from 'next/link'

import { useEffect, useRef, useState, useTransition } from 'react'

import GradeDeHorarios, { slotsUnicosDe, type SlotLivre } from '@/components/agenda/grade-de-horarios'
import TrilhoDeDias from '@/components/agenda/trilho-de-dias'
import { useFuso } from '@/components/shell/fuso'
import Chip from '@/components/ui/chip'
import { hojeNoFuso, proximosDias } from '@/core/agenda/dias'
import { horaLocal } from '@/lib/formato'
import Button from '@/components/ui/button'
import Input from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'
import { vibrarConfirmacao } from '@/lib/haptics'

import { acoesDoHorario } from '@/core/scheduling/acoes-do-horario'
import type { EstadoAgendamento } from '@/core/scheduling/state'

import type { LinhaAgendaDia } from '@/server/services/agendamentos'
import { fetchComTentativa } from '@/lib/tentativa'

const dinheiro = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export const ROTULO_ACAO: Partial<Record<EstadoAgendamento, string>> = {
  confirmed: 'Confirmar',
  arrived: 'Chegou',
  done: 'Concluir',
  no_show: 'Marcar falta',
}

export const ROTA_ACAO: Partial<Record<EstadoAgendamento, string>> = {
  confirmed: 'confirm',
  arrived: 'arrive',
  done: 'complete',
  no_show: 'no-show',
}

/** Confirmação específica no toast — na mesma voz de "Agendamento cancelado"/"remarcado" logo abaixo. */
export const TITULO_FEITO: Partial<Record<EstadoAgendamento, string>> = {
  confirmed: 'Agendamento confirmado',
  arrived: 'Chegada registrada',
  done: 'Atendimento concluído',
  no_show: 'Falta registrada',
}

export async function post(url: string) {
  const r = await fetchComTentativa(url, { method: 'POST' })
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
 * de `acoesDoHorario()`, que lê `proximosEstados()`, o mesmo módulo que valida no servidor. Uma
 * transição que o servidor recusaria nunca aparece como botão: não tem como
 * a tela e a regra de negócio discordarem.
 */
export default function DetalheAgendamento({
  agendamento,
  onFechar,
  onAtualizado,
  aoMudarOtimista,
}: {
  agendamento: LinhaAgendaDia
  onFechar: () => void
  onAtualizado: () => void
  /** docs/53 H-00: aplica o novo status na lista e neste sheet antes da rede responder. */
  aoMudarOtimista: (status: EstadoAgendamento) => void
}) {
  const [pendente, iniciarTransicao] = useTransition()
  const fuso = useFuso()
  const [mostrarCancelar, setMostrarCancelar] = useState(false)
  const [mostrarRemarcar, setMostrarRemarcar] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [novoHorario, setNovoHorario] = useState(() => paraInputLocal(agendamento.starts_at))
  /*
    APR-111 (docs/98 C-10, I-10): remarcar pela mesma grade do Marcar e do público (APR-110), no
    mesmo profissional e serviço; "Outro horário" reabre o campo manual. No 409, as alternativas que
    a API já devolvia (e a tela jogava fora) viram chips tocáveis.
  */
  const [diaRemarcar, setDiaRemarcar] = useState(() => hojeNoFuso(fuso))
  const [slotsRemarcar, setSlotsRemarcar] = useState<SlotLivre[] | null>(null)
  const [erroDosHorarios, setErroDosHorarios] = useState<string | null>(null)
  const [slotRemarcar, setSlotRemarcar] = useState<SlotLivre | null>(null)
  const [remarcarManual, setRemarcarManual] = useState(false)
  const [alternativas, setAlternativas] = useState<string[]>([])
  const pedidoDeHorarios = useRef(0)
  const diasRemarcar = proximosDias(14, hojeNoFuso(fuso))
  useEffect(() => {
    if (!mostrarRemarcar || remarcarManual) return
    const meuPedido = ++pedidoDeHorarios.current
    setSlotsRemarcar(null)
    setErroDosHorarios(null)
    const params = new URLSearchParams({ serviceId: agendamento.service_id, date: diaRemarcar, professionalId: agendamento.professional_id })
    fetch(`/api/v1/appointments/availability?${params.toString()}`)
      .then(async (r) => {
        const json = (await r.json()) as { data?: { slots: SlotLivre[] }; error?: { message: string } }
        if (meuPedido !== pedidoDeHorarios.current) return
        if (!r.ok) {
          setErroDosHorarios(json.error?.message ?? 'Não consegui buscar os horários.')
          return
        }
        setSlotsRemarcar(json.data?.slots ?? [])
      })
      .catch(() => {
        if (meuPedido === pedidoDeHorarios.current) setErroDosHorarios('Não consegui falar com o servidor. Confira a conexão e toque no dia de novo.')
      })
  }, [mostrarRemarcar, remarcarManual, diaRemarcar, agendamento.service_id, agendamento.professional_id])
  const [erro, setErro] = useState<string | null>(null)
  const [linkAvaliacao, setLinkAvaliacao] = useState<string | null>(null)
  const mostrarToast = useToast()

  const estadoAtual = agendamento.status as EstadoAgendamento
  // APR-105: um primário só (a próxima ação do estado); o resto secundário; cancelar separado no fim.
  const { principal, secundarias, podeCancelar } = acoesDoHorario(estadoAtual)
  // Remarcar não é uma transição de status — cabe enquanto ainda não chegou.
  const podeRemarcar = estadoAtual === 'pending' || estadoAtual === 'confirmed'

  function executar(novoEstado: EstadoAgendamento) {
    setErro(null)
    iniciarTransicao(async () => {
      // H-00: dentro da MESMA transição do `fetch` — é isso que faz o React mostrar o estado novo
      // já neste render e descartá-lo sozinho se a transição terminar sem `onAtualizado` (H-01).
      aoMudarOtimista(novoEstado)
      // T4 (docs/64 §0.4): reforço físico da mudança que já apareceu na tela — nunca aguardado,
      // nunca pode atrasar nem falhar a ação real.
      void vibrarConfirmacao()
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
        const r = await fetchComTentativa(`/api/v1/appointments/${agendamento.id}`, {
          method: 'DELETE',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ canceledBy: 'professional', reason: motivo || undefined }),
        })
        const json = (await r.json()) as { error?: { message: string } }
        if (!r.ok) {
          setErro(json.error?.message ?? 'Não consegui cancelar.')
          return
        }
        // T4 (docs/64 §0.4): mesmo reforço físico de `executar()` — aqui só depois da resposta
        // OK, porque este caminho não é otimista (espera o servidor antes de confirmar na tela).
        void vibrarConfirmacao()
        mostrarToast({ tom: 'ok', titulo: 'Agendamento cancelado' })
        onAtualizado()
      } catch {
        // Rede caiu antes de chegar resposta — sem isto, o React 19 relança para o error
        // boundary da raiz e a tela inteira some (docs/21 §5.4).
        setErro('Não consegui falar com o servidor. Confira a conexão e tente de novo.')
      }
    })
  }

  function confirmarRemarcacao(startsAtIso?: string) {
    setErro(null)
    setAlternativas([])
    // O horário da grade vai como veio do servidor (ISO); o manual passa pelo fuso do aparelho, como antes.
    const startsAt = startsAtIso ?? (!remarcarManual && slotRemarcar ? slotRemarcar.startsAt : new Date(novoHorario).toISOString())
    iniciarTransicao(async () => {
      try {
        const r = await fetchComTentativa(`/api/v1/appointments/${agendamento.id}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ startsAt }),
        })
        const json = (await r.json()) as { error?: { code: string; message: string; details?: { alternatives?: string[] } } }
        if (!r.ok) {
          // SLOT_TAKEN: a API já manda os horários livres mais perto; eles viram chips (APR-111).
          setErro(json.error?.message ?? 'Não consegui remarcar.')
          setAlternativas(json.error?.details?.alternatives ?? [])
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
        {/*
          Quem é vem primeiro: o detalhe dizia só "Agendamento", o dia e o preço, e o balcão tocava em
          "Chegou" sem ver o nome (achado na medida do APR-105). Dia e hora no fuso do NEGÓCIO
          (APR-019), não no do aparelho de quem abre.
        */}
        <p className="text-stat font-semibold">{agendamento.clients?.name ?? 'Sem cliente'}</p>
        {agendamento.services?.name ? (
          <p className="text-secundario text-txt-2">
            {agendamento.services.name}
            {agendamento.professionals?.display_name ? ` com ${agendamento.professionals.display_name}` : ''}
          </p>
        ) : null}
        <p className="mt-2 text-corpo font-semibold">
          {new Date(agendamento.starts_at).toLocaleString('pt-BR', {
            weekday: 'short',
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            timeZone: fuso,
          })}
        </p>
        <p className="mt-0.5 text-secundario text-txt-2">{dinheiro.format(agendamento.price_cents / 100)}</p>
        {/*
          O sinal só aparece aqui, no detalhe, e nunca na lista: na lista ele viraria um segundo
          número competindo com o preço em cada linha do dia, e o momento de agir sobre ele é
          quando alguém abre o agendamento — não quando passa o olho na agenda.

          A distinção por `origin` é a parte que torna a linha acionável. Sem ela quem atende não
          sabe se está introduzindo o assunto ou lembrando de algo que a pessoa já leu, e as duas
          conversas são diferentes. `public_page` é o único caminho em que a tela mostrou o valor
          antes de confirmar; nos outros o sinal é regra da casa que ninguém comunicou ainda.

          Continua sem prometer cobrança: não há meio de pagamento no CICLO e esta linha não
          sugere que haja — ela diz o que foi combinado, e o combinado acontece onde já acontece.
        */}
        {agendamento.deposit_cents > 0 ? (
          <p className="mt-1 text-secundario text-txt-2">
            Sinal de <strong className="tabular font-semibold text-txt">{dinheiro.format(agendamento.deposit_cents / 100)}</strong>
            {agendamento.origin === 'public_page' ? '. Quem marcou viu esse valor ao agendar.' : '. Ainda não avisamos quem marcou.'}
          </p>
        ) : null}
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

      {/*
        0092: sem isto, `client_note` — inclusive o "quero levar produto X" do agendamento público
        (0091) — ficava gravado no banco e NINGUÉM via. A feature de "leva junto" só converte se
        o profissional lê o interesse ANTES do atendimento, e este é o único lugar da agenda que
        mostra o agendamento por completo antes de agir sobre ele.
      */}
      {agendamento.client_note ? (
        <p className="flex items-start gap-2 text-secundario text-txt-2">
          <StickyNote aria-hidden className="mt-0.5 size-4 shrink-0 text-acc-2" />
          <span>{agendamento.client_note}</span>
        </p>
      ) : null}

      {erro ? (
        <p role="alert" className="text-secundario text-bad">
          {erro}
        </p>
      ) : null}

      {!mostrarCancelar && !mostrarRemarcar ? (
        <div className="flex flex-col gap-2">
          {/*
            H-00: SEM `carregando={pendente}` de propósito. Assim que este botão é tocado, o
            estado otimista troca `acoesDeEstado` inteiro (o próprio botão some, o próximo da
            sequência aparece no lugar) — um spinner aqui giraria num botão que ninguém tocou.
            `disabled` continua bloqueando toque duplo enquanto a mutação real está em voo.
          */}
          {principal ? (
            <Button largura="cheia" disabled={pendente} onClick={() => executar(principal)}>
              {ROTULO_ACAO[principal]}
            </Button>
          ) : null}
          {secundarias.map((estado) => (
            <Button key={estado} variante="secondary" largura="cheia" disabled={pendente} onClick={() => executar(estado)}>
              {ROTULO_ACAO[estado]}
            </Button>
          ))}
          {podeRemarcar ? (
            <Button variante="secondary" largura="cheia" disabled={pendente} onClick={() => setMostrarRemarcar(true)}>
              Remarcar
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
            // WhatsApp — não precisa do telefone de quem foi atendido, que esta tela nem carrega.
            <a
              href={`https://api.whatsapp.com/send?text=${encodeURIComponent(`Oi! Poderia avaliar seu atendimento? ${linkAvaliacao}`)}`}
              target="_blank"
              rel="noreferrer"
              className="flex h-12 w-full items-center justify-center rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 text-corpo font-semibold text-acc-2 transition duration-[var(--dur-1)] hover:bg-surface-3 active:scale-[.98]"
            >
              Pedir avaliação
            </a>
          ) : null}
          {!principal && secundarias.length === 0 && !podeRemarcar && !podeCancelar ? (
            <p className="text-secundario text-txt-2">Esse agendamento não tem mais ação disponível.</p>
          ) : null}
          {/* Destrutivo no fim, separado, com a consequência: longe do polegar que procura "Chegou". */}
          {podeCancelar ? (
            <div className="mt-3 border-t border-line pt-3">
              <Button variante="ghost" largura="cheia" className="text-bad" disabled={pendente} onClick={() => setMostrarCancelar(true)}>
                Cancelar horário
              </Button>
              <p className="mt-1 text-center text-label text-txt-3">Ele sai da agenda e o horário fica livre.</p>
            </div>
          ) : null}
        </div>
      ) : null}

      {mostrarRemarcar ? (
        <div className="flex flex-col gap-3">
          {alternativas.length > 0 ? (
            <div className="flex flex-col gap-2">
              <p className="text-secundario text-txt-2">Estes estão livres, perto do que você queria:</p>
              <div className="flex flex-wrap gap-2">
                {alternativas.map((iso) => (
                  <Chip key={iso} onClick={() => confirmarRemarcacao(iso)}>
                    {horaLocal(iso, fuso)}
                  </Chip>
                ))}
              </div>
            </div>
          ) : null}
          {!remarcarManual ? (
            <>
              <TrilhoDeDias dias={diasRemarcar} dia={diaRemarcar} fechados={new Set()} aoEscolher={(d) => { setDiaRemarcar(d); setSlotRemarcar(null) }} />
              <p aria-live="polite" className="sr-only">
                {erroDosHorarios ? '' : slotsRemarcar === null ? 'Buscando horários.' : slotsRemarcar.length === 0 ? 'Sem horários livres nesse dia.' : `${slotsUnicosDe(slotsRemarcar).length} horários livres.`}
              </p>
              {erroDosHorarios ? (
                <p role="alert" className="text-secundario text-bad">{erroDosHorarios}</p>
              ) : slotsRemarcar === null ? (
                <p className="text-secundario text-txt-2">Buscando horários…</p>
              ) : slotsRemarcar.length === 0 ? (
                <p className="text-secundario text-txt-2">Sem horários livres nesse dia. Tente outro dia, ou use &ldquo;Outro horário&rdquo;.</p>
              ) : (
                <GradeDeHorarios slots={slotsUnicosDe(slotsRemarcar)} timezone={fuso} escolhido={slotRemarcar} aoEscolher={setSlotRemarcar} />
              )}
              <button type="button" onClick={() => setRemarcarManual(true)} className="flex min-h-12 items-center self-start text-secundario font-semibold text-acc-2 underline underline-offset-2">
                Outro horário (fora da lista)
              </button>
            </>
          ) : (
            <Input
              rotulo="Novo horário"
              type="datetime-local"
              value={novoHorario}
              onChange={(e) => setNovoHorario(e.target.value)}
              classNameCampo="tabular"
              ajuda="Encaixe fora dos horários livres. O sistema ainda recusa se o horário estiver ocupado."
            />
          )}
          <Button
            largura="cheia"
            carregando={pendente}
            disabled={!remarcarManual && !slotRemarcar}
            motivoDesabilitado="Escolha um horário na lista acima."
            onClick={() => confirmarRemarcacao()}
          >
            {slotRemarcar && !remarcarManual ? `Remarcar para ${horaLocal(slotRemarcar.startsAt, fuso)}` : 'Confirmar novo horário'}
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
            ajuda="Fica no histórico de quem ia ser atendido."
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
