import { z } from 'zod'

import { AppError } from '@/server/http/errors'

import type { Database } from '@/server/db/types.gen'
import type { SupabaseClient } from '@supabase/supabase-js'

const Horario = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use o formato HH:MM.')

export const EsquemaExpediente = z.object({
  // null = expediente padrão do tenant (a coluna `professional_id` também aceita
  // nulo com esse sentido, conforme o comentário da 0001).
  professionalId: z.uuid().nullable(),
  blocos: z
    .array(
      z.object({
        weekday: z.int().min(0, 'Dia da semana inválido.').max(6, 'Dia da semana inválido.'),
        opensAt: Horario,
        closesAt: Horario,
      }),
    )
    .max(28, 'No máximo 4 intervalos por dia.') // 7 dias × 4 intervalos é generoso o bastante
    .refine(
      (blocos) => blocos.every((b) => b.opensAt < b.closesAt),
      'O horário de fechar precisa vir depois do de abrir.',
    )
    .refine((blocos) => {
      // §3: "múltiplos intervalos" (ex.: 9–12 e 14–19) — o que não pode é dois
      // intervalos do mesmo dia se sobrepor, porque a disponibilidade calculada
      // em cima disso ficaria ambígua.
      const porDia = new Map<number, typeof blocos>()
      for (const b of blocos) porDia.set(b.weekday, [...(porDia.get(b.weekday) ?? []), b])

      for (const doDia of porDia.values()) {
        const ordenado = [...doDia].sort((a, b) => (a.opensAt < b.opensAt ? -1 : 1))
        for (let i = 1; i < ordenado.length; i++) {
          if (ordenado[i]!.opensAt < ordenado[i - 1]!.closesAt) return false
        }
      }
      return true
    }, 'Os intervalos do mesmo dia não podem se sobrepor.'),
})

type Entrada = z.infer<typeof EsquemaExpediente>
type Cliente = SupabaseClient<Database>

export async function listarExpediente(db: Cliente, tenantId: string, professionalId: string | null) {
  let consulta = db.from('business_hours').select('id, weekday, opens_at, closes_at').eq('tenant_id', tenantId)
  consulta = professionalId === null ? consulta.is('professional_id', null) : consulta.eq('professional_id', professionalId)

  const { data, error } = await consulta.order('weekday').order('opens_at')
  if (error) throw new AppError('INTERNAL', { cause: error })
  return data ?? []
}

/**
 * Substitui o expediente inteiro daquele profissional (ou do padrão do
 * tenant). "Múltiplos intervalos" é uma lista, não um diff: pedir para o
 * cliente mandar só o que mudou faria o servidor recalcular vizinhos, que é
 * onde bloco se sobrepõe por engano.
 */
export async function definirExpediente(db: Cliente, tenantId: string, entrada: Entrada) {
  let apagar = db.from('business_hours').delete().eq('tenant_id', tenantId)
  apagar = entrada.professionalId === null ? apagar.is('professional_id', null) : apagar.eq('professional_id', entrada.professionalId)
  const { error: erroApagar } = await apagar
  if (erroApagar) throw new AppError('INTERNAL', { cause: erroApagar })

  if (entrada.blocos.length === 0) return { blocos: [] }

  const { data, error } = await db
    .from('business_hours')
    .insert(
      entrada.blocos.map((b) => ({
        tenant_id: tenantId,
        professional_id: entrada.professionalId,
        weekday: b.weekday,
        opens_at: b.opensAt,
        closes_at: b.closesAt,
      })),
    )
    .select('id, weekday, opens_at, closes_at')

  // O expediente já foi apagado; um erro aqui deixa a agenda vazia, não errada.
  // É o lado seguro: vazio pelo menos não deixa ninguém marcar num horário que
  // a UI mostrou como aberto e não é mais.
  if (error) throw new AppError('INTERNAL', { cause: error })
  return { blocos: data ?? [] }
}
