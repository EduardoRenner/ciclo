import { montarHistoricos, notasDoSalao, type Classe, type Perfil } from '@/core/crm/nota-do-cliente'
import { buscarTudoPaginado } from '@/server/db/paginar'
import { AppError } from '@/server/http/errors'

import type { Database, Json } from '@/server/db/types.gen'
import type { SupabaseClient } from '@supabase/supabase-js'

type Cliente = SupabaseClient<Database>

const TAMANHO_DO_LOTE = 1000

/**
 * `docs/95` E3.2: recalcula a nota, a classe e o perfil de todo cliente do salão e grava em
 * `client_scores` (0100). Roda na mesma rotina diária dos segmentos (`/api/cron/segments`):
 * lê `appointments`, `clients` e `client_cycles`, não fala com ninguém de fora, e é idempotente
 * (upsert pela chave tenant + cliente).
 *
 * A nota é relativa ao salão inteiro (`notasDoSalao`), então não dá para recalcular um cliente só.
 */
export async function recalcularNotasDoTenant(db: Cliente, tenantId: string, agora: Date = new Date()): Promise<number> {
  const [clientes, agendamentos, ciclos] = await Promise.all([
    buscarTudoPaginado(() =>
      db.from('clients').select('id, created_at, referred_by').eq('tenant_id', tenantId).is('deleted_at', null).order('id'),
    ),
    buscarTudoPaginado(() =>
      db
        .from('appointments')
        .select('id, client_id, status, starts_at, price_cents, canceled_at')
        .eq('tenant_id', tenantId)
        .in('status', ['done', 'no_show', 'canceled'])
        .order('id'),
    ),
    buscarTudoPaginado(() =>
      db.from('client_cycles').select('client_id, service_id, personal_cycle_days').eq('tenant_id', tenantId).order('client_id').order('service_id'),
    ),
  ])

  const historicos = montarHistoricos(
    clientes.map((c) => ({ id: c.id, createdAt: c.created_at, referredBy: c.referred_by })),
    agendamentos
      .filter((a) => a.client_id !== null)
      .map((a) => ({ clientId: a.client_id!, status: a.status, startsAt: a.starts_at, priceCents: a.price_cents, canceledAt: a.canceled_at })),
    ciclos.map((c) => ({ clientId: c.client_id, ritmoDias: c.personal_cycle_days })),
    agora.getTime(),
  )

  const calculadoEm = agora.toISOString()
  const linhas = notasDoSalao(historicos).map((n) => ({
    tenant_id: tenantId,
    client_id: n.clientId,
    score: n.nota,
    tier: n.classe,
    profile: n.perfil,
    parts: n.partes as unknown as Json,
    algo_version: n.versao,
    computed_at: calculadoEm,
  }))

  for (let inicio = 0; inicio < linhas.length; inicio += TAMANHO_DO_LOTE) {
    const { error } = await db
      .from('client_scores')
      .upsert(linhas.slice(inicio, inicio + TAMANHO_DO_LOTE), { onConflict: 'tenant_id,client_id' })
    if (error) throw new AppError('INTERNAL', { cause: error })
  }

  return linhas.length
}

export type NotaResumida = { nota: number; classe: Classe; perfil: Perfil }

/**
 * `docs/95` E2: junta nota, classe e perfil aos itens da lista Recuperar, para a fila ordenar e
 * filtrar. Uma ida ao banco para a lista toda. Cliente sem nota ainda fica com `null` nos três.
 */
export async function comNotas<T extends { clientId: string }>(
  db: Cliente,
  tenantId: string,
  itens: T[],
): Promise<(T & { nota: number | null; classe: Classe | null; perfil: Perfil | null })[]> {
  const ids = [...new Set(itens.map((i) => i.clientId))]
  const porCliente = new Map<string, NotaResumida>()
  if (ids.length > 0) {
    const { data, error } = await db.from('client_scores').select('client_id, score, tier, profile').eq('tenant_id', tenantId).in('client_id', ids)
    if (error) throw new AppError('INTERNAL', { cause: error })
    for (const l of data ?? []) porCliente.set(l.client_id, { nota: l.score, classe: l.tier as Classe, perfil: l.profile as Perfil })
  }
  return itens.map((i) => {
    const n = porCliente.get(i.clientId)
    return { ...i, nota: n?.nota ?? null, classe: n?.classe ?? null, perfil: n?.perfil ?? null }
  })
}
