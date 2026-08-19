'use client'

import { CheckCircle2 } from 'lucide-react'
import { useEffect, useMemo, useState, useTransition } from 'react'

import Button from '@/components/ui/button'
import Card from '@/components/ui/card'
import Chip from '@/components/ui/chip'
import FilterRow from '@/components/ui/filter-row'
import Input from '@/components/ui/input'
import PhoneInput from '@/components/ui/phone-input'
import { dinheiro, duracao } from '@/lib/formato'

type Servico = { id: string; name: string; durationMin: number; priceCents: number }
type Profissional = { id: string; displayName: string }
type Slot = { startsAt: string; endsAt: string; professionalId: string }

/** 14 dias corridos a partir de hoje — cobre o horizonte real de quem agenda pelo site, sem paginação. */
function proximosDias(qtd: number): string[] {
  const hoje = new Date()
  return Array.from({ length: qtd }, (_, i) => {
    const d = new Date(hoje)
    d.setDate(hoje.getDate() + i)
    return d.toISOString().slice(0, 10)
  })
}

function paraData(iso: string): Date {
  const [ano, mes, dia] = iso.split('-').map(Number)
  return new Date(ano!, mes! - 1, dia)
}

function horaLocal(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function periodo(iso: string): 'Manhã' | 'Tarde' | 'Noite' {
  const hora = new Date(iso).getHours()
  if (hora < 12) return 'Manhã'
  if (hora < 18) return 'Tarde'
  return 'Noite'
}

/** Numerar os passos foi o que faltava: eram quatro escolhas numa página rolante, sem nenhum sinal de progresso. */
function Passo({ numero, titulo }: { numero: number; titulo: string }) {
  return (
    <h2 className="mb-3 flex items-center gap-2 text-overline font-semibold uppercase tracking-[0.13em] text-txt-3">
      <span className="grid size-5 place-items-center rounded-[var(--radius-pill)] bg-surface-3 text-label font-bold text-txt-2">
        {numero}
      </span>
      {titulo}
    </h2>
  )
}

export default function Agendar({
  slug,
  services,
  professionals,
}: {
  slug: string
  services: Servico[]
  professionals: Profissional[]
}) {
  const dias = useMemo(() => proximosDias(14), [])

  const [serviceId, setServiceId] = useState(services[0]?.id ?? '')
  const [professionalId, setProfessionalId] = useState<string | null>(null)
  const [dia, setDia] = useState(dias[0] ?? '')
  const [slots, setSlots] = useState<Slot[] | null>(null)
  const [slotEscolhido, setSlotEscolhido] = useState<Slot | null>(null)
  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
  // Honeypot: campo real no DOM, invisível só por CSS/posição — um preenchimento
  // automatizado de formulário não pula isso, um humano nunca o vê.
  const [website, setWebsite] = useState('')
  const [confirmado, setConfirmado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciarTransicao] = useTransition()

  const servicoEscolhido = services.find((s) => s.id === serviceId)

  // Carrega os horários do primeiro dia sozinho — a versão anterior exigia
  // um toque em "Ver horários" antes de mostrar qualquer coisa; o Ruivo (o
  // modelo pedido) já carrega automático. Só na montagem, de propósito.
  useEffect(() => {
    if (dias[0] && serviceId) buscarDisponibilidade(dias[0])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function buscarDisponibilidade(novoDia: string, novoServico?: string) {
    setDia(novoDia)
    setSlots(null)
    setSlotEscolhido(null)
    setErro(null)
    iniciarTransicao(async () => {
      const params = new URLSearchParams({ serviceId: novoServico ?? serviceId, date: novoDia })
      if (professionalId) params.set('professionalId', professionalId)
      const r = await fetch(`/api/v1/public/${slug}/availability?${params.toString()}`)
      const json = (await r.json()) as { data?: { slots: Slot[] }; error?: { message: string } }
      if (!r.ok) {
        setErro(json.error?.message ?? 'Não consegui buscar horários.')
        return
      }
      setSlots(json.data?.slots ?? [])
    })
  }

  function escolherServico(id: string) {
    setServiceId(id)
    setSlots(null)
    setSlotEscolhido(null)
    buscarDisponibilidade(dia, id)
  }

  function confirmar() {
    if (!slotEscolhido) return
    setErro(null)
    iniciarTransicao(async () => {
      const r = await fetch(`/api/v1/public/${slug}/book`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          serviceId,
          professionalId: slotEscolhido.professionalId,
          startsAt: slotEscolhido.startsAt,
          name: nome,
          phone: telefone,
          website: website || undefined,
        }),
      })
      const json = (await r.json()) as { error?: { code: string; message: string; details?: { alternatives?: string[] } } }
      if (!r.ok) {
        if (json.error?.code === 'SLOT_TAKEN') {
          setErro('Esse horário acabou de ser reservado. Escolha outro.')
          buscarDisponibilidade(dia)
          return
        }
        setErro(json.error?.message ?? 'Não consegui confirmar. Tente de novo.')
        return
      }
      setConfirmado(true)
    })
  }

  if (confirmado) {
    return (
      <Card className="flex flex-col items-center py-10 text-center">
        <CheckCircle2 aria-hidden className="mb-4 size-14 text-ok" />
        <p className="text-titulo font-extrabold">Agendamento enviado!</p>
        <p className="mt-2 max-w-xs text-corpo text-txt-2">
          Você vai receber a confirmação por WhatsApp. Se não confirmarmos em algumas horas, é só chamar por telefone.
        </p>
      </Card>
    )
  }

  const slotsPorPeriodo =
    slots && slots.length > 0
      ? (['Manhã', 'Tarde', 'Noite'] as const).map((p) => ({ periodo: p, itens: slots.filter((s) => periodo(s.startsAt) === p) }))
      : []

  return (
    <div className="flex flex-col gap-5">
      <section>
        <Passo numero={1} titulo="Serviço" />
        <div className="flex flex-col gap-2">
          {services.map((s) => (
            <button key={s.id} type="button" onClick={() => escolherServico(s.id)} className="block w-full text-left">
              <Card
                className={
                  s.id === serviceId ? 'border-acc bg-acc-soft transition' : 'transition hover:border-line-2 hover:bg-surface-2'
                }
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-corpo font-semibold">{s.name}</p>
                    <p className="tabular text-secundario text-txt-2">{duracao(s.durationMin)}</p>
                  </div>
                  <p className="tabular shrink-0 text-corpo font-semibold text-acc-2">
                    {s.priceCents > 0 ? dinheiro.format(s.priceCents / 100) : 'Consultar'}
                  </p>
                </div>
              </Card>
            </button>
          ))}
        </div>
      </section>

      {professionals.length > 1 ? (
        <section>
          <Passo numero={2} titulo="Profissional" />
          <div className="flex flex-wrap gap-2">
            <Chip
              ligado={professionalId === null}
              onClick={() => {
                setProfessionalId(null)
                buscarDisponibilidade(dia)
              }}
            >
              Qualquer um
            </Chip>
            {professionals.map((p) => (
              <Chip
                key={p.id}
                ligado={professionalId === p.id}
                onClick={() => {
                  setProfessionalId(p.id)
                  buscarDisponibilidade(dia)
                }}
              >
                {p.displayName}
              </Chip>
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <Passo numero={professionals.length > 1 ? 3 : 2} titulo="Dia" />
        <FilterRow rotulo="Escolher o dia">
          {dias.map((d) => {
            const data = paraData(d)
            return (
              <button
                key={d}
                type="button"
                onClick={() => buscarDisponibilidade(d)}
                aria-current={d === dia ? 'date' : undefined}
                className={
                  'flex h-16 w-14 shrink-0 flex-col items-center justify-center gap-0.5 rounded-[var(--radius-sm)] text-label font-semibold transition duration-[var(--dur-1)] ease-[var(--ease-ios)] active:scale-[.95] ' +
                  (d === dia
                    ? 'bg-[image:var(--grad-acc)] text-on-acc shadow-elevado'
                    : 'bg-surface-2 text-txt-2 hover:bg-surface-3 hover:text-txt')
                }
              >
                <span className="uppercase">{data.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')}</span>
                <span className={`tabular text-corpo font-bold ${d === dia ? '' : 'text-txt'}`}>{data.getDate()}</span>
              </button>
            )
          })}
        </FilterRow>
      </section>

      {erro ? (
        <p role="alert" className="text-secundario text-bad">
          {erro}
        </p>
      ) : null}

      {slots ? (
        slots.length === 0 ? (
          <p className="text-secundario text-txt-2">Sem horários livres nesse dia. Tente outra data.</p>
        ) : (
          <section className="flex flex-col gap-4">
            {slotsPorPeriodo
              .filter((grupo) => grupo.itens.length > 0)
              .map((grupo) => (
                <div key={grupo.periodo}>
                  <h3 className="mb-2 text-label font-semibold text-txt-3">{grupo.periodo}</h3>
                  <div className="flex flex-wrap gap-2">
                    {grupo.itens.map((s) => (
                      <Chip key={`${s.startsAt}-${s.professionalId}`} ligado={slotEscolhido?.startsAt === s.startsAt} onClick={() => setSlotEscolhido(s)}>
                        {horaLocal(s.startsAt)}
                      </Chip>
                    ))}
                  </div>
                </div>
              ))}
          </section>
        )
      ) : pendente ? (
        <p className="text-secundario text-txt-2">Buscando horários…</p>
      ) : null}

      {slotEscolhido && servicoEscolhido ? (
        <Card className="flex flex-col gap-3">
          <div>
            <p className="text-corpo font-semibold text-txt">{servicoEscolhido.name}</p>
            <p className="mt-0.5 text-secundario text-txt-2">
              {paraData(dia).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })} às{' '}
              {horaLocal(slotEscolhido.startsAt)} · {duracao(servicoEscolhido.durationMin)}
            </p>
            {servicoEscolhido.priceCents > 0 ? (
              <p className="tabular mt-2 text-stat font-extrabold text-acc-2">
                {dinheiro.format(servicoEscolhido.priceCents / 100)}
              </p>
            ) : null}
          </div>
          {/*
            `autoComplete` faltava nos dois campos: sem ele o celular não
            oferece o nome e o telefone já salvos — atrito puro no único
            formulário do produto que fica entre a cliente e a reserva.
          */}
          <Input
            rotulo="Seu nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            autoComplete="name"
            required
          />
          <PhoneInput
            rotulo="Seu telefone (WhatsApp)"
            valor={telefone}
            aoMudar={setTelefone}
            ajuda="É por aqui que a confirmação chega."
            required
          />

          {/* Honeypot — invisível para gente, visível para script. */}
          <label className="absolute -left-[9999px] h-0 w-0 overflow-hidden" aria-hidden tabIndex={-1}>
            Não preencha este campo
            <input value={website} onChange={(e) => setWebsite(e.target.value)} tabIndex={-1} autoComplete="off" />
          </label>

          <Button largura="cheia" carregando={pendente} disabled={!nome || !telefone} onClick={confirmar}>
            Confirmar agendamento
          </Button>
        </Card>
      ) : null}
    </div>
  )
}
