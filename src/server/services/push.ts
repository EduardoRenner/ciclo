import { z } from 'zod'

import { AppError } from '@/server/http/errors'

import type { Database } from '@/server/db/types.gen'
import type { SupabaseClient } from '@supabase/supabase-js'

type Cliente = SupabaseClient<Database>

/** Corpo de `PushSubscription.toJSON()` do navegador — `endpoint` + as duas chaves do W3C Push API. */
export const EsquemaInscricaoPush = z.object({
  endpoint: z.url('Inscrição de push inválida.'),
  keys: z.object({
    p256dh: z.string().min(1, 'Inscrição de push inválida.'),
    auth: z.string().min(1, 'Inscrição de push inválida.'),
  }),
})

/**
 * TICKET-056. Um dispositivo por linha (`tenant_id`, `user_id`, `endpoint`).
 * `on conflict` porque reabrir o app com a mesma inscrição (o navegador
 * devolve o mesmo endpoint enquanto não desinstala/revoga) não pode virar
 * `23505` — é o caminho normal de todo `useEffect` de novo.
 */
export async function salvarInscricaoPush(
  db: Cliente,
  tenantId: string,
  userId: string,
  inscricao: z.infer<typeof EsquemaInscricaoPush>,
): Promise<void> {
  const { error } = await db
    .from('push_subscriptions')
    .upsert(
      { tenant_id: tenantId, user_id: userId, endpoint: inscricao.endpoint, p256dh: inscricao.keys.p256dh, auth: inscricao.keys.auth },
      { onConflict: 'tenant_id,endpoint' },
    )
  if (error) throw new AppError('INTERNAL', { cause: error })
}

export async function removerInscricaoPush(db: Cliente, tenantId: string, userId: string, endpoint: string): Promise<void> {
  const { error } = await db.from('push_subscriptions').delete().eq('tenant_id', tenantId).eq('user_id', userId).eq('endpoint', endpoint)
  if (error) throw new AppError('INTERNAL', { cause: error })
}

/**
 * Usado por `enviarComFallback` (`mensageria.ts`) — o alcance de push hoje é
 * só quem tem `clients.user_id` preenchido (§8.1 da 0001: "se criou conta no
 * app da cliente"). A área `(client)/minha-conta` do briefing ainda não
 * existe neste backlog, então na prática só cobre o caso de uma cliente que
 * também é membro da equipe (rara, mas legítima) — o caminho fica pronto e
 * testado para quando o portal da cliente nascer, sem precisar mexer aqui.
 */
export async function inscricoesPushDoCliente(db: Cliente, tenantId: string, clientId: string) {
  const { data: cliente, error: erroCliente } = await db.from('clients').select('user_id').eq('id', clientId).eq('tenant_id', tenantId).maybeSingle()
  if (erroCliente) throw new AppError('INTERNAL', { cause: erroCliente })
  if (!cliente?.user_id) return []

  const { data, error } = await db
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('tenant_id', tenantId)
    .eq('user_id', cliente.user_id)
  if (error) throw new AppError('INTERNAL', { cause: error })
  return data ?? []
}

export async function removerInscricaoPorEndpoint(db: Cliente, tenantId: string, endpoint: string): Promise<void> {
  const { error } = await db.from('push_subscriptions').delete().eq('tenant_id', tenantId).eq('endpoint', endpoint)
  if (error) throw new AppError('INTERNAL', { cause: error })
}

/**
 * `docs/09-PLATAFORMA.md` §4 eixo 3: todo agendamento — hoje, de qualquer
 * tenant — nasce `pending` e o cliente lê "você vai receber a confirmação
 * por WhatsApp", mas nada avisava a equipe que existe um pedido esperando.
 * Achado ao implementar o modo "solicitação" (que reusa exatamente esse
 * `pending`/`hold_expires_at`): a notificação faltava para TODO tenant, não
 * só para quem tem `inicio = solicitacao` — corrigido para todos.
 * Devolve os dispositivos de toda a equipe (não de uma cliente específica,
 * ao contrário de `inscricoesPushDoCliente`).
 */
export async function inscricoesPushDoTenant(db: Cliente, tenantId: string) {
  const { data, error } = await db.from('push_subscriptions').select('endpoint, p256dh, auth').eq('tenant_id', tenantId)
  if (error) throw new AppError('INTERNAL', { cause: error })
  return data ?? []
}
