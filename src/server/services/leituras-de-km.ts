import { Temporal } from '@js-temporal/polyfill'
import { z } from 'zod'

import { avaliarLeitura } from '@/core/manutencao/leitura-de-km'
import { AppError } from '@/server/http/errors'
import { exigirClienteDoProfissional } from '@/server/services/clientes'

import type { Database } from '@/server/db/types.gen'
import type { SupabaseClient } from '@supabase/supabase-js'

type Cliente = SupabaseClient<Database>

/**
 * A leitura de km do check-in (`docs/106-automotivo` AUT-103, `docs/105-ciclo/C-039`).
 *
 * Duas idas: a leitura que DESCE ou que dá salto absurdo (C-029) volta com o aviso e NÃO grava; o balcão
 * confere o número e reenvia com `confirmado`, e aí grava com a `flag` — quem ler o histórico do carro
 * sabe que aquele número foi conferido. Nunca bloqueia (mesma regra do estoque negativo).
 */
export const EsquemaLeituraDeKm = z.object({
  km: z.int('Digite o km só com números.').min(0, 'O km não pode ser negativo.').max(3_000_000, 'Esse km passa de 3 milhões. Confira o número.'),
  readOn: z.iso.date('Data inválida.'),
  appointmentId: z.uuid().nullish(),
  confirmado: z.boolean().optional(),
})

export type ResultadoDaLeitura =
  | { gravada: true; id: string; flag: 'desce' | 'salto' | null }
  | { gravada: false; precisaConfirmar: true; tipo: 'desce' | 'salto'; aviso: string }

async function veiculoAtivo(db: Cliente, tenantId: string, subjectId: string): Promise<{ clientId: string }> {
  const { data, error } = await db.from('subjects').select('id, kind, active, client_id').eq('tenant_id', tenantId).eq('id', subjectId).maybeSingle()
  if (error) throw new AppError('INTERNAL', { cause: error })
  if (!data || data.kind !== 'veiculo') throw new AppError('NOT_FOUND', { message: 'Não achamos esse veículo.' })
  if (!data.active) throw new AppError('VALIDATION_ERROR', { message: 'Esse veículo foi marcado como vendido ou baixado. Cadastre de novo pela placa.' })
  return { clientId: data.client_id }
}

/**
 * APR-040 no veículo: com alcance `own`, o profissional só alcança o carro de quem ele ATENDE — a mesma
 * regra da ficha do cliente (`exigirClienteDoProfissional`). Dono e recepção (`all`) alcançam todos.
 */
export async function exigirVeiculoNoAlcance(db: Cliente, tenantId: string, subjectId: string, escopo: 'all' | 'own'): Promise<void> {
  const { clientId } = await veiculoAtivo(db, tenantId, subjectId)
  if (escopo === 'own') await exigirClienteDoProfissional(db, tenantId, clientId)
}

export async function listarLeiturasDeKm(db: Cliente, tenantId: string, subjectId: string) {
  await veiculoAtivo(db, tenantId, subjectId)
  const { data, error } = await db
    .from('odometer_readings')
    .select('id, read_on, km, flag, appointment_id, created_at')
    .eq('tenant_id', tenantId)
    .eq('subject_id', subjectId)
    .order('read_on', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) throw new AppError('INTERNAL', { cause: error })
  return data
}

export async function registrarLeituraDeKm(
  db: Cliente,
  tenantId: string,
  userId: string,
  subjectId: string,
  entrada: z.infer<typeof EsquemaLeituraDeKm>,
): Promise<ResultadoDaLeitura> {
  await veiculoAtivo(db, tenantId, subjectId)

  const anteriores = await db
    .from('odometer_readings')
    .select('read_on, km')
    .eq('tenant_id', tenantId)
    .eq('subject_id', subjectId)
    .lte('read_on', entrada.readOn)
    .order('read_on', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1)
  if (anteriores.error) throw new AppError('INTERNAL', { cause: anteriores.error })

  const avaliacao = avaliarLeitura(
    anteriores.data.map((l) => ({ date: Temporal.PlainDate.from(l.read_on), km: l.km })),
    { date: Temporal.PlainDate.from(entrada.readOn), km: entrada.km },
  )
  if ((avaliacao.tipo === 'desce' || avaliacao.tipo === 'salto') && !entrada.confirmado) {
    return { gravada: false, precisaConfirmar: true, tipo: avaliacao.tipo, aviso: avaliacao.aviso }
  }
  const flag = avaliacao.tipo === 'desce' || avaliacao.tipo === 'salto' ? avaliacao.tipo : null

  const { data, error } = await db
    .from('odometer_readings')
    .insert({ tenant_id: tenantId, subject_id: subjectId, appointment_id: entrada.appointmentId ?? null, read_on: entrada.readOn, km: entrada.km, flag, created_by: userId })
    .select('id')
    .single()
  if (error) {
    // 23503: a visita apontada não é deste negócio (chave composta) ou não existe.
    if (error.code === '23503') throw new AppError('VALIDATION_ERROR', { message: 'Essa visita não foi encontrada. Abra o check-in de novo.' })
    throw new AppError('INTERNAL', { cause: error })
  }
  return { gravada: true, id: data.id, flag }
}
