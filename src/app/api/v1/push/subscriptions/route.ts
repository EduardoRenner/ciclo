import { z } from 'zod'

import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { lerCorpo } from '@/server/http/body'
import { rota } from '@/server/http/handler'
import { comIdempotencia } from '@/server/http/idempotency'
import { EsquemaInscricaoPush, removerInscricaoPush, salvarInscricaoPush } from '@/server/services/push'

export const POST = rota(async (req) => {
  const ctx = await contextoAtual(req)
  const entrada = await lerCorpo(req, EsquemaInscricaoPush)
  const db = await criarClienteDoUsuario()

  await comIdempotencia(req, { tenantId: ctx.tenantId, endpoint: '/api/v1/push/subscriptions' }, () =>
    salvarInscricaoPush(db, ctx.tenantId, ctx.sessao.userId, entrada),
  )

  return { subscribed: true }
})

const EsquemaRemocao = z.object({ endpoint: z.url('Endpoint inválido.') })

export const DELETE = rota(async (req) => {
  const ctx = await contextoAtual(req)
  const entrada = await lerCorpo(req, EsquemaRemocao)
  const db = await criarClienteDoUsuario()

  await comIdempotencia(req, { tenantId: ctx.tenantId, endpoint: '/api/v1/push/subscriptions' }, () =>
    removerInscricaoPush(db, ctx.tenantId, ctx.sessao.userId, entrada.endpoint),
  )

  return { subscribed: false }
})
