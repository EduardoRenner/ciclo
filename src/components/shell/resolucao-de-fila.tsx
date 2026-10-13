'use client'

import { TriangleAlert } from 'lucide-react'
import { useEffect, useState } from 'react'

import Card from '@/components/ui/card'
import {
  assinarEventosDeFila,
  assumirFilaSemDono,
  definirSessaoDaFila,
  descartarFilaGuardada,
  drenarFilaPendente,
} from '@/lib/offline/api-client'
import { removerMutacao } from '@/lib/offline/db'

import type { ContextoDaSessao } from '@/core/offline/dono'
import type { Mutacao } from '@/core/offline/queue'

/**
 * TICKET-055, §4.2.5: "409 vira um card na UI com as duas versões. Nunca
 * descarta em silêncio." A versão do servidor exigiria buscar o recurso de
 * novo — fora do escopo desta primeira versão (ainda não existe leitura
 * genérica por URL); mostra a mutação que ficou pendente e deixa a pessoa
 * decidir entre tentar de novo (o servidor pode ter mudado) ou descartar.
 *
 * **A segunda metade da frase só chegou na auditoria de 2026-08-28.** O `409` virava card desde
 * sempre; o DESCARTE (qualquer 4xx definitivo — 400, 404, 422, 402) removia a mutação do
 * IndexedDB e emitia um evento que este componente usava apenas para **sumir com o card de
 * conflito**. Ninguém era avisado de nada. O caminho inteiro existia: a pessoa via
 * "Agendamento entrou na fila e será enviado quando a conexão voltar", ia embora, e o
 * agendamento simplesmente não existia — a mesma classe do descarte silencioso que apagou a fila
 * no logout. Agora descarte também vira card, com a diferença que importa: não há "tentar de
 * novo", porque o servidor recusou em definitivo. Só resta contar.
 */
/** O que a pessoa consegue fazer com o item — e é a única diferença entre os dois cards. */
type Descartada = { id: string; descricao: string }

/** "POST /api/v1/appointments" vira "Novo agendamento". Sem isto o aviso não diz o que se perdeu. */
function descrever(mutacao: Mutacao | null): string {
  if (!mutacao) return 'Uma alteração feita offline'
  const caminho = mutacao.url.split('?')[0] ?? ''
  if (caminho.includes('/appointments')) return mutacao.method === 'POST' ? 'Um agendamento criado sem conexão' : 'Uma alteração num agendamento'
  if (caminho.includes('/clients')) return mutacao.method === 'POST' ? 'Uma ficha cadastrada sem conexão' : 'Uma alteração numa ficha'
  if (caminho.includes('/tickets')) return 'Uma alteração numa comanda'
  return 'Uma alteração feita offline'
}

function alteracoes(n: number): string {
  return n === 1 ? '1 alteração' : `${n} alterações`
}

