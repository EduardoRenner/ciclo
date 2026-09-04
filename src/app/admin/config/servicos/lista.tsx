'use client'

import { ArrowDown, ArrowUp, Plus, Scissors } from 'lucide-react'
import { useState, useTransition } from 'react'

import Badge from '@/components/ui/badge'
import Button from '@/components/ui/button'
import Card from '@/components/ui/card'
import Chip from '@/components/ui/chip'
import EmptyState from '@/components/ui/empty-state'
import { formatarPreco, type ModeloDePreco } from '@/core/pricing/formatar'
import { duracao } from '@/lib/formato'

import FormularioServico, { type ServicoEditavel } from './formulario'

type Servico = ServicoEditavel & {
  deposit_bps: number
  active: boolean
  position: number
}

export default function ListaServicos({ iniciais }: { iniciais: Servico[] }) {
  const [servicos, setServicos] = useState(iniciais)
  const [mostrarArquivados, setMostrarArquivados] = useState(false)
  const [salvando, iniciarSalvamento] = useTransition()
  const [erro, setErro] = useState<string | null>(null)
  const [editando, setEditando] = useState<Servico | 'novo' | null>(null)

  const visiveis = servicos.filter((s) => mostrarArquivados || s.active)

  function mover(indice: number, direcao: -1 | 1) {
    const alvo = indice + direcao
    if (alvo < 0 || alvo >= visiveis.length) return

    const nova = [...visiveis]
    const [movido] = nova.splice(indice, 1)
    nova.splice(alvo, 0, movido!)

    // Otimista: a ordem muda na tela antes da resposta. Se o servidor recusar,
    // voltamos ao que estava — a alternativa é a lista congelar a cada toque.
    const anterior = servicos
    setServicos(nova)
    setErro(null)

    iniciarSalvamento(async () => {
      try {
        const r = await fetch('/api/v1/services/reorder', {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID() },
          body: JSON.stringify({ ids: nova.map((s) => s.id) }),
        })
        if (!r.ok) {
          setServicos(anterior)
          setErro('Não consegui salvar a nova ordem. Tente de novo.')
        }
      } catch {
        // Rede caiu antes de chegar resposta — sem isto, o React 19 relança para o error
        // boundary da raiz e a tela inteira some (docs/21 §5.4).
        setServicos(anterior)
        setErro('Não consegui falar com o servidor. Confira a conexão e tente de novo.')
      }
    })
  }

  function aoSalvarNovo(servico: ServicoEditavel) {
    /*
     * `deposit_bps` vem do servidor junto com o resto — era fixado em 0 aqui de quando não havia
     * como definir sinal no formulário. Desde que passou a haver, sobrescrever fazia o selo
     * "Sinal X%" não aparecer num serviço recém-criado COM sinal, até alguém recarregar a página.
     */
    setServicos((atual) => [...atual, { ...servico, active: true, position: atual.length }])
  }

  function aoSalvarEditado(servico: ServicoEditavel) {
    setServicos((atual) => atual.map((s) => (s.id === servico.id ? { ...s, ...servico } : s)))
  }

  const sheet =
    editando === 'novo' ? (
      <FormularioServico aberto aoFechar={() => setEditando(null)} aoSalvar={aoSalvarNovo} />
    ) : editando ? (
      <FormularioServico aberto servico={editando} aoFechar={() => setEditando(null)} aoSalvar={aoSalvarEditado} />
    ) : null

  if (servicos.length === 0) {
    return (
      <>
        <Card className="p-0">
          <EmptyState
            icone={<Scissors aria-hidden className="size-6" />}
            titulo="Nenhum serviço ainda"
            descricao="Cadastre o primeiro para poder marcar horário e cobrar por ele."
            acao={<Button onClick={() => setEditando('novo')}>Cadastrar serviço</Button>}
          />
        </Card>
        {sheet}
      </>
    )
  }

  return (
    <div aria-busy={salvando}>
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex gap-2">
          <Chip ligado={!mostrarArquivados} onClick={() => setMostrarArquivados(false)}>
            Ativos
          </Chip>
          <Chip ligado={mostrarArquivados} onClick={() => setMostrarArquivados(true)}>
            Todos
          </Chip>
        </div>
        <Button variante="secondary" onClick={() => setEditando('novo')}>
          <Plus aria-hidden className="size-4" />
          Novo
        </Button>
      </div>

      {erro ? (
        <p role="alert" className="mb-3 text-secundario text-bad">
          {erro}
        </p>
      ) : null}

      <ul className="flex flex-col gap-2">
        {visiveis.map((s, i) => (
          <li key={s.id}>
            <Card className="flex items-center gap-3">
              <button type="button" onClick={() => setEditando(s)} className="min-w-0 flex-1 text-left">
                <p className="truncate text-corpo font-semibold">{s.name}</p>
                <p className="tabular mt-0.5 text-secundario text-txt-2">
                  {duracao(s.duration_min)} ·{' '}
                  {formatarPreco({
                    pricingModel: s.pricing_model as ModeloDePreco,
                    priceCents: s.price_cents,
                    hourlyRateCents: s.hourly_rate_cents,
                    halfDayPriceCents: s.half_day_price_cents,
                  })}{' '}
                  · volta em {s.cycle_days}d
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {!s.active ? <Badge estado="bad">Arquivado</Badge> : null}
                  {!s.bookable_online ? <Badge estado="warn">Fora do site</Badge> : null}
                  {s.deposit_bps > 0 ? <Badge estado="info">Sinal {s.deposit_bps / 100}%</Badge> : null}
                </div>
              </button>

              {/* Setas em vez de arrastar: §3.6 pede alvo de 48px, e drag-and-drop
                  num dedo só, em lista rolável, erra mais do que acerta. */}
              <div className="flex flex-col">
                <button
                  type="button"
                  aria-label={`Subir ${s.name}`}
                  disabled={i === 0 || salvando}
                  onClick={() => mover(i, -1)}
                  className="flex size-12 items-center justify-center rounded-[var(--radius-sm)] text-txt-2 disabled:opacity-30"
                >
                  <ArrowUp aria-hidden className="size-5" />
                </button>
                <button
                  type="button"
                  aria-label={`Descer ${s.name}`}
                  disabled={i === visiveis.length - 1 || salvando}
                  onClick={() => mover(i, 1)}
                  className="flex size-12 items-center justify-center rounded-[var(--radius-sm)] text-txt-2 disabled:opacity-30"
                >
                  <ArrowDown aria-hidden className="size-5" />
                </button>
              </div>
            </Card>
          </li>
        ))}
      </ul>

      {sheet}
    </div>
  )
}
