import { z } from 'zod'

import { reconhecerCliente } from '@/server/services/reconhecimento'
import { AppError } from '@/server/http/errors'
import { rota } from '@/server/http/handler'

type Ctx = { params: Promise<{ slug: string }> }

const EsquemaQuery = z.object({ token: z.string().trim().min(1) })

/**
 * `docs/34-PAGINA-PUBLICA-PLANO.md`, Fase 2. Sem sessão, sem lookup por telefone digitado — o
 * único jeito de entrar aqui é com o `reconhecimentoToken` que `POST .../book` devolveu num
 * agendamento anterior, guardado só no `localStorage` de quem agendou. `token` inválido, vencido
 * ou de outro tenant devolve exatamente a mesma coisa que "não é cliente": `conhecida: false`,
 * nunca um erro — a página pública não pode denunciar qual dos dois foi.
 */
export const GET = rota(async (req, ctx) => {
  const { slug } = await (ctx as Ctx).params
  const { searchParams } = new URL(req.url)
  const entrada = EsquemaQuery.safeParse({ token: searchParams.get('token') ?? '' })
  if (!entrada.success) throw AppError.validacao({ token: 'Token ausente.' })

  const reconhecimento = await reconhecerCliente(slug, entrada.data.token)
  return reconhecimento ? { conhecida: true, ...reconhecimento } : { conhecida: false }
})
