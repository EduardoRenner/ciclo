import { cookies } from 'next/headers'

import { writeAudit } from '@/server/audit/write'
import { COOKIE_TENANT } from '@/server/auth/tenant'
import { exigirSessao } from '@/server/auth/session'
import { withNovoTenant } from '@/server/db/with-tenant'
import { lerCorpo } from '@/server/http/body'
import { rota } from '@/server/http/handler'
import { aceitarConvite, EsquemaAceitarConvite } from '@/server/services/convites'

export const POST = rota(async (req, _ctx, requestId) => {
  const sessao = await exigirSessao()
  const { token } = await lerCorpo(req, EsquemaAceitarConvite)

  const resultado = await withNovoTenant((svc) =>
    aceitarConvite(svc, { userId: sessao.userId, userEmail: sessao.email, token }),
  )

  await writeAudit(
    {
      tenantId: resultado.tenantId,
      actorId: sessao.userId,
      actorRole: resultado.role,
      action: 'membership.accept',
      entity: 'memberships',
      requestId,
    },
    req,
  )

  // APR-023: quem acabou de aceitar cai no negócio que chamou, mesmo se já tiver outro. O cookie só
  // diz a preferência; `contextoAtual` revalida o vínculo no banco em toda requisição.
  ;(await cookies()).set(COOKIE_TENANT, resultado.tenantId, { path: '/', httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' })

  return resultado
})
