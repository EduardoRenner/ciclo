import { withNovoTenant } from '@/server/db/with-tenant'
import { lerCorpo } from '@/server/http/body'
import { AppError } from '@/server/http/errors'
import { rota } from '@/server/http/handler'
import { LIMITE_ACAO, limitarRotaPublica } from '@/server/http/limite-publico'
import { dadosParaAvaliar, EsquemaAvaliacao, registrarAvaliacao, verificarTokenAvaliacao } from '@/server/services/avaliacoes'

type Ctx = { params: Promise<{ token: string }> }

function idDoAgendamento(token: string): string {
  const appointmentId = verificarTokenAvaliacao(token)
  if (!appointmentId) throw new AppError('NOT_FOUND', { message: 'Esse link de avaliação não é mais válido.' })
  return appointmentId
}

/** Página pública lê por aqui — nunca com sessão, o token é a única prova de identidade. */
export const GET = rota(async (req, ctx) => {
  const { token } = await (ctx as Ctx).params
  await limitarRotaPublica(req, 'avaliar')
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
  await limitarRotaPublica(req, 'avaliar-enviar', LIMITE_ACAO)
  const appointmentId = idDoAgendamento(token)
  const entrada = await lerCorpo(req, EsquemaAvaliacao)

  const resultado = await withNovoTenant((svc) => registrarAvaliacao(svc, appointmentId, entrada))

  /*
   * I-3 (`docs/30-INDICACAO-PLANO.md`): o link absoluto é montado aqui, não no serviço — mesmo
   * padrão de `POST .../complete` (link de avaliação) e `POST /quotes` (link de orçamento), que
   * também resolvem `NEXT_PUBLIC_APP_URL` na rota.
   *
   * Aponta direto para `/{slug}/agendar`, não para `/{slug}` (o perfil): o CTA "Agendar" do
   * perfil (`secoes.tsx`) linka para `/${slug}/agendar` SEM repassar query string nenhuma — um
   * convite para `/{slug}?ind=` perderia o token no primeiro toque, antes de chegar na tela que
   * lê `?ind=` (`agendar/page.tsx`). Levar direto para lá também poupa um clique de quem já sabe
   * o que quer: agendar.
   */
  const referralLink = resultado.indicacao
    ? `${process.env.NEXT_PUBLIC_APP_URL}/${resultado.indicacao.slug}/agendar?ind=${resultado.indicacao.token}`
    : null

  return { id: resultado.id, rating: resultado.rating, duplicado: resultado.duplicado, referralLink }
})
