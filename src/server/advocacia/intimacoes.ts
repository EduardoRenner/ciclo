import { z } from 'zod'

import { AppError } from '@/server/http/errors'

import type { Database } from '@/server/db/types.gen'
import type { SupabaseClient } from '@supabase/supabase-js'

type Cliente = SupabaseClient<Database>

/**
 * Triagem de intimações do pacote Advocacia (docs/101 T4.2/T4.5). A escrita passa SÓ pela RPC
 * `legal_intimacao_decidir` (0112), que repete as checagens da RLS; a leitura do texto completo passa
 * SÓ por `legal_abrir_intimacao` (0109), que grava trilha. Aqui não há `service_role`.
 */

const DATA = z.iso.date()

export const EsquemaDecisao = z
  .object({
    acao: z.enum(['vincular', 'criar_prazo', 'sem_prazo', 'descartar']),
    caseId: z.uuid().optional(),
    dueOn: DATA.optional(),
    internalDueOn: DATA.optional(),
    title: z.string().trim().min(2).max(200).optional(),
    motivo: z.string().trim().max(500).optional(),
  })
  .strict()

export type EntradaDecisao = z.infer<typeof EsquemaDecisao>

/** Os códigos próprios da 0112, traduzidos sem adivinhar (o 42501 seria ambíguo). */
const CODIGO: Record<string, 'FORBIDDEN' | 'VALIDATION_ERROR' | 'NOT_FOUND'> = { LGL01: 'FORBIDDEN', LGL02: 'VALIDATION_ERROR', LGL04: 'NOT_FOUND' }

export async function decidirIntimacao(
  db: Cliente,
  intimacaoId: string,
  e: EntradaDecisao,
): Promise<{ status: string; deadline_id?: string; confirmado?: boolean }> {
  const { data, error } = await db.rpc('legal_intimacao_decidir', {
    p: {
      id: intimacaoId,
      acao: e.acao,
      case_id: e.caseId ?? null,
      due_on: e.dueOn ?? null,
      internal_due_on: e.internalDueOn ?? null,
      title: e.title ?? null,
      motivo: e.motivo ?? null,
    },
  })
  if (error) {
    const codigo = error.code ? CODIGO[error.code] : undefined
    if (codigo) throw new AppError(codigo, { message: error.message, cause: error })
    throw new AppError('INTERNAL', { cause: error })
  }
  return data as { status: string; deadline_id?: string; confirmado?: boolean }
}

export type IntimacaoParaTriar = {
  id: string
  tribunal: string
  orgao: string | null
  tipo: string | null
  numero: string
  disponibilizacao: string
  status: string
  casoId: string | null
  casoTitulo: string | null
  texto: string | null
  sugestao: { venceEm: string; internoEm: string | null; memoria: Record<string, unknown>; regra: string } | null
  semSugestao: string | null
}

/** Lê a intimação para a tela de triagem. Abrir o TEXTO grava trilha (é a RPC que decide e registra). */
export async function lerIntimacaoParaTriar(db: Cliente, tenantId: string, id: string): Promise<IntimacaoParaTriar | null> {
  const { data, error } = await db
    .from('legal_intimations')
    .select(
      'id, tribunal, orgao, tipo, numero_processo, data_disponibilizacao, status, case_id, ' +
        'legal_cases!legal_intimations_case_id_tenant_id_fkey(title), ' +
        'legal_intimation_suggestions!legal_intimation_suggestions_intimation_id_tenant_id_fkey(suggested_due_on, internal_due_on, calc_memo, calc_rule_version, sem_sugestao, created_at)',
    )
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .maybeSingle()
  if (error) throw new AppError('INTERNAL', { cause: error })
  if (!data) return null

  type Linha = {
    id: string
    tribunal: string
    orgao: string | null
    tipo: string | null
    numero_processo: string
    data_disponibilizacao: string
    status: string
    case_id: string | null
    legal_cases: { title: string } | null
    legal_intimation_suggestions: {
      suggested_due_on: string | null
      internal_due_on: string | null
      calc_memo: Record<string, unknown> | null
      calc_rule_version: string | null
      sem_sugestao: string | null
      created_at: string
    }[]
  }
  const l = data as unknown as Linha
  const ultima = [...l.legal_intimation_suggestions].sort((a, b) => b.created_at.localeCompare(a.created_at))[0]

  const aberta = await db.rpc('legal_abrir_intimacao', { p_id: id })
  if (aberta.error) throw new AppError('INTERNAL', { cause: aberta.error })

  return {
    id: l.id,
    tribunal: l.tribunal,
    orgao: l.orgao,
    tipo: l.tipo,
    numero: l.numero_processo,
    disponibilizacao: l.data_disponibilizacao,
    status: l.status,
    casoId: l.case_id,
    casoTitulo: l.legal_cases?.title ?? null,
    texto: aberta.data?.[0]?.texto ?? null,
    sugestao:
      ultima?.suggested_due_on && ultima.calc_memo && ultima.calc_rule_version
        ? { venceEm: ultima.suggested_due_on, internoEm: ultima.internal_due_on, memoria: ultima.calc_memo, regra: ultima.calc_rule_version }
        : null,
    semSugestao: ultima?.sem_sugestao ?? null,
  }
}
