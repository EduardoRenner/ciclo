'use client'

import { useEffect, useMemo, useState } from 'react'

import Button from '@/components/ui/button'
import Card from '@/components/ui/card'
import { chaveDaFila, proximoDaFila } from '@/core/ciclo/fila-de-chamadas'
import { ROTULO_DA_CLASSE, ROTULO_DO_PERFIL } from '@/core/crm/nota-do-cliente'
import { dinheiro } from '@/lib/formato'
import { linkWhatsApp, linkWhatsAppCompartilhar, textoDeVolta } from '@/lib/mensagens'

import type { ItemRecuperar } from '@/server/services/recuperar-receita'

/**
 * `docs/95` E2 — a fila de chamadas: um cliente por vez, na ordem que o dono escolheu. "Chamar"
 * abre o WhatsApp DO DONO com o texto e o link de agendamento; nada sai sozinho.
 *
 * Quem já foi tratado hoje (chamado, "já falei" ou pulado) fica guardado no próprio aparelho, por
 * dia: é conveniência de quem está chamando, não dado do salão. Navegador sem armazenamento (aba
 * anônima, dado bloqueado) só perde isso ao recarregar; a fila continua funcionando.
 */
function chaveDoDia(): string {
  return `ciclo:fila-de-chamadas:${new Date().toLocaleDateString('sv-SE')}`
}

function lerTratados(): Set<string> {
  try {
    const bruto = window.localStorage.getItem(chaveDoDia())
    return new Set(bruto ? (JSON.parse(bruto) as string[]) : [])
  } catch {
    return new Set()
  }
}

function gravarTratados(tratados: Set<string>) {
  try {
    window.localStorage.setItem(chaveDoDia(), JSON.stringify([...tratados]))
  } catch {
    // Sem armazenamento a fila só não lembra depois de recarregar.
  }
}

export default function FilaDeChamadas({
  itens,
  anotarChamada,
  pararDeChamar,
  sair,
}: {
  itens: ItemRecuperar[]
  /** Anota a chamada para o Motor medir a volta (mesma rota do "Chamar" da lista). */
  anotarChamada: (item: ItemRecuperar) => Promise<void>
  /** Marca o opt-out do WhatsApp da pessoa (`docs/95` E2.4). Devolve se gravou. */
  pararDeChamar: (item: ItemRecuperar) => Promise<boolean>
  sair: () => void
}) {
  const [tratados, setTratados] = useState<Set<string>>(() => new Set())
  // Pergunta antes de gravar: "não chamar mais" tira a pessoa da fila e do Chamar até alguém desfazer na ficha.
  const [confirmandoParar, setConfirmandoParar] = useState(false)
  const [parando, setParando] = useState(false)
  useEffect(() => setTratados(lerTratados()), [])

  const chamaveis = useMemo(() => itens.filter((i) => !i.optOut), [itens])
  const atual = proximoDaFila(chamaveis, tratados)
  const feitos = chamaveis.filter((i) => tratados.has(chaveDaFila(i))).length

  function tratar(item: ItemRecuperar) {
    setConfirmandoParar(false)
    const proximo = new Set(tratados)
    proximo.add(chaveDaFila(item))
    setTratados(proximo)
    gravarTratados(proximo)
  }

  return (
    <section aria-label="Fila de chamadas" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <p aria-live="polite" className="text-secundario text-txt-2">
          {atual ? `${feitos + 1} de ${chamaveis.length} na fila de hoje` : `${chamaveis.length} de ${chamaveis.length} tratados hoje`}
        </p>
        <button type="button" onClick={sair} className="toque-48 h-10 px-2 text-label font-semibold text-acc-2">
          Ver a lista
        </button>
      </div>

      {atual ? (
        <Card className="flex flex-col gap-4">
          <div>
            <p className="text-titulo font-bold">{atual.name}</p>
            <p className="text-secundario text-txt-2">
              {atual.serviceName} · {atual.lateDays > 0 ? `${atual.lateDays}d de atraso` : 'na janela'}
            </p>
            <p className="mt-1 text-secundario text-txt-2">
              {atual.valueCents === 0 && atual.profitCents === 0
                ? 'Sem valor avulso'
                : `${dinheiro.format(atual.valueCents / 100)} · ${dinheiro.format(atual.profitCents / 100)} de lucro`}
              {atual.nota != null && atual.classe ? ` · ${ROTULO_DA_CLASSE[atual.classe]} (${atual.nota})` : ''}
              {atual.perfil ? ` · ${ROTULO_DO_PERFIL[atual.perfil]}` : ''}
            </p>
          </div>

          <a
            href={
              linkWhatsApp(atual.phone, textoDeVolta({ nome: atual.name, servico: atual.serviceName, link: atual.linkVolta, variante: atual.variante })) ??
              linkWhatsAppCompartilhar(textoDeVolta({ nome: atual.name, servico: atual.serviceName, link: atual.linkVolta, variante: atual.variante }))
            }
            target="_blank"
            rel="noreferrer"
            onClick={() => {
              void anotarChamada(atual)
              tratar(atual)
            }}
            className="flex h-12 items-center justify-center rounded-[var(--radius-sm)] bg-acc text-corpo font-semibold text-on-acc shadow-elevado transition active:scale-[.98]"
          >
            Chamar pelo WhatsApp
          </a>

          <div className="grid grid-cols-2 gap-2">
            <Button
              variante="secondary"
              onClick={() => {
                void anotarChamada(atual)
                tratar(atual)
              }}
            >
              Já falei
            </Button>
            <Button variante="secondary" onClick={() => tratar(atual)}>
              Pular hoje
            </Button>
          </div>

          {confirmandoParar ? (
            <div role="group" aria-label="Confirmar não chamar mais" className="flex flex-col gap-2 rounded-[var(--radius-sm)] border border-line-2 p-3">
              <p className="text-secundario text-txt">
                {`${atual.name} sai da fila e do Chamar. Dá para desfazer na ficha.`}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variante="danger"
                  carregando={parando}
                  onClick={async () => {
                    setParando(true)
                    const gravou = await pararDeChamar(atual)
                    setParando(false)
                    if (gravou) tratar(atual)
                  }}
                >
                  Confirmar
                </Button>
                <Button variante="secondary" onClick={() => setConfirmandoParar(false)}>
                  Voltar
                </Button>
              </div>
            </div>
          ) : (
            <Button variante="ghost" onClick={() => setConfirmandoParar(true)}>
              Pediu para não ser chamado
            </Button>
          )}
        </Card>
      ) : (
        <Card>
          <p className="text-corpo font-semibold">Fila de hoje concluída.</p>
          <p className="mt-1 text-secundario text-txt-2">
            Quem você chamou aparece em &ldquo;O Motor de Ciclo trouxe&rdquo; quando marcar pelo link.
          </p>
        </Card>
      )}
    </section>
  )
}
