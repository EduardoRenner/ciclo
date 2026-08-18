import { withNovoTenant } from '@/server/db/with-tenant'
import { rota } from '@/server/http/handler'
import { reivindicarEncaixe } from '@/server/services/lista-espera'

type Ctx = { params: Promise<{ token: string }> }

/**
 * "Sem login" (mesmo espírito do TICKET-030): o token carrega a oferta
 * inteira — serviço, profissional, horário e tenant — então a rota não
 * precisa de mais nada além dele.
 */
export const POST = rota(async (_req, ctx) => {
  const { token } = await (ctx as Ctx).params
  const agendamento = await withNovoTenant((svc) => reivindicarEncaixe(svc, token))
  return { appointment: agendamento }
})
