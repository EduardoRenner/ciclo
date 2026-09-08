'use client'

import { Check, Send, Users } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import Button from '@/components/ui/button'
import Card from '@/components/ui/card'
import PageHeader from '@/components/ui/page-header'
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

  /**
   * Modelo que fala de data/hora/serviço depende de um horário marcado — em disparo para 14
   * pessoas de uma vez esse horário não existe, e o texto sairia "no dia às ." na cara delas.
   */
  const modelosParaLote = modelos.filter((m) => !precisaDeAgendamento(m.body))

  function registrar() {
    if (!segmento || !modelo) return
    iniciarRegistro(async () => {
      try {
        const r = await fetch('/api/v1/campaigns', {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID() },
          body: JSON.stringify({
            name: `${modelo.title} · ${segmento.rotulo}`,
            segment: segmento.valor,
            template: modelo.title,
            clientIds: [...enviados],
          }),
        })
        if (!r.ok) {
          /*
            A rota devolve o motivo com nome e caminho ("Isso faz parte do plano Essencial."), e
            este toast descartava o corpo inteiro — a pessoa via só "não consegui" e não tinha
            como saber se era plano, rede ou dado inválido. Ler a mensagem do servidor é o que
            transforma um beco numa instrução.
          */
          const json = (await r.json().catch(() => null)) as { error?: { message?: string } } | null
          mostrarToast({
            tom: 'erro',
            titulo: 'Não consegui registrar a campanha',
            descricao: json?.error?.message ?? 'Confira a conexão e tente de novo.',
          })
          return
        }
        mostrarToast({ tom: 'ok', titulo: 'Campanha registrada' })
        router.push('/admin/campanhas')
        router.refresh()
      } catch {
        // Rede caiu antes de chegar resposta — sem isto, o React 19 relança para o error
        // boundary da raiz e a tela inteira some (docs/21 §5.4). Os toques já dados no
        // WhatsApp (`enviados`) continuam intactos no estado — só o registro falhou.
        mostrarToast({ tom: 'erro', titulo: 'Não consegui falar com o servidor', descricao: 'Confira a conexão e tente de novo.' })
      }
    })
  }

  return (
    <div className="pb-8">
      {/* O voltar mora na Topbar desde o redesenho — dois numa tela só confundem. */}
      <PageHeader titulo="Nova campanha" />

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
                // §4: nunca desabilitar sem explicar. O motivo aparece na própria linha (texto
                // abaixo) e no `title`, para quem chega pelo leitor de tela ou pelo mouse.
                title={quantos === 0 ? 'Ninguém se encaixa nesse grupo agora.' : undefined}
                onClick={() => {
                  setSegmento(s)
                  setEnviados(new Set())
                }}
                className="text-left disabled:opacity-60"
              >
                <Card
                  className={`transition-colors ${escolhido ? 'border-acc bg-acc-soft' : quantos > 0 ? 'hover:border-acc/40 hover:bg-surface-2' : ''}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-corpo font-semibold">{s.rotulo}</p>
                      <p className="text-secundario text-txt-2">
                        {quantos === 0 ? 'Ninguém se encaixa nesse grupo agora.' : s.descricao}
                      </p>
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
            {/* Seção vazia sem explicação parece tela quebrada: se todo modelo do negócio fala
                de data/hora, não sobra nada para disparo em lote e é preciso dizer o porquê. */}
            {modelosParaLote.length === 0 ? (
              <Card>
                <p className="text-corpo">Nenhum modelo serve para disparo em lote.</p>
                <p className="mt-1 text-secundario text-txt-2">
                  Todos os seus modelos falam de data, hora ou serviço, e isso só existe quando há um horário marcado.
                </p>
                <Link href="/admin/config/mensagens" className="mt-2 inline-block text-secundario font-semibold text-acc-2">
                  Criar um modelo sem data
                </Link>
              </Card>
            ) : null}
            {modelosParaLote.map((m) => {
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
                          {/*
                            Era "já gastou R$ X" / "ainda não gastou". Duas imprecisões numa linha:
                            o valor vem de `clients.ltv_cents`, que soma o PREÇO DE TABELA dos
                            atendimentos concluídos — não enxerga desconto dado na comanda nem item
                            extra — e é escrito só pelo cron diário. Como sinal para decidir quem
                            chamar de volta, os dois limites são aceitáveis: é ranking, não fatura.
                            Já "gastou" não era: afirma o que uma pessoa com nome na tela pagou.

                            "ainda não gastou" virou "ainda sem atendimento", que descreve o
                            REGISTRO em vez da pessoa — com o cron atrasado, uma cliente atendida
                            hoje ainda aparece zerada, e dizer que ela "não gastou" seria errado
                            sobre ela; dizer que não há atendimento registrado é sempre verdade.
                          */}
                          <p className="text-secundario text-txt-3">
                            {alvo.ltvCents > 0
                              ? `${dinheiro.format(alvo.ltvCents / 100)} em atendimentos`
                              : 'ainda sem atendimento'}
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
