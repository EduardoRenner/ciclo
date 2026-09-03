import { AppError } from '@/server/http/errors'

import type { Database } from '@/server/db/types.gen'
import type { SupabaseClient } from '@supabase/supabase-js'

type Cliente = SupabaseClient<Database>

export type LinhaTrilhaCofre = {
  id: number
  clientId: string
  clientName: string
  actorId: string | null
  actorName: string
  action: string
  ip: string | null
  userAgent: string | null
  createdAt: string
}

/**
 * TICKET-053: "toda leitura aparece com quem, quando, IP" — join em memória (não PostgREST
 * embed) porque `vault_access_log` não tem FK pra `profiles`/`clients` (`actor_id` pode ser null
 * quando a leitura vem de um job de sistema, sem usuário por trás).
 */
export async function listarTrilhaDoCofre(
  db: Cliente,
  tenantId: string,
  opcoes: { clientId?: string; cursor?: number; limite?: number } = {},
): Promise<LinhaTrilhaCofre[]> {
  const limite = Math.min(opcoes.limite ?? 50, 200)

  let consulta = db
    .from('vault_access_log')
    .select('id, client_id, actor_id, actor_label, action, ip, user_agent, created_at')
    .eq('tenant_id', tenantId)
  if (opcoes.clientId) consulta = consulta.eq('client_id', opcoes.clientId)
  if (opcoes.cursor) consulta = consulta.lt('id', opcoes.cursor)

  const { data: linhas, error } = await consulta.order('id', { ascending: false }).limit(limite)
  if (error) throw new AppError('INTERNAL', { cause: error })
  if (!linhas || linhas.length === 0) return []

  const clientIds = [...new Set(linhas.map((l) => l.client_id))]
  const actorIds = [...new Set(linhas.map((l) => l.actor_id).filter((id): id is string => id !== null))]

  const [{ data: clientes }, { data: atores }] = await Promise.all([
    db.from('clients').select('id, name').in('id', clientIds),
    actorIds.length > 0 ? db.from('profiles').select('id, full_name').in('id', actorIds) : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
  ])

  const nomeDoCliente = new Map((clientes ?? []).map((c) => [c.id, c.name]))
  const nomeDoAtor = new Map((atores ?? []).map((a) => [a.id, a.full_name]))

  return linhas.map((l) => ({
    id: l.id,
    clientId: l.client_id,
    clientName: nomeDoCliente.get(l.client_id) ?? 'Cliente removida',
    actorId: l.actor_id,
    /*
      Ordem: nome VIVO, depois o instantâneo, e só então a desistência.

      O vivo vem primeiro porque identidade é a mesma pessoa — quem mudou de nome deve aparecer
      pelo nome de hoje. `actor_label` entra quando o perfil não existe mais, que era exatamente o
      caso em que a trilha perdia o ator: profissional que saiu do salão levava consigo o registro
      de todos os acessos que já tinha feito a dado de saúde.

      Acesso sem `actor_id` continua sendo 'Sistema' — é job, não pessoa.
    */
    actorName: l.actor_id ? (nomeDoAtor.get(l.actor_id) ?? l.actor_label ?? 'Usuário removido') : 'Sistema',
    action: l.action,
    ip: l.ip === null || l.ip === undefined ? null : String(l.ip),
    userAgent: l.user_agent,
    createdAt: l.created_at,
  }))
}
