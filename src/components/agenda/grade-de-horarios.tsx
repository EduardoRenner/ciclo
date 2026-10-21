'use client'

import { ChevronDown } from 'lucide-react'
import { useState } from 'react'

import Chip from '@/components/ui/chip'
import { horaLocal } from '@/lib/formato'

/**
 * APR-109 (docs/98 I-10): a grade de horários livres do agendar público, extraída para servir também
 * ao "Marcar" do painel (APR-110) e ao remarcar (APR-111). Uma regra, um lugar: quem busca os horários
 * é quem usa a grade (a busca é injetada por `slots`); aqui mora só o desenho e a escolha.
 *
 * O que ficou igual ao público, de propósito (cada linha foi medida lá):
 * - um chip por horário, o primeiro profissional disponível (com "Qualquer um", 126 chips viravam 42);
 * - uma faixa por período (manhã, tarde, noite) e só a aberta lista; a fechada diz quantos e a partir
 *   de que hora, então fechar não esconde informação;
 * - um período já vem aberto: colapsar tudo custaria um toque no caso comum (aceitar o próximo livre).
 */
export type SlotLivre = { startsAt: string; endsAt: string; professionalId: string }

export type Periodo = 'Manhã' | 'Tarde' | 'Noite'

/** `null` = ninguém mexeu (vale o primeiro com vaga); `NENHUM_PERIODO` = a pessoa fechou a que estava aberta. */
export const NENHUM_PERIODO = ''

export function periodo(iso: string, timezone: string): Periodo {
  const hora = Number(new Intl.DateTimeFormat('pt-BR', { hour: 'numeric', hour12: false, timeZone: timezone }).format(new Date(iso)))
  if (hora < 12) return 'Manhã'
  if (hora < 18) return 'Tarde'
  return 'Noite'
}

/** Um por horário: com "Qualquer um", a API devolve o mesmo `startsAt` por profissional. */
export function slotsUnicosDe<T extends { startsAt: string }>(slots: readonly T[]): T[] {
  return [...new Map(slots.map((s) => [s.startsAt, s])).values()]
}

export default function GradeDeHorarios({
  slots,
  timezone,
  escolhido,
  aoEscolher,
}: {
  /** Já sem duplicata por horário (`slotsUnicosDe`). */
  slots: readonly SlotLivre[]
  timezone: string
  escolhido: SlotLivre | null
  aoEscolher: (s: SlotLivre) => void
}) {
  const [periodoAberto, setPeriodoAberto] = useState<string | null>(null)
  const grupos = (['Manhã', 'Tarde', 'Noite'] as const)
    .map((p) => ({ periodo: p, itens: slots.filter((s) => periodo(s.startsAt, timezone) === p) }))
    .filter((g) => g.itens.length > 0)
  const periodoVisivel = periodoAberto ?? grupos[0]?.periodo ?? null

  return (
    <section className="flex flex-col gap-2">
      {grupos.map((grupo) => {
        const aberto = grupo.periodo === periodoVisivel
        const primeiro = horaLocal(grupo.itens[0]!.startsAt, timezone)
        const temEscolhido = grupo.itens.some((s) => s.startsAt === escolhido?.startsAt)
        return (
          <div key={grupo.periodo} className="overflow-hidden rounded-[var(--radius-sm)] border border-line-2">
            <button
              type="button"
              onClick={() => setPeriodoAberto(aberto ? NENHUM_PERIODO : grupo.periodo)}
              aria-expanded={aberto}
              className="flex min-h-12 w-full items-center gap-3 bg-surface-2 px-4 py-2 text-left transition hover:bg-surface-3"
            >
              <span className="flex-1 text-corpo font-semibold text-txt">{grupo.periodo}</span>
              {/* O ponto marca o período com o horário já escolhido: fechar a faixa não some com a escolha. */}
              {temEscolhido && !aberto ? <span aria-hidden className="size-2 rounded-full bg-acc" /> : null}
              <span className="text-secundario text-txt-3">
                {grupo.itens.length} {grupo.itens.length === 1 ? 'horário' : 'horários'} · a partir de {primeiro}
              </span>
              <ChevronDown aria-hidden className={`size-4 shrink-0 text-txt-3 transition-transform duration-[var(--dur-1)] ${aberto ? 'rotate-180' : ''}`} />
            </button>
            {aberto ? (
              <div className="flex flex-wrap gap-2 p-3">
                {grupo.itens.map((s) => (
                  <Chip key={`${s.startsAt}-${s.professionalId}`} ligado={escolhido?.startsAt === s.startsAt} onClick={() => aoEscolher(s)}>
                    {horaLocal(s.startsAt, timezone)}
                  </Chip>
                ))}
              </div>
            ) : null}
          </div>
        )
      })}
    </section>
  )
}
