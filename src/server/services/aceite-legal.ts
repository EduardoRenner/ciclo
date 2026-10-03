import { pendenciasDeAceite } from '@/core/legal/aceite'
import { VERSOES_LEGAIS, type DocumentoLegal } from '@/core/legal/versoes'
import { AppError } from '@/server/http/errors'

import type { Database } from '@/server/db/types.gen'
import type { SupabaseClient } from '@supabase/supabase-js'

type Cliente = SupabaseClient<Database>

/**
 * Quais documentos a conta ainda não aceitou na versão em vigor (docs/86 J8).
 *
 * Lê o COMPROVANTE (`terms_acceptances`, append-only, 0095) e não um espelho em `settings`: o espelho
 * pediria escrever no mesmo ponto do cadastro que a cortesia já mexe, e duas cópias do mesmo fato é a
 * armadilha que esta base persegue. A consulta usa o índice por (negócio, documento, quando) e roda em
 * paralelo com as outras da tela Hoje, então não soma latência.
 */
export async function aceitesPendentes(db: Cliente, tenantId: string): Promise<DocumentoLegal[]> {
  const { data, error } = await db
    .from('terms_acceptances')
    .select('documento, versao')
    .eq('tenant_id', tenantId)
    .in('documento', Object.keys(VERSOES_LEGAIS))
  if (error) throw new AppError('INTERNAL', { cause: error })
  return pendenciasDeAceite(data ?? [])
}

/**
 * Grava o aceite da versão em vigor dos documentos que faltam, com `via = 'reaceite'`. Só do que falta:
 * aceitar de novo sem pendência não escreve nada, então o comprovante nunca ganha linha repetida por
 * clique duplo. Quem chama é a rota, atrás de `tenant:update` (só o dono aceita pelo negócio) e do
 * cliente de serviço, porque a tabela não tem política de escrita para o usuário (é prova).
 */
export async function registrarReaceite(svc: Cliente, tenantId: string, userId: string): Promise<{ aceitos: DocumentoLegal[] }> {
  const pendentes = await aceitesPendentes(svc, tenantId)
  if (pendentes.length === 0) return { aceitos: [] }

  const { error } = await svc.from('terms_acceptances').insert(
    pendentes.map((documento) => ({
      tenant_id: tenantId,
      user_id: userId,
      documento,
      versao: VERSOES_LEGAIS[documento],
      via: 'reaceite',
    })),
  )
  if (error) throw new AppError('INTERNAL', { cause: error })
  return { aceitos: pendentes }
}
