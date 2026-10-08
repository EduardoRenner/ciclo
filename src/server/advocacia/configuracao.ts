import { z } from 'zod'

import { comRegrasConfirmadas, IDS_CONFIRMAVEIS } from '@/core/advocacia/configuracao'
import { AppError } from '@/server/http/errors'

import type { Database, Json } from '@/server/db/types.gen'
import type { SupabaseClient } from '@supabase/supabase-js'

type Cliente = SupabaseClient<Database>

/**
 * docs/101 T4.6: as configurações do pacote que só a direção (`owner`) muda. Cliente do USUÁRIO: as
 * políticas de `tenants` e `professionals` já são de dono só (0001, 0075), e a rota repete a regra.
 */
export const EsquemaConfigAdvocacia = z
  .object({
    regrasConfirmadas: z
      .array(z.string().refine((id) => IDS_CONFIRMAVEIS.includes(id), 'Regra desconhecida.'))
      .max(20)
      .optional(),
    equipe: z
      .object({
        professionalId: z.uuid(),
        // só dígitos: é o que a captura consulta (`alvosDaCaptura` recusa OAB com letra como ambígua)
        oabNumero: z.string().trim().regex(/^\d{1,7}$/, 'Só os números da OAB, sem pontos.').nullable(),
        oabUf: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/, 'A UF tem duas letras.').nullable(),
        papel: z.enum(['advogado', 'estagio']).nullable(),
      })
      .strict()
      .optional(),
  })
  .strict()
  .refine((e) => e.regrasConfirmadas !== undefined || e.equipe !== undefined, 'Nada para salvar.')

export type EntradaConfigAdvocacia = z.infer<typeof EsquemaConfigAdvocacia>

export async function salvarConfigAdvocacia(db: Cliente, tenantId: string, e: EntradaConfigAdvocacia): Promise<{ regras?: string[]; equipe?: string }> {
  const saida: { regras?: string[]; equipe?: string } = {}

  if (e.regrasConfirmadas !== undefined) {
    const atual = await db.from('tenants').select('settings').eq('id', tenantId).single()
    if (atual.error) throw new AppError('INTERNAL', { cause: atual.error })
    const novo = comRegrasConfirmadas(atual.data.settings, e.regrasConfirmadas)
    const { data, error } = await db.from('tenants').update({ settings: novo as Json }).eq('id', tenantId).select('id')
    if (error) throw new AppError('INTERNAL', { cause: error })
    // UPDATE de zero linhas não é erro no PostgREST: aqui é a política (só o dono) recusando
    if (!data || data.length === 0) throw new AppError('FORBIDDEN', { message: 'Só a direção confirma as regras de contagem.' })
    saida.regras = (novo.advocacia as { regras_confirmadas: string[] }).regras_confirmadas
  }

  if (e.equipe !== undefined) {
    if ((e.equipe.oabNumero === null) !== (e.equipe.oabUf === null)) {
      throw AppError.validacao({ oabUf: 'Preencha o número e a UF da OAB juntos, ou deixe os dois em branco.' })
    }
    const { data, error } = await db
      .from('professionals')
      .update({ oab_number: e.equipe.oabNumero, oab_uf: e.equipe.oabUf, legal_role: e.equipe.papel })
      .eq('tenant_id', tenantId)
      .eq('id', e.equipe.professionalId)
      .select('id')
    if (error) throw new AppError('INTERNAL', { cause: error })
    if (!data || data.length === 0) throw new AppError('NOT_FOUND', { message: 'Essa pessoa não está mais na equipe.' })
    saida.equipe = data[0]!.id
  }
  return saida
}
