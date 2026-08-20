import { withNovoTenant } from '@/server/db/with-tenant'
import { orcamentoPublico } from '@/server/services/orcamentos'
import { rota } from '@/server/http/handler'

type Ctx = { params: Promise<{ token: string }> }

/**
 * docs/09-PLATAFORMA.md §11: sem sessão, mesmo padrão de token HMAC das outras rotas
 * públicas — o link do WhatsApp é a única prova de acesso.
 */
export const GET = rota(async (_req, ctx) => {
  const { token } = await (ctx as Ctx).params
  return withNovoTenant((svc) => orcamentoPublico(svc, token))
})
