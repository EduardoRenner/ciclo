import { z } from 'zod'

import { AppError } from '@/server/http/errors'

import type { Database } from '@/server/db/types.gen'
import type { SupabaseClient } from '@supabase/supabase-js'

const COLUNAS =
  'id, display_name, avatar_url, bio, color, comp_model, commission_bps, rent_cents, accepts_online, active, user_id'

/**
 * `comp_model`/`commission_bps`/`rent_cents` do enum e dos `check` da 0001 —
 * o mesmo cuidado do `EsquemaServico`: erro de campo em pt-BR em vez de
 * violação de constraint crua.
 */
export const EsquemaProfissional = z.object({
  displayName: z.string().trim().min(2, 'Digite o nome.').max(120, 'Nome muito longo.'),
  bio: z.string().trim().max(500, 'Bio muito longa.').nullish(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Use uma cor no formato #RRGGBB.')
    .nullish(),
  compModel: z.enum(['commission', 'rent', 'hybrid', 'owner']).default('owner'),
  commissionBps: z.int().min(0).max(10000, 'A comissão não pode passar de 100%.').default(0),
  rentCents: z.int().min(0, 'O aluguel não pode ser negativo.').default(0),
  acceptsOnline: z.boolean().default(true),
})

export const EsquemaProfissionalParcial = EsquemaProfissional.partial()

type Entrada = z.infer<typeof EsquemaProfissional>
type EntradaParcial = z.infer<typeof EsquemaProfissionalParcial>
type Cliente = SupabaseClient<Database>
type ColunasProfissional = Database['public']['Tables']['professionals']['Update']

function paraColunas(entrada: EntradaParcial): ColunasProfissional {
  const colunas: ColunasProfissional = {}
  if (entrada.displayName !== undefined) colunas.display_name = entrada.displayName
  if (entrada.bio !== undefined) colunas.bio = entrada.bio ?? null
  if (entrada.color !== undefined) colunas.color = entrada.color ?? null
  if (entrada.compModel !== undefined) colunas.comp_model = entrada.compModel
  if (entrada.commissionBps !== undefined) colunas.commission_bps = entrada.commissionBps
  if (entrada.rentCents !== undefined) colunas.rent_cents = entrada.rentCents
  if (entrada.acceptsOnline !== undefined) colunas.accepts_online = entrada.acceptsOnline
  return colunas
}

export async function listarProfissionais(db: Cliente, tenantId: string, incluirInativos = false) {
  let consulta = db.from('professionals').select(COLUNAS).eq('tenant_id', tenantId).is('deleted_at', null)
  if (!incluirInativos) consulta = consulta.eq('active', true)

  const { data, error } = await consulta.order('display_name')
  if (error) throw new AppError('INTERNAL', { cause: error })
  return data ?? []
}

/**
 * Profissional sem login (`user_id` fica nulo) — a agenda de quem não usa o
 * app, mas ainda atende. Quem precisa de acesso próprio entra por convite
 * (`convites.ts`), que já vincula o `user_id` ao aceitar.
 */
export async function criarProfissional(db: Cliente, tenantId: string, entrada: Entrada) {
  const { data, error } = await db
    .from('professionals')
    .insert({ tenant_id: tenantId, ...paraColunas(entrada), display_name: entrada.displayName })
    .select(COLUNAS)
    .single()

  if (error) throw new AppError('INTERNAL', { cause: error })
  return data
}

export async function atualizarProfissional(db: Cliente, tenantId: string, id: string, entrada: EntradaParcial) {
  const colunas = paraColunas(entrada)
  if (Object.keys(colunas).length === 0) throw AppError.validacao({ _corpo: 'Nada para alterar.' })

  const { data, error } = await db
    .from('professionals')
    .update(colunas)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .select(COLUNAS)
    .maybeSingle()

  if (error) throw new AppError('INTERNAL', { cause: error })
  if (!data) throw new AppError('NOT_FOUND', { message: 'Esse profissional não está mais no seu time.' })
  return data
}

/**
 * D45: soft delete. Agendamentos futuros ficam órfãos e precisam de
 * realocação (FAQ C37) — não é responsabilidade deste módulo, que só marca
 * `active = false`; a tela "precisa realocar" é de outro ticket.
 */
export async function desativarProfissional(db: Cliente, tenantId: string, id: string) {
  const { data, error } = await db
    .from('professionals')
    .update({ active: false })
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .select('id, active')
    .maybeSingle()

  if (error) throw new AppError('INTERNAL', { cause: error })
  if (!data) throw new AppError('NOT_FOUND', { message: 'Esse profissional não está mais no seu time.' })
  return data
}
