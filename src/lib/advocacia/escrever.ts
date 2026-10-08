import { explicarFalha, type FalhaDeEscrita } from '@/core/advocacia/falha-de-escrita'

export type ResultadoDaEscrita<T> = { ok: true; dados: T } | ({ ok: false; campos: Record<string, string> } & FalhaDeEscrita)

/**
 * Toda escrita das telas jurídicas passa por aqui (docs/101 T5.3). De propósito NÃO é o `apiFetch`: este
 * nunca enfileira. Sem conexão devolve a falha na hora, antes de tentar, e a tela mostra a frase dela
 * sem limpar nada do que foi digitado.
 */
export async function escreverJuridico<T = unknown>(
  url: string,
  opcoes: { method: 'POST' | 'PATCH'; json?: unknown; form?: FormData },
  padrao = 'Não consegui salvar. Tente de novo.',
): Promise<ResultadoDaEscrita<T>> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return { ok: false, campos: {}, ...explicarFalha(null, padrao) }
  let r: Response
  try {
    r = await fetch(url, {
      method: opcoes.method,
      headers: { 'idempotency-key': crypto.randomUUID(), ...(opcoes.form ? {} : { 'content-type': 'application/json' }) },
      body: opcoes.form ?? (opcoes.json === undefined ? undefined : JSON.stringify(opcoes.json)),
    })
  } catch {
    return { ok: false, campos: {}, ...explicarFalha(null, padrao) }
  }
  const corpo = (await r.json().catch(() => ({}))) as { data?: T; error?: { code?: string; message?: string; details?: { fields?: Record<string, string> } } }
  if (r.ok) return { ok: true, dados: corpo.data as T }
  return {
    ok: false,
    campos: corpo.error?.details?.fields ?? {},
    ...explicarFalha({ status: r.status, code: corpo.error?.code, message: corpo.error?.message, campos: corpo.error?.details?.fields }, padrao),
  }
}
