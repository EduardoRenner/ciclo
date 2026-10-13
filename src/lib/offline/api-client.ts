'use client'

import { ehEscritaJuridica } from '@/core/advocacia/falha-de-escrita'
import { separarFilaPorDono, type ContextoDaSessao } from '@/core/offline/dono'
import { classificarResposta, drenarFila, proximaTentativaMs, type Mutacao, type ResultadoEnvio } from '@/core/offline/queue'

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
  /**
   * T4 (docs/64 §0.4 item 2): o único sinal de que uma mutação acabou de ENTRAR na fila — as
   * outras três só disparam quando ela SAI. Sem isto, `IndicadorDeConexao` só saberia que existe
   * fila depois de tentar drenar, nunca no instante em que a pessoa perdeu conexão no meio de um
   * salvamento.
   */
  | { tipo: 'enfileirada' }
  /**
   * APR-020: itens que ficaram guardados nesta passada porque não são da sessão atual — de outra
   * pessoa (ou outro negócio) neste aparelho, ou do formato antigo, sem dono.
   */
  | { tipo: 'guardadas'; deOutros: number; semDono: number }

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

let drenagemEmAndamento = false

/**
 * APR-020: quem está usando o painel agora. A casca do painel define ao montar (`ResolucaoDeFila`),
 * a partir da sessão validada no servidor. Sem ela a fila não drena: não dá para saber em nome de
 * quem cada item sairia.
 */
let sessaoAtual: ContextoDaSessao | null = null

export function definirSessaoDaFila(sessao: ContextoDaSessao): void {
  sessaoAtual = sessao
}

/**
 * Roda a fila inteira uma vez. Conflito FICA na fila (§4.2.5: "nunca descarta em silêncio") — só
 * sincronizada/descartada saem do IndexedDB.
 *
 * `drenagemEmAndamento` evita duas passadas concorrentes: o listener de `online` (abaixo) e
 * `tentarNovamenteComBackoff` chamam esta função por caminhos INDEPENDENTES, e o mutex que já
 * existia (`tentativaEmAndamento`) só protegia o LAÇO de retry, não a drenagem em si — reconectar
 * bem no instante em que um retry agendado também dispara faria as duas passadas lerem a MESMA
 * fila do IndexedDB antes de qualquer uma remover algo, e mandar cada mutação pendente duas vezes
 * ao mesmo tempo. O `Idempotency-Key` do servidor deve absorver o reenvio, mas depender só disso
 * aqui seria a mesma classe de "duas fontes da mesma verdade" que este projeto evita — o cliente
 * não devia CRIAR a corrida só porque o servidor pode aguentar.
 */
export async function drenarFilaPendente(): Promise<void> {
  if (drenagemEmAndamento) return
  drenagemEmAndamento = true
  try {
    if (!sessaoAtual) return
    // APR-020: o filtro por dono vem ANTES de qualquer envio — inclusive o reenvio de 401/403 (R-31).
    const { minhas: fila, deOutros, semDono } = separarFilaPorDono(await listarMutacoes(), sessaoAtual)
    emitir({ tipo: 'guardadas', deOutros: deOutros.length, semDono: semDono.length })
    if (fila.length === 0) return

    const resultado = await drenarFila(fila, enviarMutacao)
    // APR-021: sobrou fila por rede/5xx — tenta de novo sozinha, com teto, em vez de esperar o
    // próximo evento `online` (que não vem se a rede já voltou antes de o app abrir).
    if (resultado.pendentes.length > 0) void tentarNovamenteComBackoff()

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
  } finally {
    drenagemEmAndamento = false
  }
}

let tentativaEmAndamento = false
/** Passadas seguidas sem esvaziar a fila antes de parar e esperar o próximo `online`/abrir o app. */
const TENTATIVAS_SEGUIDAS = 12

async function minhasPendentes(): Promise<number> {
  if (!sessaoAtual) return 0
  return separarFilaPorDono(await listarMutacoes(), sessaoAtual).minhas.length
}

async function tentarNovamenteComBackoff(): Promise<void> {
  if (tentativaEmAndamento) return
  tentativaEmAndamento = true
  try {
    for (let tentativa = 0; tentativa < TENTATIVAS_SEGUIDAS; tentativa++) {
      await new Promise((resolve) => setTimeout(resolve, proximaTentativaMs(tentativa)))
      if (navigator.onLine) await drenarFilaPendente()
      if ((await minhasPendentes()) === 0) return
    }
  } finally {
    tentativaEmAndamento = false
  }
}

/** APR-020: os itens sem dono (formato antigo) passam a ser da sessão atual, e a fila drena. */
export async function assumirFilaSemDono(): Promise<void> {
  if (!sessaoAtual) return
  const { semDono } = separarFilaPorDono(await listarMutacoes(), sessaoAtual)
  for (const mutacao of semDono) await salvarMutacao({ ...mutacao, dono: sessaoAtual })
  await drenarFilaPendente()
}

/**
 * APR-020: descarta o que não é desta sessão. Devolve QUANTOS — quem chama conta para a pessoa
 * (o `catch` que descarta tem que avisar, regra da casa).
 */
export async function descartarFilaGuardada(qual: 'deOutros' | 'semDono'): Promise<number> {
  if (!sessaoAtual) return 0
  const alvo = separarFilaPorDono(await listarMutacoes(), sessaoAtual)[qual]
  for (const mutacao of alvo) await removerMutacao(mutacao.id)
  emitir({ tipo: 'guardadas', ...contagemGuardada(await listarMutacoes()) })
  return alvo.length
}

function contagemGuardada(fila: Mutacao[]): { deOutros: number; semDono: number } {
  if (!sessaoAtual) return { deOutros: 0, semDono: 0 }
  const { deOutros, semDono } = separarFilaPorDono(fila, sessaoAtual)
  return { deOutros: deOutros.length, semDono: semDono.length }
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
  // docs/101 §3.6: prazo gravado horas depois, com a data que valia quando a pessoa digitou, é pior que
  // não gravar. Escrita jurídica vai por `escreverJuridico`, que avisa em vez de enfileirar.
  if (ehEscritaJuridica(url)) throw new Error(`escrita jurídica não entra na fila offline: ${url}`)
  const mutacao: Mutacao = {
    id: crypto.randomUUID(),
    method: opcoes.method,
    url,
    body: opcoes.body ?? null,
    createdAt: new Date().toISOString(),
    dono: sessaoAtual,
  }

  if (!navigator.onLine) {
    await salvarMutacao(mutacao)
    emitir({ tipo: 'enfileirada' })
    return { queued: true }
  }

  const resultado = await enviarMutacao(mutacao)
  if (resultado.kind === 'ok') return { queued: false }
  if (resultado.kind === 'conflict') throw new MutacaoRecusada('conflict')
  if (resultado.kind === 'discard') throw new MutacaoRecusada('discarded')

  await salvarMutacao(mutacao)
  emitir({ tipo: 'enfileirada' })
  void tentarNovamenteComBackoff()
  return { queued: true }
}
