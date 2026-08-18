import { randomUUID } from 'node:crypto'

import { AppError, type ErrorCode, type ErrorDetails } from './errors'

export type Meta = {
  requestId: string
  /** Cursor opaco da próxima página. Ausente quando acabou a lista. */
  nextCursor?: string
  total?: number
}

export type EnvelopeOk<T> = { data: T; meta: Meta }
export type EnvelopeErro = {
  error: { code: ErrorCode; message: string; details?: ErrorDetails }
  meta: Meta
}

const REQUEST_ID_ACEITAVEL = /^[A-Za-z0-9_-]{8,64}$/

/**
 * Reaproveita o `x-request-id` de quem chamou quando ele tem cara de
 * identificador — é o que deixa o rastro atravessar proxy e cliente. Valor
 * estranho é descartado, não sanitizado: ele acaba em log e em header.
 */
export function resolverRequestId(headers?: Headers): string {
  const recebido = headers?.get('x-request-id')
  if (recebido && REQUEST_ID_ACEITAVEL.test(recebido)) return recebido
  return `req_${randomUUID().replaceAll('-', '')}`
}

function comRequestId(headers: Record<string, string> | undefined, requestId: string): Headers {
  const h = new Headers(headers)
  h.set('content-type', 'application/json; charset=utf-8')
  h.set('x-request-id', requestId)
  return h
}

export function respostaOk<T>(
  data: T,
  opcoes: { requestId: string; status?: number; nextCursor?: string; total?: number; headers?: Record<string, string> },
): Response {
  const meta: Meta = { requestId: opcoes.requestId }
  if (opcoes.nextCursor !== undefined) meta.nextCursor = opcoes.nextCursor
  if (opcoes.total !== undefined) meta.total = opcoes.total

  const corpo: EnvelopeOk<T> = { data, meta }
  return new Response(JSON.stringify(corpo), {
    status: opcoes.status ?? 200,
    headers: comRequestId(opcoes.headers, opcoes.requestId),
  })
}

export function respostaErro(erro: AppError, requestId: string): Response {
  const corpo: EnvelopeErro = {
    error: {
      code: erro.code,
      message: erro.publicMessage,
      ...(erro.details === undefined ? {} : { details: erro.details }),
    },
    meta: { requestId },
  }
  return new Response(JSON.stringify(corpo), {
    status: erro.status,
    headers: comRequestId(erro.headers, requestId),
  })
}
