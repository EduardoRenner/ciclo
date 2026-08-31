import { withNovoTenant } from '@/server/db/with-tenant'
import { aprovarOrcamentoPublico } from '@/server/services/orcamentos'
import { rota } from '@/server/http/handler'
import { LIMITE_ACAO, limitarRotaPublica } from '@/server/http/limite-publico'

type Ctx = { params: Promise<{ token: string }> }

// Sem `comIdempotencia`: mesmo padrão das outras rotas públicas — a checagem de estado dentro
// de `aprovarOrcamentoPublico` já responde igual num segundo clique.
export const POST = rota(async (req, ctx) => {
  const { token } = await (ctx as Ctx).params
  await limitarRotaPublica(req, 'orcamento-aprovar', LIMITE_ACAO)
  return withNovoTenant((svc) => aprovarOrcamentoPublico(svc, token))
})
