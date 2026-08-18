import { exigirPermissao } from '@/server/auth/rbac'
import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { listarParaRecuperar } from '@/server/services/recuperar-receita'
import { rota } from '@/server/http/handler'

import type { Database } from '@/server/db/types.gen'

type EstadoCiclo = Database['public']['Enums']['cycle_state']
const ESTADOS_VALIDOS = new Set<EstadoCiclo>(['due', 'late', 'at_risk', 'lost'])

export const GET = rota(async (req) => {
  const ctx = await contextoAtual(req)
  exigirPermissao(ctx.papel, 'client:read')

  const params = new URL(req.url).searchParams
  const estadoBruto = params.get('state')
  const state = estadoBruto && ESTADOS_VALIDOS.has(estadoBruto as EstadoCiclo) ? (estadoBruto as EstadoCiclo) : undefined
  const limit = params.get('limit') ? Number(params.get('limit')) : undefined

  const db = await criarClienteDoUsuario()
  return listarParaRecuperar(db, ctx.tenantId, { state, limit })
})
