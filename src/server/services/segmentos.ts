import { buscarTudoPaginado } from '@/server/db/paginar'
import { AppError } from '@/server/http/errors'

import type { Database } from '@/server/db/types.gen'
import type { SupabaseClient } from '@supabase/supabase-js'

type Cliente = SupabaseClient<Database>
type LinhaSegmento = Database['public']['Views']['v_client_segments']['Row']

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
/** UPDATEs simultâneos por passada: o cron roda por tenant, e milhares de clientes em série seriam minutos. */
const ATUALIZACOES_EM_PARALELO = 25

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

  /*
   * APR-018 (achados E-03, C-24). Era um upsert de TODO cliente com `name` e `last_visit_at:
   * calculado ?? null`, e isso fazia dois estragos: a última visita trazida da planilha (cliente
   * importado, ainda sem atendimento aqui) sumia na próxima passada do cron; e o `name` lido no
   * começo era regravado no fim — uma eliminação LGPD no meio trazia o nome real de volta.
   *
   * Agora é UPDATE, só do que mudou, sem `name`, e com `anonymized_at is null` no próprio UPDATE (é o
   * banco que decide, não a leitura de antes). A última visita só AVANÇA: sem atendimento, fica a
   * que já está; com atendimento, a mais recente entre a gravada e a calculada.
   */
  const todosClientes = await buscarTudoPaginado(() =>
    db
      .from('clients')
      .select('id, visits_count, ltv_cents, last_visit_at')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .is('anonymized_at', null)
      .order('id'),
  )

  const instante = (iso: string | null) => (iso ? new Date(iso).getTime() : null)
  const mudancas = todosClientes.flatMap((c) => {
    const dados = porCliente.get(c.id)
    const visitas = dados?.visitas ?? 0
    const ltv = dados?.ltvCents ?? 0
    const gravada = instante(c.last_visit_at)
    const calculada = instante(dados?.ultimaVisita ?? null)
    const ultima = calculada !== null && (gravada === null || calculada > gravada) ? dados!.ultimaVisita : c.last_visit_at
    if (visitas === c.visits_count && ltv === c.ltv_cents && instante(ultima) === gravada) return []
    return [{ id: c.id, visits_count: visitas, ltv_cents: ltv, last_visit_at: ultima }]
  })

  for (let inicio = 0; inicio < mudancas.length; inicio += ATUALIZACOES_EM_PARALELO) {
    const resultados = await Promise.all(
      mudancas.slice(inicio, inicio + ATUALIZACOES_EM_PARALELO).map(({ id, ...campos }) =>
        db.from('clients').update(campos).eq('tenant_id', tenantId).eq('id', id).is('anonymized_at', null),
      ),
    )
    for (const { error } of resultados) if (error) throw new AppError('INTERNAL', { cause: error })
  }

  return todosClientes.length
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
