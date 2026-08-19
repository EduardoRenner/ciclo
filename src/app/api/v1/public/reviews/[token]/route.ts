import { withNovoTenant } from '@/server/db/with-tenant'
import { lerCorpo } from '@/server/http/body'
import { AppError } from '@/server/http/errors'
import { rota } from '@/server/http/handler'
import { dadosParaAvaliar, EsquemaAvaliacao, registrarAvaliacao, verificarTokenAvaliacao } from '@/server/services/avaliacoes'

type Ctx = { params: Promise<{ token: string }> }

function idDoAgendamento(token: string): string {
  const appointmentId = verificarTokenAvaliacao(token)
  if (!appointmentId) throw new AppError('NOT_FOUND', { message: 'Esse link de avaliação não é mais válido.' })
  return appointmentId
}

/** Página pública lê por aqui — nunca com sessão, o token é a única prova de identidade. */
export const GET = rota(async (_req, ctx) => {
  const { token } = await (ctx as Ctx).params
  const appointmentId = idDoAgendamento(token)

  const dados = await withNovoTenant((svc) => dadosParaAvaliar(svc, appointmentId))
  if (!dados) throw new AppError('NOT_FOUND', { message: 'Esse atendimento não existe mais.' })
  return dados
})

// Sem `comIdempotencia`: mesmo padrão das outras rotas públicas (booking, confirmação) — a
// constraint única em `client_reviews.appointment_id` já impede duplicata, e `registrarAvaliacao`
// trata o 23505 respondendo como sucesso em vez de erro.
export const POST = rota(async (req, ctx) => {
  const { token } = await (ctx as Ctx).params
  const appointmentId = idDoAgendamento(token)
  const entrada = await lerCorpo(req, EsquemaAvaliacao)

  return withNovoTenant((svc) => registrarAvaliacao(svc, appointmentId, entrada))
})
