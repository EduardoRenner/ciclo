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
      'id, row_version, title, status, owed_by, due_on, rodada_desde, rodada, returned_reason, case_id, ' +
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
  }))
}
