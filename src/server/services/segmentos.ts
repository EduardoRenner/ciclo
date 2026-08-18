import { AppError } from '@/server/http/errors'

import type { Database } from '@/server/db/types.gen'
import type { SupabaseClient } from '@supabase/supabase-js'

type Cliente = SupabaseClient<Database>
type LinhaSegmento = Database['public']['Views']['v_client_segments']['Row']

const TAMANHO_PAGINA = 1000

async function buscarTudoPaginado<T>(
  consultaBase: () => { range(inicio: number, fim: number): PromiseLike<{ data: T[] | null; error: unknown }> },
): Promise<T[]> {
  const tudo: T[] = []
  for (let pagina = 0; ; pagina++) {
    const inicio = pagina * TAMANHO_PAGINA
    const { data, error } = await consultaBase().range(inicio, inicio + TAMANHO_PAGINA - 1)
    if (error) throw new AppError('INTERNAL', { cause: error })
    tudo.push(...(data ?? []))
    if (!data || data.length < TAMANHO_PAGINA) break
  }
  return tudo
}

/**
 * TICKET-040. `visits_count`/`ltv_cents`/`last_visit_at` existem em `clients` desde a 0001 mas
 * nunca eram escritos — ficavam sempre em 0/null. Este job (cron diário, `/api/cron/segments`)
 * é quem os mantém frescos, recontando por cliente a partir de `appointments` concluídos. As
 * três listas inteligentes (`v_client_segments`, migration 0010) são derivadas DESSES campos —
 * sem recalculá-los, aniversariante até funcionaria (usa só `birth_date`), mas "ticket alto" e
 * "primeira visita sem retorno" ficariam sempre vazios.
 *
 * `ltv_cents` soma `appointments.price_cents` (preço congelado na criação), não
 * `tickets.total_cents` — mesma simplificação do TICKET-039, revisar quando a comanda de itens
 * de verdade (TICKET-042) existir.
 */
export async function recalcularSegmentosDoTenant(db: Cliente, tenantId: string): Promise<number> {
  const concluidos = await buscarTudoPaginado(() =>
    db.from('appointments').select('client_id, price_cents, starts_at').eq('tenant_id', tenantId).eq('status', 'done').order('id'),
  )

  const porCliente = new Map<string, { visitas: number; ltvCents: number; ultimaVisita: string }>()
  for (const ag of concluidos) {
    if (!ag.client_id) continue
    const atual = porCliente.get(ag.client_id) ?? { visitas: 0, ltvCents: 0, ultimaVisita: ag.starts_at }
    atual.visitas++
    atual.ltvCents += ag.price_cents
    if (ag.starts_at > atual.ultimaVisita) atual.ultimaVisita = ag.starts_at
    porCliente.set(ag.client_id, atual)
  }

  // `name` entra no upsert só porque `INSERT ... ON CONFLICT DO UPDATE` valida NOT NULL na linha
  // inteira antes de decidir entre inserir e atualizar — mesmo numa atualização de cliente que
  // já existe, sem incluir `name` o Postgres recusa a linha por violar a constraint.
  const todosClientes = await buscarTudoPaginado(() =>
    db.from('clients').select('id, name').eq('tenant_id', tenantId).is('deleted_at', null).order('id'),
  )

  const linhas = todosClientes.map((c) => {
    const dados = porCliente.get(c.id)
    return {
      id: c.id,
      name: c.name,
      visits_count: dados?.visitas ?? 0,
      ltv_cents: dados?.ltvCents ?? 0,
      last_visit_at: dados?.ultimaVisita ?? null,
    }
  })

  for (let inicio = 0; inicio < linhas.length; inicio += TAMANHO_PAGINA) {
    const lote = linhas.slice(inicio, inicio + TAMANHO_PAGINA)
    // upsert em vez de update: mantém `tenant_id`/demais colunas intactas via `onConflict` na PK
    // (`id`) — precisa do `tenant_id` só para satisfazer a RLS/`not null`, não muda de valor.
    const { error } = await db.from('clients').upsert(lote.map((l) => ({ ...l, tenant_id: tenantId })), { onConflict: 'id' })
    if (error) throw new AppError('INTERNAL', { cause: error })
  }

  return linhas.length
}

const MAPA_SEGMENTO = {
  aniversariante: 'is_aniversariante',
  primeira_visita_sem_retorno: 'is_primeira_visita_sem_retorno',
  ticket_alto: 'is_ticket_alto',
} as const
export type Segmento = keyof typeof MAPA_SEGMENTO

export async function listarClientesPorSegmento(
  db: Cliente,
  tenantId: string,
  segmento: Segmento,
  opcoes: { cursor?: string; limite?: number } = {},
): Promise<LinhaSegmento[]> {
  const limite = Math.min(opcoes.limite ?? 50, 200)

  let consulta = db.from('v_client_segments').select('*').eq('tenant_id', tenantId).eq(MAPA_SEGMENTO[segmento], true)
  if (opcoes.cursor) consulta = consulta.lt('id', opcoes.cursor)

  const { data, error } = await consulta.order('id', { ascending: false }).limit(limite)
  if (error) throw new AppError('INTERNAL', { cause: error })
  return data ?? []
}
