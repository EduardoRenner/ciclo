import { withNovoTenant } from '@/server/db/with-tenant'
import { AppError } from '@/server/http/errors'
import { compararSegredo } from '@/server/http/segredo'
import { rota } from '@/server/http/handler'
import { processarLote } from '@/server/services/job-queue'

/**
 * O "Edge Function consumidora" de `01-ESPEC-TECNICA §7` vira rota do Next
 * protegida por `CRON_SECRET` — este projeto roda em Vercel, não em Supabase
 * Edge Functions; `CRON_SECRET` já nasceu como variável de app (não do
 * Supabase) no `.env.example` do TICKET-002, o que já sinalizava esse caminho.
 * O Vercel Cron sempre chama por **GET**, nunca POST, e preenche
 * `Authorization: Bearer $CRON_SECRET` sozinho quando essa env var existe no
 * projeto — não é uma escolha deste código, é o contrato do Vercel.
 *
 * Handlers reais por tipo de job (send_reminders, expire_holds…) chegam nos
 * tickets que os pedem; por ora o registro fica vazio, e todo job sem handler
 * morre marcado — nunca falha em silêncio.
 */
const HANDLERS: Record<string, (job: unknown) => Promise<void>> = {}

export const GET = rota(async (req) => {
  const esperado = process.env.CRON_SECRET
  const recebido = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!compararSegredo(recebido, esperado)) throw new AppError('UNAUTHENTICATED')

  return withNovoTenant((svc) => processarLote(svc, HANDLERS as never))
})
