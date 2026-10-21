import { AppError } from '@/server/http/errors'

import type { EstadoAgendamento } from '@/core/scheduling/state'
import type { Database } from '@/server/db/types.gen'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * APR-117 (docs/98 I-15, C-21): o que a página pública de confirmar mostra ANTES de qualquer toque.
 *
 * Até aqui a tela abria com "Confirma seu horário?" e dois botões — e nada dizia QUAL horário. A
 * pessoa que recebeu dois links na semana (ou que marcou para a filha) confirmava às cegas. O token
 * só carrega o id do agendamento, então o resto se lê aqui, com o cliente de serviço da rota pública,
 * e só o que a pessoa precisa para reconhecer o compromisso: serviço, com quem, quando e onde.
 *
 * `null` quando o agendamento não existe mais (apagado, ou id forjado que passou pela assinatura).
 */
export type HorarioParaConfirmar = {
  status: EstadoAgendamento
  startsAt: string
  serviceName: string
  professionalName: string | null
  businessName: string
  timezone: string
  slug: string | null
}

export async function lerHorarioParaConfirmar(db: SupabaseClient<Database>, appointmentId: string): Promise<HorarioParaConfirmar | null> {
  const { data, error } = await db
    .from('appointments')
    .select('status, starts_at, services ( name ), professionals ( display_name ), tenants ( name, timezone, slug )')
    .eq('id', appointmentId)
    .maybeSingle()
  if (error) throw new AppError('INTERNAL', { cause: error })
  if (!data) return null

  const tenant = data.tenants as { name: string; timezone: string; slug: string | null } | null
  return {
    status: data.status,
    startsAt: data.starts_at,
    serviceName: (data.services as { name: string } | null)?.name ?? 'Atendimento',
    professionalName: (data.professionals as { display_name: string } | null)?.display_name ?? null,
    businessName: tenant?.name ?? '',
    timezone: tenant?.timezone ?? 'America/Sao_Paulo',
    slug: tenant?.slug ?? null,
  }
}
