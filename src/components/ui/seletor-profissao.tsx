'use client'

import { useMemo, useState } from 'react'

import { SLUG_PROFISSAO_GENERICA } from '@/core/profissoes'
import { semAcento } from '@/core/text/normalizar'

import Input from './input'

export type Profissao = { id: string; slug: string; nome: string; grupo: string; sinonimos: string[] }

/**
 * Extraído de `onboarding/formulario.tsx` (era duplicado ali e no quiz de `/cadastro`) — mesma
 * busca por `sinonimos`, mesmo fallback pra profissão genérica quando não acha nada na lista,
 * mesmo `toque-48` nos itens. Ver a razão de cada detalhe no histórico desse arquivo.
 */
export default function SeletorProfissao({
  profissoes,
  professionId,
  aoEscolher,
}: {
  profissoes: Profissao[]
  professionId: string | null
  aoEscolher: (id: string) => void
}) {
  const [busca, setBusca] = useState('')

  const escolhida = profissoes.find((p) => p.id === professionId) ?? null
  const generica = profissoes.find((p) => p.slug === SLUG_PROFISSAO_GENERICA) ?? null

  const filtradas = useMemo(() => {
    const termo = semAcento(busca)
    if (!termo) return profissoes
    return profissoes.filter((p) => semAcento(p.nome).includes(termo) || p.sinonimos.some((s) => semAcento(s).includes(termo)))
  }, [busca, profissoes])

  if (escolhida) {
    return (
      <button
        type="button"
        onClick={() => aoEscolher('')}
        className="flex h-12 items-center justify-between rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 px-4 text-left text-corpo font-semibold text-txt"
      >
        {escolhida.nome}
        <span className="text-secundario font-normal text-txt-3">Trocar</span>
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <Input rotulo="Sua profissão" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Ex.: barbeiro, diarista, personal…" autoFocus />
      <div className="flex max-h-[220px] flex-col gap-1 overflow-y-auto rounded-[var(--radius-sm)] border border-line-2 p-1">
        {filtradas.length === 0 ? (
          <div className="flex flex-col gap-2 p-3">
            <p className="text-secundario text-txt-3">Não achamos “{busca.trim()}” na lista.</p>
            {generica ? (
              <button
                type="button"
                onClick={() => aoEscolher(generica.id)}
                className="toque-48 flex h-11 shrink-0 items-center rounded-[var(--radius-sm)] bg-surface-2 px-3 text-left text-corpo font-semibold text-txt transition-colors hover:bg-surface-3"
              >
                Seguir como {generica.nome}
              </button>
            ) : null}
            <p className="text-label text-txt-3">A profissão só escolhe o ponto de partida. Seus serviços e horários você configura do seu jeito depois.</p>
          </div>
        ) : (
          filtradas.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => aoEscolher(p.id)}
              className="toque-48 flex h-11 shrink-0 items-center rounded-[var(--radius-sm)] px-3 text-left text-corpo text-txt transition-colors hover:bg-surface-2"
            >
              {p.nome}
            </button>
          ))
        )}
      </div>
    </div>
  )
}
