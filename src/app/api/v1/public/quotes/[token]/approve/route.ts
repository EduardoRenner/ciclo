import { withNovoTenant } from '@/server/db/with-tenant'
import { aprovarOrcamentoPublico } from '@/server/services/orcamentos'
import { rota } from '@/server/http/handler'

type Ctx = { params: Promise<{ token: string }> }

// Sem `comIdempotencia`: mesmo padrão das outras rotas públicas — a checagem de estado dentro
// de `aprovarOrcamentoPublico` já responde igual num segundo clique.
export const POST = rota(async (_req, ctx) => {
  const { token } = await (ctx as Ctx).params
  return withNovoTenant((svc) => aprovarOrcamentoPublico(svc, token))
})
