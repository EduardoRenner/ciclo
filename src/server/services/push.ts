import { z } from 'zod'

import { destinatariosDoAvisoDaEquipe } from '@/core/mensageria/destinatarios-da-equipe'
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
 * `docs/09-PLATAFORMA.md` §4 eixo 3: todo agendamento nasce `pending` e a equipe precisa saber
 * que existe um pedido esperando.
 *
 * docs/112 EXP-A06: devolvia os aparelhos de TODO o negócio, e o corpo do aviso leva o nome da
 * cliente; com a visão restrita, uma profissional lia quem a outra ia atender. Agora só quem
 * administra e a profissional do horário (`destinatariosDoAvisoDaEquipe`).
 */
export async function inscricoesPushDaEquipe(db: Cliente, tenantId: string, professionalId: string | null) {
  const { data: membros, error: erroMembros } = await db
    .from('memberships')
    .select('user_id, role, active')
    .eq('tenant_id', tenantId)
  if (erroMembros) throw new AppError('INTERNAL', { cause: erroMembros })

  let usuarioDaProfissional: string | null = null
  if (professionalId) {
    const { data: profissional, error: erroProfissional } = await db
      .from('professionals')
      .select('user_id')
      .eq('tenant_id', tenantId)
      .eq('id', professionalId)
      .maybeSingle()
    if (erroProfissional) throw new AppError('INTERNAL', { cause: erroProfissional })
    usuarioDaProfissional = profissional?.user_id ?? null
  }

  const quem = destinatariosDoAvisoDaEquipe(
    (membros ?? []).map((m) => ({ userId: m.user_id, role: m.role, active: m.active })),
    usuarioDaProfissional,
  )
  if (quem.size === 0) return []

  const { data, error } = await db
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('tenant_id', tenantId)
    .in('user_id', [...quem])
  if (error) throw new AppError('INTERNAL', { cause: error })
  return data ?? []
}
