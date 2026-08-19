'use client'

import { ArrowLeft, Check, Send, Users } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import Button from '@/components/ui/button'
import Card from '@/components/ui/card'
import SectionHeader from '@/components/ui/section-header'
import { useToast } from '@/components/ui/toast'
import { dinheiro } from '@/lib/formato'
import { aplicarVariaveis, linkWhatsApp, precisaDeAgendamento } from '@/lib/mensagens'

import type { AlvoCampanha } from '@/server/services/crm'

type Segmento = { valor: string; rotulo: string; descricao: string }
type Modelo = { id: string; title: string; body: string }

export default function NovaCampanha({
  segmentos,
  publicoPorSegmento,
  modelos,
  nomeDoNegocio,
}: {
  segmentos: Segmento[]
  publicoPorSegmento: Record<string, AlvoCampanha[]>
  modelos: Modelo[]
  nomeDoNegocio: string
}) {
  const router = useRouter()
  const mostrarToast = useToast()
  const [registrando, iniciarRegistro] = useTransition()

  const [segmento, setSegmento] = useState<Segmento | null>(null)
  const [modelo, setModelo] = useState<Modelo | null>(null)
  /** Quem já foi aberto no WhatsApp — o controle de "até onde eu cheguei" na lista. */
  const [enviados, setEnviados] = useState<Set<string>>(new Set())

  const publico = segmento ? (publicoPorSegmento[segmento.valor] ?? []) : []

  function registrar() {
    if (!segmento || !modelo) return
    iniciarRegistro(async () => {
      const r = await fetch('/api/v1/campaigns', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID() },
        body: JSON.stringify({
          name: `${modelo.title} — ${segmento.rotulo}`,
          segment: segmento.valor,
          template: modelo.title,
          sentCount: enviados.size,
        }),
      })
      if (!r.ok) {
        mostrarToast({ tom: 'erro', titulo: 'Não consegui registrar a campanha' })
        return
      }
      mostrarToast({ tom: 'ok', titulo: 'Campanha registrada' })
      router.push('/admin/campanhas')
      router.refresh()
    })
  }

  return (
    <div className="pb-8">
      <header className="flex items-center gap-2 py-5">
        <Link
          href="/admin/campanhas"
          aria-label="Voltar"
          className="grid size-11 shrink-0 place-items-center rounded-[var(--radius-sm)] text-txt-2 transition-colors hover:bg-surface-2 hover:text-txt"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="text-titulo font-extrabold">Nova campanha</h1>
      </header>

      {/* 1 — quem */}
      <section>
        <SectionHeader icone={<Users className="size-3.5" />}>Para quem</SectionHeader>
        <div className="grid gap-2">
          {segmentos.map((s) => {
            const quantos = publicoPorSegmento[s.valor]?.length ?? 0
            const escolhido = segmento?.valor === s.valor
            return (
              <button
                key={s.valor}
                type="button"
                disabled={quantos === 0}
                onClick={() => {
                  setSegmento(s)
                  setEnviados(new Set())
                }}
                className="text-left disabled:opacity-40"
              >
                <Card
                  className={`transition-colors ${escolhido ? 'border-acc bg-acc-soft' : 'hover:border-acc/40 hover:bg-surface-2'}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-corpo font-semibold">{s.rotulo}</p>
                      <p className="text-secundario text-txt-2">{s.descricao}</p>
                    </div>
                    <span className="tabular shrink-0 text-corpo font-bold">{quantos}</span>
                  </div>
                </Card>
              </button>
            )
          })}
        </div>
      </section>

      {/* 2 — o quê */}
      {segmento ? (
        <section className="mt-7">
          <SectionHeader>O que mandar</SectionHeader>
          <div className="grid gap-2">
            {/* Modelo que fala de data/hora/serviço depende de um horário marcado — em disparo
                para 14 pessoas de uma vez não existe esse horário, e o texto sairia furado. */}
            {modelos
              .filter((m) => !precisaDeAgendamento(m.body))
              .map((m) => {
                const escolhido = modelo?.id === m.id
                return (
                  <button key={m.id} type="button" onClick={() => setModelo(m)} className="text-left">
                    <Card
                      className={`transition-colors ${escolhido ? 'border-acc bg-acc-soft' : 'hover:border-acc/40 hover:bg-surface-2'}`}
                    >
                      <p className="text-corpo font-semibold">{m.title}</p>
                      <p className="mt-1 line-clamp-2 text-secundario text-txt-2">
                        {aplicarVariaveis(m.body, { nome: publico[0]?.name ?? 'Cliente', negocio: nomeDoNegocio })}
                      </p>
                    </Card>
                  </button>
                )
              })}
          </div>
        </section>
      ) : null}

      {/* 3 — disparar, um toque por pessoa */}
      {segmento && modelo ? (
        <section className="mt-7">
          <SectionHeader>
            Enviar ({enviados.size}/{publico.length})
          </SectionHeader>
          <p className="mb-3 text-secundario text-txt-2">
            Cada toque abre o WhatsApp com a mensagem já escrita para aquela pessoa. Volte aqui e siga para a próxima.
          </p>

          <ul className="flex flex-col gap-2">
            {publico.map((alvo) => {
              const texto = aplicarVariaveis(modelo.body, {
                nome: alvo.name,
                negocio: nomeDoNegocio,
                valor: alvo.ltvCents > 0 ? dinheiro.format(alvo.ltvCents / 100) : null,
              })
              const link = linkWhatsApp(alvo.phoneE164, texto)
              const jaFoi = enviados.has(alvo.id)
              return (
                <li key={alvo.id}>
                  <a
                    href={link ?? '#'}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => setEnviados((s) => new Set(s).add(alvo.id))}
                    className="block"
                  >
                    <Card className={`transition-colors ${jaFoi ? 'opacity-55' : 'hover:border-acc/40 hover:bg-surface-2'}`}>
                      <div className="flex items-center gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-corpo font-semibold">{alvo.name}</p>
                          <p className="text-secundario text-txt-3">
                            {alvo.ltvCents > 0 ? `já gastou ${dinheiro.format(alvo.ltvCents / 100)}` : 'ainda não gastou'}
                          </p>
                        </div>
                        {jaFoi ? (
                          <Check className="size-5 shrink-0 text-ok" />
                        ) : (
                          <Send className="size-4 shrink-0 text-acc-2" />
                        )}
                      </div>
                    </Card>
                  </a>
                </li>
              )
            })}
          </ul>

          {enviados.size > 0 ? (
            <Button largura="cheia" carregando={registrando} onClick={registrar} className="mt-4">
              Registrar campanha ({enviados.size} {enviados.size === 1 ? 'enviada' : 'enviadas'})
            </Button>
          ) : null}
        </section>
      ) : null}
    </div>
  )
}
