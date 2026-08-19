import { z } from 'zod'

import { AppError } from '@/server/http/errors'

import type { Database } from '@/server/db/types.gen'
import type { SupabaseClient } from '@supabase/supabase-js'

type Cliente = SupabaseClient<Database>

export const EsquemaNota = z.object({
  body: z.string().trim().min(2, 'Escreva a anotação.').max(2000, 'Anotação muito longa.'),
  appointmentId: z.uuid().nullish(),
})

export type NotaDoCliente = {
  id: string
  body: string
  createdAt: string
  autor: string | null
}

/**
 * `clients.notes` é um campo só, que se sobrescreve: anotar "gostou do degradê baixo" apaga o
 * que estava lá. Aqui cada anotação é uma linha com data e autor — que é como quem atende
 * realmente usa ("da última vez ele reclamou que ficou curto demais").
 */
export async function listarNotas(db: Cliente, tenantId: string, clientId: string): Promise<NotaDoCliente[]> {
  const { data, error } = await db
    .from('client_notes')
    .select('id, body, created_at, profiles(full_name)')
    .eq('tenant_id', tenantId)
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) throw new AppError('INTERNAL', { cause: error })

  return (data ?? []).map((n) => ({
    id: n.id,
    body: n.body,
    createdAt: n.created_at,
    autor: n.profiles?.full_name ?? null,
  }))
}

export async function criarNota(
  db: Cliente,
  tenantId: string,
  clientId: string,
  autorId: string,
  entrada: z.infer<typeof EsquemaNota>,
) {
  const { data, error } = await db
    .from('client_notes')
    .insert({
      tenant_id: tenantId,
      client_id: clientId,
      appointment_id: entrada.appointmentId ?? null,
      body: entrada.body,
      author_id: autorId,
    })
    .select('id, body, created_at')
    .single()

  if (error) throw new AppError('INTERNAL', { cause: error })
  return data
}
