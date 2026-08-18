import { withNovoTenant } from '@/server/db/with-tenant'
import { exigirEnv } from '@/server/db/server-client'
import { AppError } from '@/server/http/errors'
import { rota } from '@/server/http/handler'
import { enviarLembretesPendentes } from '@/server/services/lembretes'

/**
 * §7: `send_reminders`, a cada 15 minutos. Roda direto (não empilha em
 * `job_queue`) porque já é idempotente por construção — filtra pelo que já
 * está em `messages` antes de mandar, e o unique index é o backstop se dois
 * runs se sobrepuserem. Enfileirar isso feito job individual por agendamento
 * só faria sentido se precisasse de retry por item; aqui um run que falha no
 * meio tenta de novo no próximo tick de 15min, sem duplicar o que já mandou.
 */
export const GET = rota(async (req) => {
  const esperado = process.env.CRON_SECRET
  const recebido = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!esperado || recebido !== esperado) throw new AppError('UNAUTHENTICATED')

  return withNovoTenant((svc) => enviarLembretesPendentes(svc, new Date().toISOString(), exigirEnv('NEXT_PUBLIC_APP_URL')))
})
