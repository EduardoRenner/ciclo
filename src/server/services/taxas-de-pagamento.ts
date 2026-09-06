import { z } from 'zod'

import { FORMAS_DE_PAGAMENTO, lerTaxasDePagamento, taxaEstaConfigurada, type TaxasDePagamento } from '@/core/comanda/taxa-de-pagamento'
import { AppError } from '@/server/http/errors'

import type { Database } from '@/server/db/types.gen'
import type { SupabaseClient } from '@supabase/supabase-js'

type Cliente = SupabaseClient<Database>

const bps = z.number().int().min(0).max(10_000)

export const EsquemaTaxasDePagamento = z.object({
  cash: bps,
  pix: bps,
  debit: bps,
  credit: bps,
  other: bps,
}) satisfies z.ZodType<TaxasDePagamento>

export type LeituraDasTaxas = {
  taxas: TaxasDePagamento
  /** Falso = o dono nunca abriu esta tela. É o que separa "cobra zero" de "não sei" (`docs/49`). */
  respondida: boolean
}

export async function lerTaxasDoTenant(db: Cliente, tenantId: string): Promise<LeituraDasTaxas> {
  const { data, error } = await db.from('tenants').select('settings').eq('id', tenantId).maybeSingle()
  if (error) throw new AppError('INTERNAL', { cause: error })
  return { taxas: lerTaxasDePagamento(data?.settings), respondida: taxaEstaConfigurada(data?.settings) }
}

/** Mesmo merge de `fidelidade.ts` e `site.ts`: lê `settings` inteiro, troca só a chave. */
export async function atualizarTaxasDePagamento(db: Cliente, tenantId: string, entrada: TaxasDePagamento) {
  const { data: atual, error: erroLeitura } = await db.from('tenants').select('settings').eq('id', tenantId).single()
  if (erroLeitura) throw new AppError('INTERNAL', { cause: erroLeitura })

  const settingsAtual = (atual.settings ?? {}) as Record<string, unknown>
  // Reescreve as cinco formas sempre, mesmo as zeradas: é a presença da chave inteira que serve de
  // carimbo de "o dono respondeu" para `taxaEstaConfigurada`.
  const payment_fees_bps = Object.fromEntries(FORMAS_DE_PAGAMENTO.map((forma) => [forma, entrada[forma]]))

  const { error } = await db
    .from('tenants')
    .update({ settings: { ...settingsAtual, payment_fees_bps } as Database['public']['Tables']['tenants']['Update']['settings'] })
    .eq('id', tenantId)
  if (error) throw new AppError('INTERNAL', { cause: error })
  return entrada
}
