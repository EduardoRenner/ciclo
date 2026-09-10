/**
 * O cliente da API do Mercado Pago — o único arquivo que lê `MERCADOPAGO_ACCESS_TOKEN`.
 *
 * `docs/57` Bloco 1, PR 1.1. Metade com I/O da assinatura; a lógica pura está em
 * `src/core/billing/mercado-pago.ts` (PR #81). Confinado como `src/server/db/with-tenant.ts`: o
 * token é credencial de dinheiro, e ter um lugar só para revisar a integração de pagamento é o
 * mesmo motivo pelo qual a `service_role` mora num arquivo só. Não há regra de lint para este
 * nome ainda (o token é server-only, nunca `NEXT_PUBLIC_`, então não vaza para o cliente como a
 * `service_role` poderia) — a convenção é este comentário.
 *
 * O MP fala **reais com centavos** (`transaction_amount: 99` = R$ 99,00), não centavos. A
 * conversão sai de `valorMensalEmReais` no core.
 */

import { createHash, createHmac, timingSafeEqual } from 'node:crypto'

import { z } from 'zod'

import type { PlanoTier } from '@/core/billing/planos'

import { NOME_DO_PLANO } from '@/core/billing/planos'
import { valorMensalEmReais } from '@/core/billing/mercado-pago'
import { AppError } from '@/server/http/errors'

const BASE = process.env.MERCADOPAGO_BASE_URL || 'https://api.mercadopago.com'

function token(): string {
  const t = process.env.MERCADOPAGO_ACCESS_TOKEN
  if (!t) throw new AppError('INTERNAL', { message: 'Assinatura indisponível: falta a credencial do Mercado Pago.' })
  return t
}

/** Uma ida à API do MP. `EXTERNAL`-ish: erro do provedor não é culpa do tenant, mas também não é bug nosso. */
async function chamar<T>(caminho: string, init: RequestInit, esquema: z.ZodType<T>): Promise<T> {
  let resposta: Response
  try {
    resposta = await fetch(`${BASE}${caminho}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token()}`,
        'Content-Type': 'application/json',
        ...init.headers,
      },
    })
  } catch (causa) {
    throw new AppError('INTERNAL', { message: 'Não deu para falar com o Mercado Pago. Tente de novo em instantes.', cause: causa })
  }

  const corpo: unknown = await resposta.json().catch(() => null)
  if (!resposta.ok) {
    // `PAYMENT_FAILED` e não `INTERNAL`: o MP recusar não é bug do CICLO, e a UI trata o 402 com
    // "tente outra forma" em vez da tela de erro genérica. O corpo do MP (sem dado de cartão) vai
    // para o log pelo `cause`, nunca para a pessoa.
    throw new AppError('PAYMENT_FAILED', {
      cause: new Error(`MP ${resposta.status} ${caminho}: ${JSON.stringify(corpo)}`),
    })
  }

  const parseado = esquema.safeParse(corpo)
  if (!parseado.success) {
    throw new AppError('INTERNAL', { cause: new Error(`resposta do MP em formato inesperado (${caminho}): ${parseado.error.message}`) })
  }
  return parseado.data
}

// ---------------------------------------------------------------------------------------------
// Criar assinatura (preapproval)
// ---------------------------------------------------------------------------------------------

const RespostaPreapproval = z.object({
  id: z.string(),
  init_point: z.string().url(),
})

export type PreapprovalCriado = { preapprovalId: string; initPoint: string }

/**
 * Cria um "Plano de assinatura" recorrente mensal. `external_reference` guarda o `tenantId` — é
 * por ele que o webhook sabe de quem é a assinatura, sem confiar em nada que venha do MP como
 * "quem é você".
 */
export async function criarPreapproval(params: {
  tenantId: string
  tier: PlanoTier
  payerEmail: string
  backUrl: string
}): Promise<PreapprovalCriado> {
  const corpo = {
    reason: `CICLO — plano ${NOME_DO_PLANO[params.tier]}`,
    external_reference: params.tenantId,
    payer_email: params.payerEmail,
    back_url: params.backUrl,
    status: 'pending',
    auto_recurring: {
      frequency: 1,
      frequency_type: 'months',
      transaction_amount: valorMensalEmReais(params.tier),
      currency_id: 'BRL',
    },
  }
  const r = await chamar('/preapproval', { method: 'POST', body: JSON.stringify(corpo) }, RespostaPreapproval)
  return { preapprovalId: r.id, initPoint: r.init_point }
}

// ---------------------------------------------------------------------------------------------
// Consultar
// ---------------------------------------------------------------------------------------------