export default function ResolucaoDeFila({ sessao }: { sessao: ContextoDaSessao | null }) {
  const [conflitos, setConflitos] = useState<Mutacao[]>([])
  const [descartadas, setDescartadas] = useState<Descartada[]>([])
  const [guardadas, setGuardadas] = useState({ deOutros: 0, semDono: 0 })
  const [aviso, setAviso] = useState<string | null>(null)

  // APR-020: a sessão vem do servidor; a fila só manda o que é de quem está aqui.
  useEffect(() => {
    if (sessao) definirSessaoDaFila(sessao)
  }, [sessao?.userId, sessao?.tenantId]) // eslint-disable-line react-hooks/exhaustive-deps -- o objeto muda a cada render; a identidade é o par

  useEffect(() => {
    return assinarEventosDeFila((evento) => {
      if (evento.tipo === 'guardadas') setGuardadas({ deOutros: evento.deOutros, semDono: evento.semDono })
      if (evento.tipo === 'conflito') {
        setConflitos((atual) => (atual.some((m) => m.id === evento.mutacao.id) ? atual : [...atual, evento.mutacao]))
      }
      if (evento.tipo === 'sincronizada' || evento.tipo === 'descartada') {
        setConflitos((atual) => atual.filter((m) => m.id !== evento.id))
      }
      if (evento.tipo === 'descartada') {
        setDescartadas((atual) =>
          atual.some((d) => d.id === evento.id) ? atual : [...atual, { id: evento.id, descricao: descrever(evento.mutacao) }],
        )
      }
    })
  }, [])

  async function descartar(qual: 'deOutros' | 'semDono') {
    const quantas = await descartarFilaGuardada(qual).catch(() => null)
    setAviso(quantas === null ? 'Não consegui descartar agora. Tente de novo.' : `${alteracoes(quantas)} descartada${quantas === 1 ? '' : 's'} deste aparelho.`)
  }

  if (conflitos.length === 0 && descartadas.length === 0 && guardadas.deOutros === 0 && guardadas.semDono === 0 && !aviso) return null

  return (
    <div className="fixed inset-x-0 bottom-[calc(var(--tabbar-h)+env(safe-area-inset-bottom)+12px)] z-40 mx-auto flex w-full max-w-[560px] flex-col gap-2 px-[var(--gutter)]">
      {conflitos.map((m) => (
        <Card key={m.id} flutuante className="border-warn/50">
          <div className="flex items-start gap-2">
            <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-warn" />
            <div className="min-w-0 flex-1">
              <p className="text-secundario font-semibold text-txt">Uma alteração feita offline não pôde ser enviada</p>
              <p className="mt-0.5 text-label text-txt-2">O que mudou no servidor pode ter conflitado. Confira antes de tentar de novo.</p>
              <div className="mt-2 flex gap-3">
                <button type="button" onClick={() => drenarFilaPendente()} className="toque-48 -mx-2 px-2 text-label font-semibold text-acc-2 underline">
                  Tentar de novo
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await removerMutacao(m.id)
                    setConflitos((atual) => atual.filter((x) => x.id !== m.id))
                  }}
                  className="toque-48 -mx-2 px-2 text-label font-semibold text-txt-3 underline"
                >
                  Descartar
                </button>
              </div>
            </div>
          </div>
        </Card>
      ))}

      {guardadas.deOutros > 0 && (
        <Card flutuante className="border-warn/50">
          <p className="text-secundario font-semibold text-txt">Há {alteracoes(guardadas.deOutros)} de outra pessoa neste aparelho</p>
          <p className="mt-0.5 text-label text-txt-2">Foram feitas sem conexão por outro login. Só saem quando essa pessoa entrar de novo aqui.</p>
          <div className="mt-2 flex gap-3">
            <button type="button" onClick={() => descartar('deOutros')} className="toque-48 -mx-2 px-2 text-label font-semibold text-txt-3 underline">
              Descartar
            </button>
          </div>
        </Card>
      )}

      {guardadas.semDono > 0 && (
        <Card flutuante className="border-warn/50">
          <p className="text-secundario font-semibold text-txt">{alteracoes(guardadas.semDono)} guardada{guardadas.semDono === 1 ? '' : 's'} neste aparelho</p>
          <p className="mt-0.5 text-label text-txt-2">Foram feitas sem conexão antes da última atualização do app. Enviar com a sua conta?</p>
          <div className="mt-2 flex gap-3">
            <button type="button" onClick={() => void assumirFilaSemDono()} className="toque-48 -mx-2 px-2 text-label font-semibold text-acc-2 underline">
              Enviar
            </button>
            <button type="button" onClick={() => descartar('semDono')} className="toque-48 -mx-2 px-2 text-label font-semibold text-txt-3 underline">
              Descartar
            </button>
          </div>
        </Card>
      )}

      {aviso && (
        <Card flutuante>
          <p role="status" className="text-label text-txt-2">
            {aviso}
          </p>
          <button type="button" onClick={() => setAviso(null)} className="toque-48 -mx-2 mt-1 px-2 text-label font-semibold text-acc-2 underline">
            Entendi
          </button>
        </Card>
      )}

      {descartadas.map((d) => (
        <Card key={d.id} flutuante className="border-bad/50">
          <div className="flex items-start gap-2">
            <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-bad" />
            <div className="min-w-0 flex-1">
              <p className="text-secundario font-semibold text-txt">{d.descricao} não foi enviado</p>
              <p className="mt-0.5 text-label text-txt-2">
                O servidor recusou em definitivo. Reenviar daria o mesmo resultado. Refaça pela tela normal para ver o motivo.
              </p>
              <div className="mt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setDescartadas((atual) => atual.filter((x) => x.id !== d.id))}
                  className="toque-48 -mx-2 px-2 text-label font-semibold text-acc-2 underline"
                >
                  Entendi
                </button>
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}
