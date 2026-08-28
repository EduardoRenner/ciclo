'use client'

import { classificarResposta, drenarFila, type Mutacao, type ResultadoEnvio } from '@/core/offline/queue'

import { listarMutacoes, removerMutacao, salvarMutacao } from './db'

/**
 * TICKET-055, `§4.2`. Camada fina de browser sobre `drenarFila` (puro,
 * testado em `tests/unit/core/offline-queue.test.ts`): decide quando
 * enfileirar, dispara o `fetch` de verdade e avisa a UI por evento — em vez
 * de a UI ficar perguntando "já sincronizou?" o tempo todo.
 *
 * **Limite de verificação**: depende de `navigator`/`fetch`/IndexedDB de
 * browser de verdade — sem ambiente jsdom neste projeto (`vitest.config.ts`
 * usa `environment: 'node'`), não dá para testar aqui. Verificado manualmente
 * via DevTools → Network → Offline, registrado em `docs/DECISOES.md`.
 */

export type EventoFila =
  | { tipo: 'sincronizada'; id: string }
  /** Leva a `mutacao` junto: sem ela a UI não tem o que mostrar, e o descarte volta a ser mudo. */
  | { tipo: 'descartada'; id: string; mutacao: Mutacao | null }
  | { tipo: 'conflito'; mutacao: Mutacao }

const assinantes = new Set<(evento: EventoFila) => void>()

export function assinarEventosDeFila(fn: (evento: EventoFila) => void): () => void {
  assinantes.add(fn)
  return () => assinantes.delete(fn)
}

function emitir(evento: EventoFila): void {
  for (const fn of assinantes) fn(evento)
}

async function enviarMutacao(mutacao: Mutacao): Promise<ResultadoEnvio> {
  try {
    const resposta = await fetch(mutacao.url, {
      method: mutacao.method,
      headers: { 'content-type': 'application/json', 'idempotency-key': mutacao.id },
      body: mutacao.method === 'DELETE' ? undefined : JSON.stringify(mutacao.body),
    })
    return { kind: classificarResposta(resposta.status) }
  } catch {
    return { kind: 'retry' } // rede fora do ar — `TypeError: Failed to fetch`
  }
}

/** Roda a fila inteira uma vez. Conflito FICA na fila (§4.2.5: "nunca descarta em silêncio") — só sincronizada/descartada saem do IndexedDB. */
export async function drenarFilaPendente(): Promise<void> {
  const fila = await listarMutacoes()
  if (fila.length === 0) return

  const resultado = await drenarFila(fila, enviarMutacao)

  for (const id of resultado.sincronizadas) {
    await removerMutacao(id)
    emitir({ tipo: 'sincronizada', id })
  }
  for (const id of resultado.descartadas) {
    // A mutação é lida ANTES de sair do IndexedDB: depois do `removerMutacao` não há mais o que
    // mostrar, e o aviso viraria "alguma coisa falhou".
    const mutacao = fila.find((m) => m.id === id) ?? null
    await removerMutacao(id)
    emitir({ tipo: 'descartada', id, mutacao })
  }
  for (const id of resultado.conflitos) {
    const mutacao = fila.find((m) => m.id === id)
    if (mutacao) emitir({ tipo: 'conflito', mutacao })
  }
}

let tentativaEmAndamento = false
const ESPERAS_RETRY_MS = [2_000, 5_000, 15_000]

async function tentarNovamenteComBackoff(): Promise<void> {
  if (tentativaEmAndamento) return
  tentativaEmAndamento = true
  try {
    for (const espera of ESPERAS_RETRY_MS) {
      await new Promise((resolve) => setTimeout(resolve, espera))
      if (navigator.onLine) await drenarFilaPendente()
    }
  } finally {
    tentativaEmAndamento = false
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    void drenarFilaPendente()
  })
}

export class MutacaoRecusada extends Error {
  constructor(public readonly motivo: 'conflict' | 'discarded') {
    super(motivo)
  }
}

export type ResultadoApiFetch = { queued: boolean }

/**
 * Substituto do `fetch()` cru nos formulários que precisam sobreviver ao
 * 4G ruim de um subsolo (§10). Online, tenta na hora — se a rede falhar no
 * meio (ou vier 5xx/429), enfileira em vez de perder a mutação.
 */
export async function apiFetch(url: string, opcoes: { method: 'POST' | 'PATCH' | 'DELETE'; body?: unknown }): Promise<ResultadoApiFetch> {
  const mutacao: Mutacao = {
    id: crypto.randomUUID(),
    method: opcoes.method,
    url,
    body: opcoes.body ?? null,
    createdAt: new Date().toISOString(),
  }

  if (!navigator.onLine) {
    await salvarMutacao(mutacao)
    return { queued: true }
  }

  const resultado = await enviarMutacao(mutacao)
  if (resultado.kind === 'ok') return { queued: false }
  if (resultado.kind === 'conflict') throw new MutacaoRecusada('conflict')
  if (resultado.kind === 'discard') throw new MutacaoRecusada('discarded')

  await salvarMutacao(mutacao)
  void tentarNovamenteComBackoff()
  return { queued: true }
}