const StatusPreapproval = z.object({
  status: z.enum(['pending', 'authorized', 'paused', 'cancelled']),
  external_reference: z.string().optional(),
  auto_recurring: z.object({ transaction_amount: z.number() }).optional(),
})

export type SituacaoPreapproval = {
  status: 'pending' | 'authorized' | 'paused' | 'cancelled'
  externalReference: string | null
  /** Reais com centavos, como o MP devolve. */
  valorAutorizado: number | null
}

export async function consultarPreapproval(id: string): Promise<SituacaoPreapproval> {
  const r = await chamar(`/preapproval/${encodeURIComponent(id)}`, { method: 'GET' }, StatusPreapproval)
  return {
    status: r.status,
    externalReference: r.external_reference ?? null,
    valorAutorizado: r.auto_recurring?.transaction_amount ?? null,
  }
}

const RespostaPagamento = z.object({
  status: z.string(),
  transaction_amount: z.number().optional(),
  external_reference: z.string().nullish(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  preapproval_id: z.string().nullish(),
})

export type SituacaoPagamento = {
  status: string
  valor: number | null
  externalReference: string | null
  preapprovalId: string | null
}

/** Para o evento `type: 'payment'` do webhook — um pagamento avulso da recorrência. */
export async function consultarPagamento(id: string): Promise<SituacaoPagamento> {
  const r = await chamar(`/v1/payments/${encodeURIComponent(id)}`, { method: 'GET' }, RespostaPagamento)
  return {
    status: r.status,
    valor: r.transaction_amount ?? null,
    externalReference: r.external_reference ?? null,
    preapprovalId: r.preapproval_id ?? null,
  }
}

// ---------------------------------------------------------------------------------------------
// Verificação da assinatura do webhook (x-signature)
// ---------------------------------------------------------------------------------------------

/**
 * O MP assina cada notificação. Sem conferir isso, qualquer um que ache a URL do webhook
 * (`/api/v1/webhooks/mercado-pago`, pública) manda um `authorized` forjado e ganha o plano de graça.
 *
 * O esquema é o documentado pelo MP:
 *   - header `x-signature: ts=<epoch>,v1=<hmac_hex>`
 *   - header `x-request-id: <uuid>`
 *   - `dataId` = o `data.id` da notificação (query `?data.id=` ou corpo `data.id`)
 *   - manifesto: `id:<dataId>;request-id:<xRequestId>;ts:<ts>;`  (segmento omitido quando o valor falta)
 *   - `v1` == HMAC-SHA256(manifesto, MERCADOPAGO_WEBHOOK_SECRET), em hex, comparado com timing-safe
 *
 * `toleranciaSegundos` rejeita replay: uma notificação assinada há horas não vale mais.
 */
export function verificarAssinaturaWebhook(params: {
  xSignature: string | null
  xRequestId: string | null
  dataId: string | null
  toleranciaSegundos?: number
  agora?: number
}): boolean {
  const segredo = process.env.MERCADOPAGO_WEBHOOK_SECRET
  if (!segredo) throw new AppError('INTERNAL', { cause: new Error('falta MERCADOPAGO_WEBHOOK_SECRET') })
  if (!params.xSignature) return false

  const partes = Object.fromEntries(
    params.xSignature.split(',').map((p) => {
      const [k, ...v] = p.trim().split('=')
      return [k, v.join('=')]
    }),
  )
  const ts = partes.ts
  const v1 = partes.v1
  if (!ts || !v1 || !/^[0-9]+$/.test(ts)) return false

  const tolerancia = params.toleranciaSegundos ?? 300
  const agora = Math.floor((params.agora ?? Date.now()) / 1000)
  if (Math.abs(agora - Number(ts)) > tolerancia) return false

  // `data.id` alfanumérico é minúsculo no manifesto (regra do MP); segmento sai fora quando o valor falta.
  const id = params.dataId ? (/^[a-z0-9]+$/i.test(params.dataId) ? params.dataId.toLowerCase() : params.dataId) : null
  const manifesto =
    (id ? `id:${id};` : '') +
    (params.xRequestId ? `request-id:${params.xRequestId};` : '') +
    `ts:${ts};`

  const esperado = createHmac('sha256', segredo).update(manifesto).digest('hex')

  // `timingSafeEqual` exige buffers do mesmo tamanho — hash de hash normaliza os dois antes.
  const a = createHash('sha256').update(esperado).digest()
  const b = createHash('sha256').update(v1).digest()
  return timingSafeEqual(a, b)
}
