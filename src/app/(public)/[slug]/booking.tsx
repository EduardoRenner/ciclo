'use client'

import { useState, useTransition } from 'react'

import Button from '@/components/ui/button'
import Card from '@/components/ui/card'
import Chip from '@/components/ui/chip'

type Servico = { id: string; name: string; durationMin: number; priceCents: number }
type Profissional = { id: string; displayName: string }
type Slot = { startsAt: string; endsAt: string; professionalId: string }

const dinheiro = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

function hojeISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function horaLocal(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

export default function Booking({
  slug,
  services,
  professionals,
}: {
  slug: string
  services: Servico[]
  professionals: Profissional[]
}) {
  const [serviceId, setServiceId] = useState(services[0]?.id ?? '')
  const [professionalId, setProfessionalId] = useState<string | null>(null)
  const [data, setData] = useState(hojeISO())
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

  function buscarDisponibilidade() {
    setSlots(null)
    setSlotEscolhido(null)
    setErro(null)
    iniciarTransicao(async () => {
      const params = new URLSearchParams({ serviceId, date: data })
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
          buscarDisponibilidade()
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
      <Card>
        <p className="text-corpo font-semibold">Agendamento enviado!</p>
        <p className="mt-1 text-secundario text-txt-2">
          Você vai receber a confirmação por WhatsApp. Se não confirmarmos em algumas horas, é só
          chamar por telefone.
        </p>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="text-label font-semibold text-txt-2">Serviço</span>
        <select
          value={serviceId}
          onChange={(e) => setServiceId(e.target.value)}
          className="h-12 rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 px-3 text-corpo text-txt"
        >
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} · {dinheiro.format(s.priceCents / 100)}
            </option>
          ))}
        </select>
      </label>

      {professionals.length > 1 ? (
        <div className="flex flex-wrap gap-2">
          <Chip ligado={professionalId === null} onClick={() => setProfessionalId(null)}>
            Qualquer profissional
          </Chip>
          {professionals.map((p) => (
            <Chip key={p.id} ligado={professionalId === p.id} onClick={() => setProfessionalId(p.id)}>
              {p.displayName}
            </Chip>
          ))}
        </div>
      ) : null}

      <label className="flex flex-col gap-1">
        <span className="text-label font-semibold text-txt-2">Data</span>
        <input
          type="date"
          value={data}
          min={hojeISO()}
          onChange={(e) => setData(e.target.value)}
          className="h-12 rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 px-3 text-corpo tabular text-txt"
        />
      </label>

      <Button variante="secondary" largura="cheia" carregando={pendente} onClick={buscarDisponibilidade} disabled={!serviceId}>
        Ver horários
      </Button>

      {erro ? (
        <p role="alert" className="text-secundario text-bad">
          {erro}
        </p>
      ) : null}

      {slots ? (
        slots.length === 0 ? (
          <p className="text-secundario text-txt-2">Sem horários livres nesse dia. Tente outra data.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {slots.map((s) => (
              <Chip key={`${s.startsAt}-${s.professionalId}`} ligado={slotEscolhido?.startsAt === s.startsAt} onClick={() => setSlotEscolhido(s)}>
                {horaLocal(s.startsAt)}
              </Chip>
            ))}
          </div>
        )
      ) : null}

      {slotEscolhido ? (
        <Card className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-label font-semibold text-txt-2">Seu nome</span>
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              required
              className="h-12 rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 px-3 text-corpo text-txt"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-label font-semibold text-txt-2">Seu telefone (WhatsApp)</span>
            <input
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              inputMode="tel"
              required
              className="h-12 rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 px-3 text-corpo text-txt"
            />
          </label>

          {/* Honeypot — invisível para gente, visível para script. */}
          <label className="absolute -left-[9999px] h-0 w-0 overflow-hidden" aria-hidden tabIndex={-1}>
            Não preencha este campo
            <input
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              tabIndex={-1}
              autoComplete="off"
            />
          </label>

          <Button largura="cheia" carregando={pendente} disabled={!nome || !telefone} onClick={confirmar}>
            Confirmar agendamento
          </Button>
        </Card>
      ) : null}
    </div>
  )
}
