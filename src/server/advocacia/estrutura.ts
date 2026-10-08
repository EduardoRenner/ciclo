import { AppError } from '@/server/http/errors'

import type { Empresa, Pessoa } from '@/core/advocacia/estrutura-da-familia'
import type { ArestaDeParticipacao } from '@/core/advocacia/participacao'
import type { Database } from '@/server/db/types.gen'
import type { SupabaseClient } from '@supabase/supabase-js'

type Cliente = SupabaseClient<Database>

/**
 * A estrutura societária de um cliente numa DATA (docs/101 T3.2, "como era em 01/2024"): as
 * participações vigentes naquele dia (`valid_from <= dia < valid_to`). Cliente do usuário: a RLS
 * de `legal_*` decide o alcance.
 */
export async function lerEstrutura(
  db: Cliente,
  tenantId: string,
  clienteId: string,
  dia: string,
): Promise<{ cliente: string; pessoas: Pessoa[]; empresas: Empresa[]; arestas: ArestaDeParticipacao[]; datas: string[] } | null> {
  const [cliente, pessoas, empresas] = await Promise.all([
    db.from('clients').select('name').eq('tenant_id', tenantId).eq('id', clienteId).maybeSingle(),
    db.from('legal_persons').select('id, full_name, relationship').eq('tenant_id', tenantId).eq('client_id', clienteId).is('archived_at', null).order('created_at'),
    db.from('legal_entities').select('id, legal_name, kind').eq('tenant_id', tenantId).eq('client_id', clienteId).order('created_at'),
  ])
  for (const r of [cliente, pessoas, empresas]) if (r.error) throw new AppError('INTERNAL', { cause: r.error })
  if (!cliente.data) return null

  const ids = (empresas.data ?? []).map((e) => e.id)
  let arestas: ArestaDeParticipacao[] = []
  let datas: string[] = []
  if (ids.length > 0) {
    const { data, error } = await db
      .from('legal_ownerships')
      .select('owned_entity_id, owner_person_id, owner_entity_id, percent, usufruct_person_id, valid_from, valid_to')
      .eq('tenant_id', tenantId)
      .in('owned_entity_id', ids)
    if (error) throw new AppError('INTERNAL', { cause: error })
    const todas = data ?? []
    // os dias em que a estrutura mudou: são os pontos da linha do tempo
    datas = [...new Set(todas.flatMap((o) => [o.valid_from, ...(o.valid_to ? [o.valid_to] : [])]))].sort()
    arestas = todas
      .filter((o) => o.valid_from <= dia && (o.valid_to === null || o.valid_to > dia))
      .map((o) => ({
        owner: o.owner_person_id ? { kind: 'person' as const, id: o.owner_person_id } : { kind: 'entity' as const, id: o.owner_entity_id! },
        entityId: o.owned_entity_id,
        percent: Number(o.percent),
        ...(o.usufruct_person_id ? { usufructPersonId: o.usufruct_person_id } : {}),
      }))
  }

  return {
    cliente: cliente.data.name,
    pessoas: (pessoas.data ?? []).map((p) => ({ id: p.id, nome: p.full_name, vinculo: p.relationship })),
    empresas: (empresas.data ?? []).map((e) => ({ id: e.id, nome: e.legal_name, tipo: e.kind })),
    arestas,
    datas,
  }
}
