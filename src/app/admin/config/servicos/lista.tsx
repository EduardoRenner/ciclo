'use client'

import { ArrowDown, ArrowUp, FlaskConical, Plus, Scissors } from 'lucide-react'
import Link from 'next/link'
import { useState, useTransition } from 'react'

import { reguaDoServico } from '@/core/ciclo/regua-do-servico'
import Badge from '@/components/ui/badge'
import { useVocabulario } from '@/components/shell/vocabulario'
import Button from '@/components/ui/button'
import Card from '@/components/ui/card'
import { fraseDaMargem } from '@/core/caixa/frase-da-margem'
import type { MargemDoServico } from '@/core/caixa/margem-do-servico'
import Chip from '@/components/ui/chip'
import EmptyState from '@/components/ui/empty-state'
import { formatarPreco, type ModeloDePreco } from '@/core/pricing/formatar'
import { duracao } from '@/lib/formato'

import FormularioServico, { type ServicoEditavel } from './formulario'

type Servico = ServicoEditavel & {
  deposit_bps: number
  active: boolean
  position: number
  /** A cadência MEDIDA (migration 0065). Nula até haver amostra — nunca sobrescreve `cycle_days`. */
  cycle_days_observado: number | null
  cycle_days_observado_amostra: number | null
}

export default function ListaServicos({
  iniciais,
  margens,
  podeVerLucro,
}: {
  iniciais: Servico[]
  /** `docs/50` L-06. Só dos serviços com atendimento suficiente para o número se sustentar. */
  margens: MargemDoServico[]
  podeVerLucro: boolean
}) {
  const margemPorId = new Map(margens.map((m) => [m.serviceId, m]))

  const vocabulario = useVocabulario()
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
    /*
      Serviço recém-criado não tem cadência medida, e `null` é a resposta certa — não zero. A régua
      dele é o palpite do catálogo até a clientela dar voltas suficientes para medir, e a tela diz
      exatamente isso ao não mostrar procedência nenhuma.
    */
    setServicos((atual) => [
      ...atual,
      { ...servico, active: true, position: atual.length, cycle_days_observado: null, cycle_days_observado_amostra: null },
    ])
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
            acao={<Button onClick={() => setEditando('novo')}>Cadastrar {vocabulario.servico}</Button>}
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
            <Card className="flex flex-col gap-2">
              <div className="flex items-center gap-3">
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
                  · volta em {reguaDoServico(s.cycle_days, s.cycle_days_observado, s.cycle_days_observado_amostra).diasEmUso}d
                </p>
                {/*
                  A procedência da régua, quando existe.

                  O Motor mede a cadência real da clientela deste salão e guarda AO LADO do palpite
                  de catálogo (migration 0065) — nunca por cima. Sem esta linha, o dono veria o
                  número mudar sozinho, que é o defeito que esta base persegue; com ela, ele vê o
                  que está em uso, de onde veio e quantas voltas sustentam a medida.
                */}
                {(() => {
                  const { procedencia } = reguaDoServico(s.cycle_days, s.cycle_days_observado, s.cycle_days_observado_amostra)
                  return procedencia ? <p className="mt-0.5 text-label text-txt-3">{procedencia}</p> : null
                })()}
                {/*
                  `docs/50` L-06: a razão ao lado do número.

                  Três estados, e o terceiro é o que a honestidade custa: com margem saudável a
                  linha mostra só o percentual, sem apontar vilão nenhum — apontar um em serviço que
                  vai bem fabrica um problema por serviço, todo dia, e alarme que sempre toca deixa
                  de ser lido. Serviço sem atendimento suficiente não aparece aqui de propósito:
                  `margemPorServico` já o descarta abaixo de três comandas fechadas, porque uma
                  coloração com desconto de amiga não define a margem de nada.
                */}
                {podeVerLucro
                  ? (() => {
                      const margem = margemPorId.get(s.id)
                      if (!margem) {
                        return <p className="mt-0.5 text-label text-txt-3">ainda sem atendimentos suficientes para calcular a margem</p>
                      }
                      const frase = fraseDaMargem(margem)
                      return (
                        <>
                          <p className={`tabular mt-0.5 text-label ${margem.lucroCents < 0 ? 'text-bad' : 'text-txt-3'}`}>
                            sobra {Math.round(margem.margemBps / 100)}% em {margem.atendimentos}{' '}
                            {margem.atendimentos === 1 ? 'atendimento' : 'atendimentos'}
                          </p>
                          {/*
                            `docs/53` A-02 — quando a vilã é a taxa, a frase vira link para
                            `/admin/mes` (fora deste `<button>`, logo abaixo do row: `<a>` dentro
                            de `<button>` é conteúdo interativo aninhado, inválido em HTML e com
                            comportamento de clique imprevisível entre navegadores). Nas outras
                            duas parcelas a frase fica como texto — comissão e material não têm,
                            ainda, uma tela de destino melhor que o catálogo em que já está.
                          */}
                          {frase && margem.parcelaDominante !== 'taxa' ? <p className="mt-0.5 text-label text-txt-2">{frase}</p> : null}
                        </>
                      )
                    })()
                  : null}

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
              </div>

              {/*
                `docs/53` A-02 — continuação do comentário na frase acima: o link mora aqui, fora
                do `<button>` de editar, na própria linha (mesma razão do `toque-48` que já
                separou o link de "Ficha de consumo" do nome do serviço).
              */}
              {podeVerLucro
                ? (() => {
                    const margem = margemPorId.get(s.id)
                    const frase = margem ? fraseDaMargem(margem) : null
                    if (!margem || margem.parcelaDominante !== 'taxa' || !frase) return null
                    return (
                      <Link href="/admin/mes" className="flex h-12 items-center text-label font-semibold text-acc-2">
                        {frase} Ver o que a maquininha levou no mês →
                      </Link>
                    )
                  })()
                : null}

              {/*
                A ficha de consumo ganhou tela em 2026-09-06 (`docs/49`). `service_products` existe
                desde a `0001` e é lida pela baixa de estoque no fechamento da comanda — e nunca
                teve como ser preenchida: nenhuma rota, nenhuma tela. Dois mecanismos prontos
                paravam aí, e desde a `I-02` um terceiro (o custo de material do serviço).

                Link sozinho na própria linha, e não ao lado do nome: `toque-48` em dois alvos que
                dividem linha de texto corrida deixa o segundo intocável (`CLAUDE.md`).
              */}
              <Link
                href={`/admin/config/servicos/${s.id}/ficha`}
                className="flex h-12 items-center gap-2 text-label font-semibold text-acc-2"
              >
                <FlaskConical aria-hidden className="size-4" />
                Ficha de consumo
              </Link>
            </Card>
          </li>
        ))}
      </ul>

      {sheet}
    </div>
  )
}
