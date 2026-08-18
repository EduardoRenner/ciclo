import { z } from 'zod'

import { AppError } from '@/server/http/errors'

import type { Database } from '@/server/db/types.gen'
import type { SupabaseClient } from '@supabase/supabase-js'

export const EsquemaFolga = z
  .object({
    // null = fecha o estabelecimento inteiro (comentário da 0001 em time_off).
    professionalId: z.uuid().nullable(),
    startsAt: z.iso.datetime({ message: 'Data de início inválida.', offset: true }),
    endsAt: z.iso.datetime({ message: 'Data de fim inválida.', offset: true }),
    reason: z.string().trim().max(200, 'Motivo muito longo.').nullish(),
  })
  .refine((f) => new Date(f.endsAt) > new Date(f.startsAt), {
    message: 'O fim precisa vir depois do início.',
    path: ['endsAt'],
  })

type Entrada = z.infer<typeof EsquemaFolga>
type Cliente = SupabaseClient<Database>

export async function listarFolgas(db: Cliente, tenantId: string, professionalId?: string) {
  let consulta = db
    .from('time_off')
    .select('id, professional_id, starts_at, ends_at, reason')
    .eq('tenant_id', tenantId)
  if (professionalId !== undefined) consulta = consulta.eq('professional_id', professionalId)

  const { data, error } = await consulta.order('starts_at')
  if (error) throw new AppError('INTERNAL', { cause: error })
  return data ?? []
}

export async function criarFolga(db: Cliente, tenantId: string, entrada: Entrada) {
  const { data, error } = await db
    .from('time_off')
    .insert({
      tenant_id: tenantId,
      professional_id: entrada.professionalId,
      starts_at: entrada.startsAt,
      ends_at: entrada.endsAt,
      reason: entrada.reason ?? null,
    })
    .select('id, professional_id, starts_at, ends_at, reason')
    .single()

  if (error) throw new AppError('INTERNAL', { cause: error })
  return data
}

/**
 * Hard delete de propósito: folga não é histórico protegido pela regra 11 do
 * CLAUDE.md (agendamento, movimento de estoque, auditoria) — é um bloqueio de
 * agenda que a pessoa criou por engano e quer tirar, não um registro que
 * precise sobreviver para prova ou relatório.
 */
export async function removerFolga(db: Cliente, tenantId: string, id: string) {
  const { data, error } = await db.from('time_off').delete().eq('id', id).eq('tenant_id', tenantId).select('id').maybeSingle()

  if (error) throw new AppError('INTERNAL', { cause: error })
  if (!data) throw new AppError('NOT_FOUND', { message: 'Essa folga não existe mais.' })
  return { removida: true }
}
