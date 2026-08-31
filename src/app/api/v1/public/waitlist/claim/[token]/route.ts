import { withNovoTenant } from '@/server/db/with-tenant'
import { rota } from '@/server/http/handler'
import { LIMITE_ACAO, limitarRotaPublica } from '@/server/http/limite-publico'
import { reivindicarEncaixe } from '@/server/services/lista-espera'

type Ctx = { params: Promise<{ token: string }> }

/**
 * "Sem login" (mesmo espírito do TICKET-030): o token carrega a oferta
 * inteira — serviço, profissional, horário e tenant — então a rota não
 * precisa de mais nada além dele.
 */
export const POST = rota(async (req, ctx) => {
  const { token } = await (ctx as Ctx).params
  await limitarRotaPublica(req, 'reivindicar', LIMITE_ACAO)
  const agendamento = await withNovoTenant((svc) => reivindicarEncaixe(svc, token))
  return { appointment: agendamento }
})
