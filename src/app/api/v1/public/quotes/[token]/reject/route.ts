import { withNovoTenant } from '@/server/db/with-tenant'
import { EsquemaRecusarOrcamento, recusarOrcamentoPublico } from '@/server/services/orcamentos'
import { lerCorpo } from '@/server/http/body'
import { rota } from '@/server/http/handler'
import { LIMITE_ACAO, limitarRotaPublica } from '@/server/http/limite-publico'

type Ctx = { params: Promise<{ token: string }> }

// Sem `comIdempotencia`: mesmo padrão do approve — a checagem de estado já é idempotente.
export const POST = rota(async (req, ctx) => {
  const { token } = await (ctx as Ctx).params
  await limitarRotaPublica(req, 'orcamento-recusar', LIMITE_ACAO)
  const entrada = await lerCorpo(req, EsquemaRecusarOrcamento)
  return withNovoTenant((svc) => recusarOrcamentoPublico(svc, token, entrada))
})
