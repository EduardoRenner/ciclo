import { withNovoTenant } from '@/server/db/with-tenant'
import { EsquemaRecusarOrcamento, recusarOrcamentoPublico } from '@/server/services/orcamentos'
import { lerCorpo } from '@/server/http/body'
import { rota } from '@/server/http/handler'

type Ctx = { params: Promise<{ token: string }> }

// Sem `comIdempotencia`: mesmo padrão do approve — a checagem de estado já é idempotente.
export const POST = rota(async (req, ctx) => {
  const { token } = await (ctx as Ctx).params
  const entrada = await lerCorpo(req, EsquemaRecusarOrcamento)
  return withNovoTenant((svc) => recusarOrcamentoPublico(svc, token, entrada))
})
