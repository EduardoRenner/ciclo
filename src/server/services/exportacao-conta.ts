import { strToU8, zipSync } from 'fflate'

import { montarPacote } from '@/core/exportacao/pacote'
import { RECURSOS } from '@/core/exportacao/recursos'
import { buscarTudoPaginado } from '@/server/db/paginar'
import { AppError } from '@/server/http/errors'

import type { Database } from '@/server/db/types.gen'
import type { SupabaseClient } from '@supabase/supabase-js'

type Cliente = SupabaseClient<Database>

/**
 * CNV-009b · A conta inteira num `.zip` (`docs/103-conversor/01-plano-e-tickets.md`): os 13 recursos
 * de `core/exportacao/recursos.ts`, lidos com o cliente do USUÁRIO (a RLS é a rede, em cima da
 * permissão que a rota já conferiu), paginados (o corte de mil linhas do PostgREST não avisa) e
 * montados pelo núcleo puro (`montarPacote`). O zip sai daqui porque a biblioteca (`fflate`) não
 * entra no core.
 */
export async function exportarConta(db: Cliente, tenantId: string, negocio: string, agora: Date = new Date()): Promise<{ zip: Uint8Array; contagens: Record<string, number> }> {
  const linhasPorTabela: Record<string, Record<string, unknown>[]> = {}
  for (const r of RECURSOS) {
    const colunas = r.colunas.map((c) => c.de).join(', ')
    try {
      linhasPorTabela[r.tabela] = (await buscarTudoPaginado(() => {
        // A tabela vem do catálogo fixo (`RECURSOS`), nunca da requisição.
        const q = db
          .from(r.tabela as 'clients')
          .select(colunas)
          .eq('tenant_id', tenantId)
        return (r.semExcluidos ? q.is('deleted_at', null) : q).order('id')
      })) as unknown as Record<string, unknown>[]
    } catch (erro) {
      throw new AppError('INTERNAL', { cause: erro, message: `Não consegui ler ${r.titulo.toLowerCase()} para a exportação. Tente de novo em instantes.` })
    }
  }

  const arquivos = montarPacote(linhasPorTabela, negocio, agora.toISOString())
  const zip = zipSync(Object.fromEntries(arquivos.map((a) => [a.caminho, strToU8(a.conteudo)])), { level: 6 })
  const contagens = Object.fromEntries(RECURSOS.map((r) => [r.nome, linhasPorTabela[r.tabela]?.length ?? 0]))
  return { zip, contagens }
}
