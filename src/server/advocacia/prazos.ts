import { randomUUID } from 'node:crypto'

import { z } from 'zod'

import { AppError } from '@/server/http/errors'

import type { Database } from '@/server/db/types.gen'
import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'

type Cliente = SupabaseClient<Database>

/**
 * Prazos do pacote Advocacia pela tela (docs/101 T4): criar à mão, encerrar (cumprido, perdido,
 * cancelado), corrigir a data com motivo e confirmar o que o estágio criou. Cliente do USUÁRIO: quem
 * pode o quê é a política de `legal_deadlines` (prazo fatal só da direção e da advocacia) e os
 * gatilhos da 0109 (prova do cálculo imutável, fatal não adia, mudança com motivo vai para o histórico).
 */

const DATA = z.iso.date()

export const EsquemaNovoPrazo = z
  .object({
    clientId: z.uuid(),
    caseId: z.uuid().optional(),
    kind: z.enum(['fatal', 'interno', 'audiencia', 'contratual']),
    title: z.string().trim().min(2).max(200),
    dueOn: DATA,
    // audiência tem hora (instante UTC); os outros tipos são só data
    dueAt: z.iso.datetime({ offset: true }).optional(),
    internalDueOn: DATA.optional(),
    responsibleProfessionalId: z.uuid().optional(),
  })
  .strict()
  .refine((e) => !e.dueAt || e.kind === 'audiencia', { message: 'Só audiência tem hora.', path: ['dueAt'] })
  .refine((e) => !e.internalDueOn || e.internalDueOn <= e.dueOn, { message: 'O dia interno precisa ser antes do prazo.', path: ['internalDueOn'] })

export const EsquemaEncerrarPrazo = z
  .object({
    status: z.enum(['cumprido', 'perdido', 'cancelado']),
    nota: z.string().trim().max(1000).optional(),
    motivo: z.string().trim().max(500).optional(),
  })
  .strict()

export const EsquemaAlterarPrazo = z.discriminatedUnion('acao', [
  z.object({ acao: z.literal('corrigir'), dueOn: DATA, internalDueOn: DATA.nullable().optional(), motivo: z.string().trim().min(5).max(500) }).strict(),
  z.object({ acao: z.literal('confirmar') }).strict(),
])

/**
 * As mensagens dos gatilhos e das `check` viram frase de tela. Código de constraint vira a frase que a
 * pessoa entende; mensagem levantada pelos gatilhos (P0001 e 23514 com texto nosso) passa como está.
 */
const FRASE_DA_CONSTRAINT: Record<string, string> = {
  legal_deadlines_fatal_cumprido_com_prova: 'Para registrar como cumprido, anexe o protocolo ou escreva a nota.',
  legal_deadlines_motivo_da_baixa: 'Escreva o motivo (pelo menos 5 letras).',
  legal_deadlines_interno_antes: 'O dia interno precisa ser antes do prazo.',
  legal_deadlines_hora_so_audiencia: 'Só audiência tem hora.',
}

function traduzir(error: PostgrestError): AppError {
  const constraint = Object.keys(FRASE_DA_CONSTRAINT).find((c) => error.message.includes(c))
  if (constraint) return new AppError('VALIDATION_ERROR', { message: FRASE_DA_CONSTRAINT[constraint], cause: error })
  if (error.code === 'P0001' || (error.code === '23514' && !error.message.includes('violates check constraint'))) {
    return new AppError('VALIDATION_ERROR', { message: error.message, cause: error })
  }
  // LGL01 é o gatilho da 0114 (estágio não confirma): a frase vem do banco
  if (error.code === 'LGL01') return new AppError('FORBIDDEN', { message: error.message, cause: error })
  // 42501 é ambíguo (privilégio OU política): sem saber qual, a resposta honesta é "não pode"
  if (error.code === '42501') return new AppError('FORBIDDEN', { message: 'Seu perfil não pode fazer isso com este prazo.', cause: error })
  return new AppError('INTERNAL', { cause: error })
}

export async function criarPrazo(db: Cliente, tenantId: string, userId: string, e: z.infer<typeof EsquemaNovoPrazo>): Promise<{ id: string }> {
  if (e.caseId) {
    const caso = await db.from('legal_cases').select('client_id').eq('tenant_id', tenantId).eq('id', e.caseId).maybeSingle()
    if (caso.error) throw new AppError('INTERNAL', { cause: caso.error })
    if (!caso.data) throw new AppError('NOT_FOUND', { message: 'Esse caso não está mais disponível.' })
    if (caso.data.client_id !== e.clientId) throw AppError.validacao({ caseId: 'O caso é de outro cliente.' })
  }
  const id = randomUUID()
  // quem cria um prazo à mão está confirmando a data; o gatilho tira a confirmação se for estágio
  const { error } = await db.from('legal_deadlines').insert({
    id,
    tenant_id: tenantId,
    client_id: e.clientId,
    case_id: e.caseId ?? null,
    kind: e.kind,
    title: e.title,
    due_on: e.dueOn,
    due_at: e.dueAt ?? null,
    internal_due_on: e.internalDueOn ?? null,
    source: 'manual',
    responsible_professional_id: e.responsibleProfessionalId ?? null,
    confirmed_by: userId,
    confirmed_at: new Date().toISOString(),
    created_by: userId,
  })
  if (error) throw traduzir(error)
  return { id }
}

export async function encerrarPrazo(
  db: Cliente,
  tenantId: string,
  prazoId: string,
  userId: string,
  e: z.infer<typeof EsquemaEncerrarPrazo>,
): Promise<{ status: string }> {
  const { data, error } = await db
    .from('legal_deadlines')
    .update({
      status: e.status,
      close_note: e.nota || null,
      close_reason: e.status === 'cumprido' ? null : e.motivo || null,
      closed_at: new Date().toISOString(),
      closed_by: userId,
    })
    .eq('tenant_id', tenantId)
    .eq('id', prazoId)
    .eq('status', 'aberto')
    .select('status')
  if (error) throw traduzir(error)
  if (!data || data.length === 0) throw new AppError('CONFLICT', { message: 'Este prazo já foi encerrado ou não está mais disponível. Recarregue.' })
  return { status: data[0]!.status }
}

export async function alterarPrazo(
  db: Cliente,
  tenantId: string,
  prazoId: string,
  userId: string,
  e: z.infer<typeof EsquemaAlterarPrazo>,
): Promise<{ id: string }> {
  if (e.acao === 'confirmar') {
    // confirmar é da direção e da advocacia: quem é de estágio não confirma o próprio prazo
    const eu = await db.from('professionals').select('legal_role').eq('tenant_id', tenantId).eq('user_id', userId).maybeSingle()
    if (eu.data?.legal_role === 'estagio') throw new AppError('FORBIDDEN', { message: 'Quem é de estágio não confirma prazo: peça à advocacia.' })
  }
  const mudanca =
    e.acao === 'confirmar'
      ? { confirmed_by: userId, confirmed_at: new Date().toISOString() }
      : { due_on: e.dueOn, ...(e.internalDueOn !== undefined ? { internal_due_on: e.internalDueOn } : {}), change_reason: e.motivo }
  const { data, error } = await db.from('legal_deadlines').update(mudanca).eq('tenant_id', tenantId).eq('id', prazoId).select('id')
  if (error) throw traduzir(error)
  if (!data || data.length === 0) throw new AppError('NOT_FOUND', { message: 'Esse prazo não está mais disponível.' })
  return { id: data[0]!.id }
}
