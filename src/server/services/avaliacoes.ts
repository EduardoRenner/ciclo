import { z } from 'zod'

import { AppError } from '@/server/http/errors'
import { gerarTokenAssinado, verificarTokenAssinado } from '@/server/services/token-assinado'

import type { Database } from '@/server/db/types.gen'
import type { SupabaseClient } from '@supabase/supabase-js'

type Cliente = SupabaseClient<Database>

/**
 * NPS sem depender de credencial nenhuma (WhatsApp/e-mail seguem bloqueados, TICKET-043): o
 * link é assinado — mesmo HMAC do link de confirmação (`confirmacao-token.ts`) — e a
 * profissional manda pelo próprio WhatsApp dela, na mão, igual já faz com as mensagens prontas.
 * Não abre coluna de token: `verificarTokenAssinado` prova a validade sozinho.
 */
const ESCOPO = 'avaliacao_atendimento'
const VALIDADE_HORAS = 24 * 30 // um mês — tempo de sobra pra alguém lembrar de avaliar

export function gerarTokenAvaliacao(appointmentId: string, segredo?: string): string {
  return gerarTokenAssinado(ESCOPO, appointmentId, VALIDADE_HORAS, segredo)
}

export function verificarTokenAvaliacao(token: string, segredo?: string): string | null {
  return verificarTokenAssinado(ESCOPO, token, segredo)
}

export const EsquemaAvaliacao = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).nullish(),
})

export type DadosParaAvaliar = { negocioNome: string; servicoNome: string; jaAvaliado: boolean }

/** O que a página pública mostra antes do cliente escolher a nota — sem vazar nada do tenant. */
export async function dadosParaAvaliar(db: Cliente, appointmentId: string): Promise<DadosParaAvaliar | null> {
  const { data, error } = await db
    .from('appointments')
    .select('tenant_id, tenants(name), services(name)')
    .eq('id', appointmentId)
    .maybeSingle()
  if (error) throw new AppError('INTERNAL', { cause: error })
  if (!data) return null

  const { data: existente } = await db.from('client_reviews').select('id').eq('appointment_id', appointmentId).maybeSingle()

  return {
    negocioNome: data.tenants?.name ?? '',
    servicoNome: data.services?.name ?? 'atendimento',
    jaAvaliado: !!existente,
  }
}

export async function registrarAvaliacao(db: Cliente, appointmentId: string, entrada: z.infer<typeof EsquemaAvaliacao>) {
  const { data: agendamento, error: erroAg } = await db
    .from('appointments')
    .select('tenant_id, client_id')
    .eq('id', appointmentId)
    .maybeSingle()
  if (erroAg) throw new AppError('INTERNAL', { cause: erroAg })
  if (!agendamento) throw new AppError('NOT_FOUND', { message: 'Esse atendimento não existe mais.' })

  const { data, error } = await db
    .from('client_reviews')
    .insert({
      tenant_id: agendamento.tenant_id,
      appointment_id: appointmentId,
      client_id: agendamento.client_id,
      rating: entrada.rating,
      comment: entrada.comment ?? null,
    })
    .select('id, rating')
    .single()

  // 23505 = já existe avaliação para este agendamento (unique). Clicar duas vezes no link não
  // pode virar erro feio pro cliente — responde como sucesso, o valor que ficou é o primeiro.
  if (error?.code === '23505') return { id: appointmentId, rating: entrada.rating, duplicado: true }
  if (error) throw new AppError('INTERNAL', { cause: error })
  return data
}

export type ResumoAvaliacoes = { media: number | null; total: number; distribuicao: Record<1 | 2 | 3 | 4 | 5, number> }

export async function resumoAvaliacoes(db: Cliente, tenantId: string): Promise<ResumoAvaliacoes> {
  const { data, error } = await db.from('client_reviews').select('rating').eq('tenant_id', tenantId)
  if (error) throw new AppError('INTERNAL', { cause: error })

  const linhas = data ?? []
  const distribuicao = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as Record<1 | 2 | 3 | 4 | 5, number>
  for (const l of linhas) distribuicao[l.rating as 1 | 2 | 3 | 4 | 5]++

  return {
    media: linhas.length > 0 ? Math.round((linhas.reduce((s, l) => s + l.rating, 0) / linhas.length) * 10) / 10 : null,
    total: linhas.length,
    distribuicao,
  }
}
