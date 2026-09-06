import { z } from 'zod'

import { custoFixoEstaConfigurado, lerCustoFixo, type CustoFixoDoTenant } from '@/core/comanda/custo-fixo'
import { AppError } from '@/server/http/errors'

import type { Database } from '@/server/db/types.gen'
import type { SupabaseClient } from '@supabase/supabase-js'

type Cliente = SupabaseClient<Database>

/**
 * As três perguntas que o dono responde de cabeça — `docs/47` P02 mede que ele não sabe calcular o
 * custo de um serviço, mas todo mundo sabe o que paga de aluguel.
 *
 * Os limites não são burocracia: 744 é o número de horas de um mês inteiro sem fechar a porta, e
 * um salão que declarasse mais estaria errando a resposta, não sendo excepcional.
 */
export const EsquemaCustoFixo = z.object({
  mensalCents: z.number().int().min(0, 'O valor não pode ser negativo.').max(100_000_000, 'Confira o valor: passou de R$ 1 milhão por mês.'),
  horasPorMes: z.number().min(1, 'Informe quantas horas o salão fica aberto por mês.').max(744, 'Um mês tem 744 horas — confira o número.'),
  cadeiras: z.number().int().min(1, 'Pelo menos uma.').max(200, 'Confira o número de postos de atendimento.'),
})
export type EntradaCustoFixo = z.infer<typeof EsquemaCustoFixo>

export type LeituraDoCustoFixo = {
  custo: CustoFixoDoTenant | null
  /** Falso = o dono nunca abriu esta tela. Separa "não paga aluguel" de "não me disse". */
  respondido: boolean
}

export async function lerCustoFixoDoTenant(db: Cliente, tenantId: string): Promise<LeituraDoCustoFixo> {
  const { data, error } = await db.from('tenants').select('settings').eq('id', tenantId).maybeSingle()
  if (error) throw new AppError('INTERNAL', { cause: error })
  return { custo: lerCustoFixo(data?.settings), respondido: custoFixoEstaConfigurado(data?.settings) }
}

/** Mesmo merge de `taxas-de-pagamento.ts`: lê `settings` inteiro, troca só a chave. */
export async function atualizarCustoFixo(db: Cliente, tenantId: string, entrada: EntradaCustoFixo) {
  const { data: atual, error: erroLeitura } = await db.from('tenants').select('settings').eq('id', tenantId).single()
  if (erroLeitura) throw new AppError('INTERNAL', { cause: erroLeitura })

  const settingsAtual = (atual.settings ?? {}) as Record<string, unknown>
  // As três chaves sempre, mesmo zeradas: é a presença do objeto que serve de carimbo de
  // "o dono respondeu" para `custoFixoEstaConfigurado`.
  const custo_fixo = { mensal_cents: entrada.mensalCents, horas_por_mes: entrada.horasPorMes, cadeiras: entrada.cadeiras }

  const { error } = await db
    .from('tenants')
    .update({ settings: { ...settingsAtual, custo_fixo } as Database['public']['Tables']['tenants']['Update']['settings'] })
    .eq('id', tenantId)
  if (error) throw new AppError('INTERNAL', { cause: error })
  return entrada
}
