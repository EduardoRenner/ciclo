import { randomUUID } from 'node:crypto'

import { z } from 'zod'

import { AppError } from '@/server/http/errors'

import type { Database } from '@/server/db/types.gen'
import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'

type Cliente = SupabaseClient<Database>

/**
 * Cadastro da Estrutura da família (docs/101 T2.1/T3.1): pessoas, empresas e atos societários. Cliente do
 * USUÁRIO (as políticas de `legal_persons`, `legal_entities` e `legal_ownerships` decidem). O ato passa
 * pela RPC `legal_apply_corporate_change` (0104, INVOKER): ato e participações nascem juntos, e a
 * participação nunca é editada, só fechada por um ato e substituída por outra (a história fica).
 */

const DATA = z.iso.date()

export const EsquemaPessoa = z
  .object({
    clientId: z.uuid(),
    fullName: z.string().trim().min(2).max(160),
    relationship: z.enum(['titular', 'conjuge', 'filho_filha', 'pai_mae', 'irmao_irma', 'neto_neta', 'socio_socia', 'outro']),
    maritalRegime: z.enum(['comunhao_parcial', 'comunhao_universal', 'separacao_total', 'participacao_final', 'uniao_estavel', 'nao_informado']).default('nao_informado'),
    birthDate: DATA.optional(),
  })
  .strict()

export const EsquemaEmpresa = z
  .object({
    clientId: z.uuid(),
    legalName: z.string().trim().min(2).max(200),
    kind: z.enum(['holding_patrimonial', 'holding_participacoes', 'holding_mista', 'operacional', 'outra']),
    uf: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/).optional(),
  })
  .strict()

const DONO = z.string().regex(/^(person|entity):[0-9a-f-]{36}$/i, 'Dono inválido.')

export const EsquemaAto = z
  .object({
    effectiveOn: DATA,
    kind: z.enum(['constituicao', 'alteracao_contratual', 'cessao_quotas', 'aumento_capital', 'reducao_capital', 'doacao_quotas', 'entrada_socio', 'saida_socio', 'transformacao', 'incorporacao', 'outro']),
    description: z.string().trim().max(1000).optional(),
    // o caso comum (alteração contratual): o quadro inteiro muda na data do ato
    substituirQuadro: z.boolean().default(true),
    novoQuadro: z
      .array(z.object({ dono: DONO, percent: z.number().gt(0).lte(100), usufrutoDe: z.uuid().optional() }).strict())
      .min(1)
      .max(50),
  })
  .strict()

function traduzir(error: PostgrestError): AppError {
  if (error.code === 'P0002' || error.code === '22023') return new AppError('VALIDATION_ERROR', { message: error.message, cause: error })
  if (error.code === '23P01') return new AppError('VALIDATION_ERROR', { message: 'Já existe participação deste dono nesta empresa no mesmo período.', cause: error })
  if (error.code === '42501') return new AppError('FORBIDDEN', { message: 'Seu perfil não pode alterar a estrutura deste cliente.', cause: error })
  return new AppError('INTERNAL', { cause: error })
}

export async function criarPessoa(db: Cliente, tenantId: string, userId: string, e: z.infer<typeof EsquemaPessoa>): Promise<{ id: string }> {
  const id = randomUUID()
  const { error } = await db.from('legal_persons').insert({
    id,
    tenant_id: tenantId,
    client_id: e.clientId,
    full_name: e.fullName,
    relationship: e.relationship,
    marital_regime: e.maritalRegime,
    birth_date: e.birthDate ?? null,
    created_by: userId,
  })
  if (error) throw traduzir(error)
  return { id }
}

export async function criarEmpresa(db: Cliente, tenantId: string, e: z.infer<typeof EsquemaEmpresa>): Promise<{ id: string }> {
  const id = randomUUID()
  const { error } = await db.from('legal_entities').insert({ id, tenant_id: tenantId, client_id: e.clientId, legal_name: e.legalName, kind: e.kind, uf: e.uf ?? null })
  if (error) throw traduzir(error)
  return { id }
}

export async function registrarAto(db: Cliente, tenantId: string, empresaId: string, e: z.infer<typeof EsquemaAto>): Promise<{ ato: string; fechadas: number }> {
  const empresa = await db.from('legal_entities').select('id').eq('tenant_id', tenantId).eq('id', empresaId).maybeSingle()
  if (empresa.error) throw new AppError('INTERNAL', { cause: empresa.error })
  if (!empresa.data) throw new AppError('NOT_FOUND', { message: 'Essa empresa não está mais disponível.' })

  let fechar: string[] = []
  if (e.substituirQuadro) {
    const abertas = await db.from('legal_ownerships').select('id').eq('tenant_id', tenantId).eq('owned_entity_id', empresaId).is('valid_to', null)
    if (abertas.error) throw new AppError('INTERNAL', { cause: abertas.error })
    fechar = (abertas.data ?? []).map((o) => o.id)
  }
  const abrir = e.novoQuadro.map((l) => {
    const [tipo, id] = l.dono.split(':') as ['person' | 'entity', string]
    if (tipo === 'entity' && id === empresaId) throw AppError.validacao({ novoQuadro: 'A empresa não pode ser dona de si mesma.' })
    return {
      ...(tipo === 'person' ? { owner_person_id: id } : { owner_entity_id: id }),
      percent: l.percent,
      ...(l.usufrutoDe ? { usufruct_person_id: l.usufrutoDe } : {}),
    }
  })
  const { data, error } = await db.rpc('legal_apply_corporate_change', {
    p: { tenant_id: tenantId, entity_id: empresaId, effective_on: e.effectiveOn, kind: e.kind, description: e.description ?? '', fechar, abrir },
  })
  if (error) throw traduzir(error)
  return { ato: data as string, fechadas: fechar.length }
}
