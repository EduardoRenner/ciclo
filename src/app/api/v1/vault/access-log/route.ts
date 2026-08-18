import { exigirPermissao } from '@/server/auth/rbac'
import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { listarTrilhaDoCofre } from '@/server/services/trilha-cofre'
import { rota } from '@/server/http/handler'

/**
 * "Tela visível para o dono" (§4/TICKET-053) — não há papel algum na tabela literal de `§3.3`
 * com `vault:audit` além do curinga do owner, então `exigirPermissao` já restringe sozinha, sem
 * checagem de papel avulsa.
 */
export const GET = rota(async (req) => {
  const ctx = await contextoAtual(req)
  exigirPermissao(ctx.papel, 'vault:audit')

  const params = new URL(req.url).searchParams
  const db = await criarClienteDoUsuario()

  const linhas = await listarTrilhaDoCofre(db, ctx.tenantId, {
    clientId: params.get('clientId') ?? undefined,
    cursor: params.get('cursor') ? Number(params.get('cursor')) : undefined,
    limite: params.get('limit') ? Number(params.get('limit')) : undefined,
  })

  return { entries: linhas, nextCursor: linhas.at(-1)?.id }
})
