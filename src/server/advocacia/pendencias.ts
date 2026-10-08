import { z } from 'zod'

import { MARCOS_DO_LEMBRETE } from '@/core/advocacia/checklist'
import { ESTADOS_NA_FILA, type ItemDaFila } from '@/core/advocacia/fila-de-pendencias'
import { AppError } from '@/server/http/errors'

import type { EstadoDaPendencia } from '@/core/advocacia/checklist'
import type { Database } from '@/server/db/types.gen'
import type { SupabaseClient } from '@supabase/supabase-js'

type Cliente = SupabaseClient<Database>

/** Teto da fila numa tela: escritório pequeno não chega perto, e a lista não vira rolagem infinita. */
const LIMITE = 300

/**
 * As linhas da fila de Pendências, com o cliente do USUÁRIO: a RLS de `legal_checklist_items` já
 * esconde o item de caso sigiloso de quem não é da equipe, e a fila não precisa saber que ele existe.
 */
export async function lerFilaDePendencias(
  db: Cliente,
  tenantId: string,
  recorte: { casoId?: string; clienteId?: string } = {},
): Promise<ItemDaFila[]> {
  let consulta = db
    .from('legal_checklist_items')
    .select(
      'id, row_version, title, status, owed_by, due_on, rodada_desde, rodada, returned_reason, case_id, reminders_sent, call_task_created, ' +
        'legal_cases!legal_checklist_items_case_id_tenant_id_fkey!inner(title, client_title, client_id, clients!legal_cases_client_id_tenant_id_fkey!inner(name, phone_e164))',
    )
    .eq('tenant_id', tenantId)
    .in('status', ESTADOS_NA_FILA as EstadoDaPendencia[])
  // A ficha do caso usa a mesma fila, recortada no caso: mesmos botões, mesma cobrança.
  if (recorte.casoId) consulta = consulta.eq('case_id', recorte.casoId)
  // o recorte por cliente passa pelo caso (o item não tem `client_id`); o `!inner` do embed faz valer
  if (recorte.clienteId) consulta = consulta.eq('legal_cases.client_id', recorte.clienteId)
  const { data, error } = await consulta.order('due_on', { ascending: true, nullsFirst: false }).limit(LIMITE)
  if (error) throw new AppError('INTERNAL', { cause: error })

  type Linha = {
    id: string
    row_version: number
    title: string
    status: string
    owed_by: string
    due_on: string | null
    rodada_desde: string
    rodada: number
    returned_reason: string | null
    case_id: string
    reminders_sent: number[]
    call_task_created: boolean
    legal_cases: { title: string; client_title: string; client_id: string; clients: { name: string; phone_e164: string | null } }
  }
  return ((data ?? []) as unknown as Linha[]).map((l) => ({
    id: l.id,
    rowVersion: l.row_version,
    titulo: l.title,
    estado: l.status as EstadoDaPendencia,
    quemDeve: l.owed_by === 'equipe' ? 'equipe' : 'cliente',
    venceEm: l.due_on,
    rodadaDesde: l.rodada_desde,
    rodada: l.rodada,
    motivoDaDevolucao: l.returned_reason,
    casoId: l.case_id,
    casoParaCliente: l.legal_cases.client_title,
    casoTitulo: l.legal_cases.title,
    clienteId: l.legal_cases.client_id,
    clienteNome: l.legal_cases.clients.name,
    clienteTelefone: l.legal_cases.clients.phone_e164,
    lembretesFeitos: l.reminders_sent,
    ligarFeito: l.call_task_created,
  }))
}

export const EsquemaLembrete = z
  .object({
    itens: z.array(z.uuid()).min(1).max(50),
    // o marco que a fila mostrou (0, 3 ou 7), ou "ligar" (10 dias)
    marco: z.union([z.literal(0), z.literal(3), z.literal(7), z.literal('ligar')]),
  })
  .strict()

/**
 * docs/101 T2.8: marca o lembrete como feito nos itens do cliente. Chamado pelo toque em "Cobrar" (ou
 * "Liguei"): é o que impede a fila de pedir o mesmo marco de novo. Grava o marco E os menores (o do 3º
 * dia cobre o do dia 0). Cliente do USUÁRIO: item de caso sigiloso fora do alcance não muda.
 */
export async function registrarLembrete(db: Cliente, tenantId: string, entrada: z.infer<typeof EsquemaLembrete>): Promise<{ marcados: number }> {
  const { data, error } = await db
    .from('legal_checklist_items')
    .select('id, reminders_sent')
    .eq('tenant_id', tenantId)
    .in('id', entrada.itens)
  if (error) throw new AppError('INTERNAL', { cause: error })
  let marcados = 0
  for (const i of data ?? []) {
    const mudanca =
      entrada.marco === 'ligar'
        ? { call_task_created: true }
        : { reminders_sent: [...new Set([...i.reminders_sent, ...MARCOS_DO_LEMBRETE.filter((m) => m <= (entrada.marco as number))])].sort((a, b) => a - b) }
    const r = await db.from('legal_checklist_items').update(mudanca).eq('tenant_id', tenantId).eq('id', i.id).select('id')
    if (r.error) throw new AppError('INTERNAL', { cause: r.error })
    marcados += (r.data ?? []).length
  }
  return { marcados }
}
