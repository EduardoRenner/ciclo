'use client'

import { Plus, Trash2 } from 'lucide-react'
import { useState, useTransition } from 'react'

import Button from '@/components/ui/button'
import Card from '@/components/ui/card'
import { useToast } from '@/components/ui/toast'

type Bloco = { weekday: number; opens_at: string; closes_at: string }
type Folga = { id: string; starts_at: string; ends_at: string; reason: string | null }

const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

/**
 * Conversão de fuso fica para quando o `date-fns-tz`/Temporal da PARTE 2 §1
 * entrar (nenhum ticket ainda instalou essa camada). Por ora o horário do
 * navegador é tratado como o do tenant — America/Sao_Paulo é o único fuso em
 * uso na família até aqui.
 */
function paraIso(dataLocal: string): string {
  return new Date(dataLocal).toISOString()
}

function paraInputLocal(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/**
 * `professionalId: null` é o expediente/folga padrão do negócio inteiro —
 * `time_off.professional_id` já é nullable com esse sentido exato desde a
 * 0001 ("null = fecha o estabelecimento"), e `business-hours/[id]` já aceita
 * o literal `default` na URL pra isso. Compartilhado entre o editor por
 * profissional (`config/profissionais/[id]/`) e o de horário do negócio
 * (`config/horarios/`) — dois editores de semana seriam o mesmo código
 * duas vezes.
 */
export default function EditorExpediente({
  professionalId,
  expedienteInicial,
  folgasIniciais,
}: {
  professionalId: string | null
  expedienteInicial: Bloco[]
  folgasIniciais: Folga[]
}) {
  const [blocos, setBlocos] = useState(expedienteInicial)
  const [folgas, setFolgas] = useState(folgasIniciais)
  const [pendente, iniciarTransicao] = useTransition()
  const mostrarToast = useToast()

  const segmentoUrl = professionalId ?? 'default'

  function salvarExpediente(novos: Bloco[]) {
    setBlocos(novos)
    iniciarTransicao(async () => {
      const r = await fetch(`/api/v1/professionals/${segmentoUrl}/business-hours`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID() },
        body: JSON.stringify({
          professionalId,
          blocos: novos.map((b) => ({ weekday: b.weekday, opensAt: b.opens_at.slice(0, 5), closesAt: b.closes_at.slice(0, 5) })),
        }),
      })
      if (!r.ok) {
        mostrarToast({ tom: 'erro', titulo: 'Não consegui salvar o expediente', descricao: 'Tente de novo.' })
      }
    })
  }

  function adicionarBloco(weekday: number) {
    salvarExpediente([...blocos, { weekday, opens_at: '09:00', closes_at: '18:00' }])
  }

  function removerBloco(indice: number) {
    salvarExpediente(blocos.filter((_, i) => i !== indice))
  }

  function atualizarBloco(indice: number, campo: 'opens_at' | 'closes_at', valor: string) {
    salvarExpediente(blocos.map((b, i) => (i === indice ? { ...b, [campo]: valor } : b)))
  }

  function criarFolga(formData: FormData) {
    const inicio = String(formData.get('inicio') ?? '')
    const fim = String(formData.get('fim') ?? '')
    const motivo = String(formData.get('motivo') ?? '').trim() || undefined

    iniciarTransicao(async () => {
      const r = await fetch('/api/v1/time-off', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID() },
        body: JSON.stringify({ professionalId, startsAt: paraIso(inicio), endsAt: paraIso(fim), reason: motivo }),
      })
      const json = (await r.json()) as { data?: Folga; error?: { message: string } }
      if (!r.ok || !json.data) {
        mostrarToast({ tom: 'erro', titulo: 'Não consegui salvar a folga', descricao: json.error?.message ?? '' })
        return
      }
      setFolgas((atual) => [...atual, json.data!])
    })
  }

  function removerFolga(id: string) {
    setFolgas((atual) => atual.filter((f) => f.id !== id))
    iniciarTransicao(async () => {
      await fetch(`/api/v1/time-off/${id}`, { method: 'DELETE', headers: { 'idempotency-key': crypto.randomUUID() } })
    })
  }

  return (
    <div aria-busy={pendente} className="flex flex-col gap-6">
      <section>
        <h2 className="mb-3 text-overline font-semibold uppercase tracking-[0.13em] text-txt-3">Expediente</h2>
        <div className="flex flex-col gap-2">
          {DIAS.map((nome, weekday) => {
            const doDia = blocos
              .map((b, indiceOriginal) => ({ ...b, indiceOriginal }))
              .filter((b) => b.weekday === weekday)

            return (
              <Card key={weekday}>
                <div className="flex items-center justify-between">
                  <p className="text-corpo font-semibold">{nome}</p>
                  <button
                    type="button"
                    aria-label={`Adicionar intervalo em ${nome}`}
                    onClick={() => adicionarBloco(weekday)}
                    className="flex size-8 items-center justify-center rounded-[var(--radius-pill)] bg-acc-soft text-acc-2"
                  >
                    <Plus aria-hidden className="size-4" />
                  </button>
                </div>

                {doDia.length === 0 ? (
                  <p className="mt-1 text-secundario text-txt-3">Fechado</p>
                ) : (
                  <div className="mt-2 flex flex-col gap-2">
                    {doDia.map((b) => (
                      <div key={b.indiceOriginal} className="flex items-center gap-2">
                        <input
                          type="time"
                          value={b.opens_at.slice(0, 5)}
                          onChange={(e) => atualizarBloco(b.indiceOriginal, 'opens_at', e.target.value)}
                          className="h-12 flex-1 rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 px-3 text-corpo tabular text-txt"
                        />
                        <span className="text-txt-3">até</span>
                        <input
                          type="time"
                          value={b.closes_at.slice(0, 5)}
                          onChange={(e) => atualizarBloco(b.indiceOriginal, 'closes_at', e.target.value)}
                          className="h-12 flex-1 rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 px-3 text-corpo tabular text-txt"
                        />
                        <button
                          type="button"
                          aria-label="Remover este intervalo"
                          onClick={() => removerBloco(b.indiceOriginal)}
                          className="flex size-12 items-center justify-center text-bad"
                        >
                          <Trash2 aria-hidden className="size-5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-overline font-semibold uppercase tracking-[0.13em] text-txt-3">
          {professionalId ? 'Folgas' : 'Fechamentos (feriados, férias coletivas)'}
        </h2>

        {folgas.length > 0 ? (
          <ul className="mb-3 flex flex-col gap-2">
            {folgas.map((f) => (
              <li key={f.id}>
                <Card className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-corpo font-semibold">
                      {new Date(f.starts_at).toLocaleDateString('pt-BR')} – {new Date(f.ends_at).toLocaleDateString('pt-BR')}
                    </p>
                    {f.reason ? <p className="text-secundario text-txt-2">{f.reason}</p> : null}
                  </div>
                  <button
                    type="button"
                    aria-label="Remover folga"
                    onClick={() => removerFolga(f.id)}
                    className="flex size-12 items-center justify-center text-bad"
                  >
                    <Trash2 aria-hidden className="size-5" />
                  </button>
                </Card>
              </li>
            ))}
          </ul>
        ) : null}

        <Card>
          <form action={criarFolga} className="flex flex-col gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-label font-semibold text-txt-2">Início</span>
              <input
                name="inicio"
                type="datetime-local"
                required
                defaultValue={paraInputLocal(new Date().toISOString())}
                className="h-12 rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 px-3 text-corpo tabular text-txt"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-label font-semibold text-txt-2">Fim</span>
              <input
                name="fim"
                type="datetime-local"
                required
                defaultValue={paraInputLocal(new Date().toISOString())}
                className="h-12 rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 px-3 text-corpo tabular text-txt"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-label font-semibold text-txt-2">Motivo (opcional)</span>
              <input
                name="motivo"
                className="h-12 rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 px-3 text-corpo text-txt"
              />
            </label>
            <Button type="submit" largura="cheia" carregando={pendente}>
              Adicionar
            </Button>
          </form>
        </Card>
      </section>
    </div>
  )
}
