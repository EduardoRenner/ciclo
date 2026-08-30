import { AUTOMACOES, acharAutomacao, nivelEfetivo, type ChaveAutomacao, type NivelAutonomia } from '@/core/automacoes/catalogo'
import { lerConfigAutomacoes, type ConfigAutomacoes } from '@/core/automacoes/config'
import { AppError } from '@/server/http/errors'

import type { Database, Json } from '@/server/db/types.gen'
import type { SupabaseClient } from '@supabase/supabase-js'

type Cliente = SupabaseClient<Database>

export async function configDeAutomacoes(db: Cliente, tenantId: string): Promise<ConfigAutomacoes> {
  const { data, error } = await db.from('tenants').select('settings').eq('id', tenantId).maybeSingle()
  if (error) throw new AppError('INTERNAL', { cause: error })
  return lerConfigAutomacoes(data?.settings)
}

/**
 * Grava UMA automação. Merge no `settings` inteiro, mesmo padrão de `atualizarConfigFidelidade`
 * e `site.ts` — ler tudo, trocar só a chave, escrever de volta: `settings` é um jsonb
 * compartilhado, e um `update` que monte o objeto do zero apagaria a configuração dos vizinhos.
 *
 * O teto do catálogo é aplicado no SERVIDOR, não só na tela: `nivelEfetivo` corta o valor antes
 * de gravar. Sem isso, um PATCH montado à mão poderia pôr campanha em nível 3 — exatamente o que
 * a régua (d) do `docs/33 §2.1` proíbe, e a trava não pode morar só no componente React.
 */
export async function definirNivelDeAutomacao(
  db: Cliente,
  tenantId: string,
  chave: ChaveAutomacao,
  nivel: NivelAutonomia,
): Promise<ConfigAutomacoes> {
  const automacao = acharAutomacao(chave)
  if (!automacao) throw new AppError('VALIDATION_ERROR', { message: 'Essa automação não existe.' })
  if (automacao.sempreLigada) {
    throw new AppError('VALIDATION_ERROR', { message: `${automacao.nome} faz parte do produto e não muda de nível.` })
  }

  const cortado = nivelEfetivo(automacao, nivel)

  const { data: atual, error: erroLeitura } = await db.from('tenants').select('settings').eq('id', tenantId).single()
  if (erroLeitura) throw new AppError('INTERNAL', { cause: erroLeitura })

  // `Json` do schema gerado não aceita `unknown` nas folhas — o jsonb é tipado, e o merge
  // precisa devolver algo que o cliente do Supabase reconheça como gravável.
  const settingsAtual = (atual.settings ?? {}) as Record<string, Json>
  const automacoesAtual = (settingsAtual.automacoes ?? {}) as Record<string, Json>

  const { error } = await db
    .from('tenants')
    .update({ settings: { ...settingsAtual, automacoes: { ...automacoesAtual, [chave]: cortado } } })
    .eq('id', tenantId)
  if (error) throw new AppError('INTERNAL', { cause: error })

  return lerConfigAutomacoes({ ...settingsAtual, automacoes: { ...automacoesAtual, [chave]: cortado } })
}

export { AUTOMACOES }
