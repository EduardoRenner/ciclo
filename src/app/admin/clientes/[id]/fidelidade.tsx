'use client'

import { Award, CreditCard, Minus, Plus, Repeat } from 'lucide-react'
import { useState, useTransition } from 'react'

import Button from '@/components/ui/button'
import Card from '@/components/ui/card'
import SectionHeader from '@/components/ui/section-header'
import Sheet from '@/components/ui/sheet'
import { useToast } from '@/components/ui/toast'
import { dinheiro } from '@/lib/formato'

import type { AssinaturaDoCliente, ExtratoPontos } from '@/server/services/fidelidade'

type Plano = { id: string; name: string; price_cents: number; sessions_per_month: number | null }

type Props = {
  clientId: string
  pontosIniciais: ExtratoPontos
  assinaturaInicial: AssinaturaDoCliente | null
  planos: Plano[]
}

/**
 * Pontos e clube de assinatura — o padrão do mercado de barbearia brasileiro (Trinks tem página
 * dedicada a isso). Os dois vivem juntos aqui porque resolvem a mesma pergunta do dono: "como eu
 * faço esse cliente voltar todo mês".
 */
export default function Fidelidade({ clientId, pontosIniciais, assinaturaInicial, planos }: Props) {
  const mostrarToast = useToast()
  const [pendente, iniciarTransicao] = useTransition()

  const [pontos, setPontos] = useState(pontosIniciais)
  const [assinatura, setAssinatura] = useState(assinaturaInicial)

  const [lancandoPontos, setLancandoPontos] = useState(false)
  const [valorPontos, setValorPontos] = useState('10')
  const [motivoPontos, setMotivoPontos] = useState('Atendimento')

  const [assinando, setAssinando] = useState(false)
  const [planoEscolhido, setPlanoEscolhido] = useState(planos[0]?.id ?? '')
  const [diaCobranca, setDiaCobranca] = useState('5')
  const [erro, setErro] = useState<string | null>(null)

  function lancar(sinal: 1 | -1) {
    setErro(null)
    const n = Number(valorPontos)
    if (!Number.isFinite(n) || n <= 0) {
      setErro('Digite um número de pontos válido.')
      return
    }
    iniciarTransicao(async () => {
      const r = await fetch(`/api/v1/clients/${clientId}/loyalty`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID() },
        body: JSON.stringify({ points: n * sinal, reason: motivoPontos || (sinal > 0 ? 'Pontos' : 'Resgate') }),
      })
      const json = (await r.json()) as { data?: { id: string }; error?: { message: string; details?: { fields?: Record<string, string> } } }
      if (!r.ok || !json.data) {
        const campo = json.error?.details?.fields ? Object.values(json.error.details.fields)[0] : undefined
        setErro(campo ?? json.error?.message ?? 'Não consegui lançar.')
        return
      }
      setPontos((atual) => ({
        saldo: atual.saldo + n * sinal,
        lancamentos: [{ id: json.data!.id, points: n * sinal, reason: motivoPontos, createdAt: new Date().toISOString() }, ...atual.lancamentos],
      }))
      mostrarToast({ tom: 'ok', titulo: sinal > 0 ? 'Pontos adicionados' : 'Pontos resgatados' })
      setLancandoPontos(false)
    })
  }

  function confirmarAssinatura() {
    setErro(null)
    const dia = Number(diaCobranca)
    if (!planoEscolhido) {
      setErro('Escolha um plano.')
      return
    }
    iniciarTransicao(async () => {
      const r = await fetch(`/api/v1/clients/${clientId}/subscription`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID() },
        body: JSON.stringify({ planId: planoEscolhido, billingDay: dia }),
      })
      const json = (await r.json()) as { error?: { message: string; details?: { fields?: Record<string, string> } } }
      if (!r.ok) {
        const campo = json.error?.details?.fields ? Object.values(json.error.details.fields)[0] : undefined
        setErro(campo ?? json.error?.message ?? 'Não consegui assinar.')
        return
      }
      const plano = planos.find((p) => p.id === planoEscolhido)!
      setAssinatura({
        id: crypto.randomUUID(),
        planName: plano.name,
        priceCents: plano.price_cents,
        sessionsPerMonth: plano.sessions_per_month,
        billingDay: dia,
        startedOn: new Date().toISOString().slice(0, 10),
      })
      mostrarToast({ tom: 'ok', titulo: 'Assinatura ativada' })
      setAssinando(false)
    })
  }

  function cancelar() {
    iniciarTransicao(async () => {
      const r = await fetch(`/api/v1/clients/${clientId}/subscription`, {
        method: 'DELETE',
        headers: { 'idempotency-key': crypto.randomUUID() },
      })
      if (!r.ok) {
        mostrarToast({ tom: 'erro', titulo: 'Não consegui cancelar' })
        return
      }
      setAssinatura(null)
      mostrarToast({ tom: 'ok', titulo: 'Assinatura cancelada' })
    })
  }

  return (
    <section className="mt-7">
      <SectionHeader icone={<Award className="size-3.5" />}>Fidelidade</SectionHeader>

      <div className="grid gap-2">
        <Card>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-overline font-semibold uppercase tracking-[0.13em] text-txt-3">Pontos</p>
              <p className="tabular mt-1 text-titulo font-extrabold">{pontos.saldo}</p>
            </div>
            <Button variante="secondary" onClick={() => setLancandoPontos(true)} motivoDesabilitado={undefined}>
              Lançar
            </Button>
          </div>
          {pontos.lancamentos.length > 0 ? (
            <ul className="mt-3 flex flex-col gap-1.5 border-t border-line pt-3">
              {pontos.lancamentos.slice(0, 4).map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-3 text-secundario">
                  <span className="min-w-0 truncate text-txt-2">{l.reason}</span>
                  <span className={`tabular shrink-0 font-semibold ${l.points > 0 ? 'text-ok' : 'text-txt-3'}`}>
                    {l.points > 0 ? '+' : ''}
                    {l.points}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </Card>

        {planos.length > 0 ? (
          <Card>
            {assinatura ? (
              <div className="flex items-start gap-3">
                <CreditCard className="mt-0.5 size-5 shrink-0 text-acc-2" />
                <div className="min-w-0 flex-1">
                  <p className="text-corpo font-semibold">{assinatura.planName}</p>
                  <p className="text-secundario text-txt-2">
                    {dinheiro.format(assinatura.priceCents / 100)}/mês
                    {assinatura.sessionsPerMonth ? ` · ${assinatura.sessionsPerMonth}x` : ' · ilimitado'} · cobra dia{' '}
                    {assinatura.billingDay}
                  </p>
                  <button
                    type="button"
                    onClick={cancelar}
                    disabled={pendente}
                    className="mt-2 text-label text-txt-3 underline-offset-2 hover:text-bad hover:underline"
                  >
                    Cancelar assinatura
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <Repeat className="size-5 shrink-0 text-txt-3" />
                  <p className="text-corpo">Sem assinatura</p>
                </div>
                <Button variante="secondary" onClick={() => setAssinando(true)}>
                  Assinar plano
                </Button>
              </div>
            )}
          </Card>
        ) : null}
      </div>

      <Sheet aberto={lancandoPontos} aoFechar={(a) => !a && setLancandoPontos(false)} titulo="Lançar pontos">
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-label font-semibold text-txt-2">Quantidade</span>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              value={valorPontos}
              onChange={(e) => setValorPontos(e.target.value)}
              className="h-12 rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 px-3 text-corpo tabular text-txt"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-label font-semibold text-txt-2">Motivo</span>
            <input
              value={motivoPontos}
              onChange={(e) => setMotivoPontos(e.target.value)}
              placeholder="Corte de hoje, resgate de brinde..."
              className="h-12 rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 px-3 text-corpo text-txt"
            />
          </label>
          {erro ? (
            <p role="alert" className="text-secundario text-bad">
              {erro}
            </p>
          ) : null}
          <div className="grid grid-cols-2 gap-3">
            <Button variante="secondary" carregando={pendente} onClick={() => lancar(-1)}>
              <Minus className="size-4" />
              Resgatar
            </Button>
            <Button carregando={pendente} onClick={() => lancar(1)}>
              <Plus className="size-4" />
              Adicionar
            </Button>
          </div>
        </div>
      </Sheet>

      <Sheet aberto={assinando} aoFechar={(a) => !a && setAssinando(false)} titulo="Assinar plano">
        <div className="flex flex-col gap-3">
          <div className="grid gap-2">
            {planos.map((p) => (
              <button key={p.id} type="button" onClick={() => setPlanoEscolhido(p.id)} className="text-left">
                <Card className={planoEscolhido === p.id ? 'border-acc bg-acc-soft' : ''}>
                  <p className="text-corpo font-semibold">{p.name}</p>
                  <p className="text-secundario text-txt-2">
                    {dinheiro.format(p.price_cents / 100)}/mês · {p.sessions_per_month ? `${p.sessions_per_month}x` : 'ilimitado'}
                  </p>
                </Card>
              </button>
            ))}
          </div>
          <label className="flex flex-col gap-1">
            <span className="text-label font-semibold text-txt-2">Dia da cobrança</span>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={28}
              value={diaCobranca}
              onChange={(e) => setDiaCobranca(e.target.value)}
              className="h-12 rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 px-3 text-corpo tabular text-txt"
            />
          </label>
          {erro ? (
            <p role="alert" className="text-secundario text-bad">
              {erro}
            </p>
          ) : null}
          <Button largura="cheia" carregando={pendente} onClick={confirmarAssinatura}>
            Confirmar assinatura
          </Button>
        </div>
      </Sheet>
    </section>
  )
}
