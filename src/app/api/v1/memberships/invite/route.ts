import { writeAudit } from '@/server/audit/write'
import { exigirPermissao } from '@/server/auth/rbac'
import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario, exigirEnv } from '@/server/db/server-client'
import { lerCorpo } from '@/server/http/body'
import { rota } from '@/server/http/handler'
import { comIdempotencia } from '@/server/http/idempotency'
import { criarConvite, EsquemaConvite, listarConvites } from '@/server/services/convites'

export const GET = rota(async (req) => {
  const ctx = await contextoAtual(req)
  exigirPermissao(ctx.papel, 'professional:read')

  const db = await criarClienteDoUsuario()
  return { invites: await listarConvites(db, ctx.tenantId) }
})

export const POST = rota(async (req, _ctx, requestId) => {
  const ctx = await contextoAtual(req)
  // A política `invites_owner_only` já exige owner; a checagem de aplicação é
  // a segunda camada (FAQ C31/regra do CLAUDE.md — nunca só uma das duas).
  exigirPermissao(ctx.papel, 'professional:create')

  const entrada = await lerCorpo(req, EsquemaConvite)
  const db = await criarClienteDoUsuario()

  const { invite, token } = await comIdempotencia(req, { tenantId: ctx.tenantId, endpoint: '/api/v1/memberships/invite' }, () =>
    criarConvite(db, ctx.tenantId, ctx.sessao.userId, entrada),
  )

  await writeAudit(
    {
      tenantId: ctx.tenantId,
      actorId: ctx.sessao.userId,
      actorRole: ctx.papel,
      action: 'membership.invite',
      entity: 'invites',
      entityId: invite.id,
      after: { email: invite.email, role: invite.role },
      requestId,
    },
    req,
  )

  // O link volta na resposta para o dono copiar e mandar. A redação anterior justificava isso com
  // "nenhum MessagingProvider existe" — e existe desde então (`server/providers/messaging/`). O
  // que impede o envio automático é credencial ausente mais o portão do `docs/25` F0; ver o
  // docstring de `criarConvite`.
  return { invite, link: `${exigirEnv('NEXT_PUBLIC_APP_URL')}/convite/${token}` }
})
