'use client'

import { AlertTriangle } from 'lucide-react'
import { useEffect, useState } from 'react'

import Card from '@/components/ui/card'
import { assinarEventosDeFila, drenarFilaPendente } from '@/lib/offline/api-client'
import { removerMutacao } from '@/lib/offline/db'

import type { Mutacao } from '@/core/offline/queue'

/**
 * TICKET-055, §4.2.5: "409 vira um card na UI com as duas versões. Nunca
 * descarta em silêncio." A versão do servidor exigiria buscar o recurso de
 * novo — fora do escopo desta primeira versão (ainda não existe leitura
 * genérica por URL); mostra a mutação que ficou pendente e deixa a pessoa
 * decidir entre tentar de novo (o servidor pode ter mudado) ou descartar.
 */
export default function ResolucaoDeFila() {
  const [conflitos, setConflitos] = useState<Mutacao[]>([])

  useEffect(() => {
    return assinarEventosDeFila((evento) => {
      if (evento.tipo === 'conflito') {
        setConflitos((atual) => (atual.some((m) => m.id === evento.mutacao.id) ? atual : [...atual, evento.mutacao]))
      }
      if (evento.tipo === 'sincronizada' || evento.tipo === 'descartada') {
        setConflitos((atual) => atual.filter((m) => m.id !== evento.id))
      }
    })
  }, [])

  if (conflitos.length === 0) return null

  return (
    <div className="fixed inset-x-0 bottom-[calc(var(--tabbar-h)+env(safe-area-inset-bottom)+12px)] z-40 mx-auto flex w-full max-w-[560px] flex-col gap-2 px-[var(--gutter)]">
      {conflitos.map((m) => (
        <Card key={m.id} flutuante className="border-warn/50">
          <div className="flex items-start gap-2">
            <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 text-warn" />
            <div className="min-w-0 flex-1">
              <p className="text-secundario font-semibold text-txt">Uma alteração feita offline não pôde ser enviada</p>
              <p className="mt-0.5 text-label text-txt-2">O que mudou no servidor pode ter conflitado. Confira antes de tentar de novo.</p>
              <div className="mt-2 flex gap-3">
                <button type="button" onClick={() => drenarFilaPendente()} className="toque-48 text-label font-semibold text-acc-2 underline">
                  Tentar de novo
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await removerMutacao(m.id)
                    setConflitos((atual) => atual.filter((x) => x.id !== m.id))
                  }}
                  className="toque-48 text-label font-semibold text-txt-3 underline"
                >
                  Descartar
                </button>
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}
