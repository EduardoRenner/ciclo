import { exigirSessao } from '@/server/auth/session'
import { EsquemaOnboarding } from '@/server/auth/schemas'
import { withNovoTenant } from '@/server/db/with-tenant'
import { lerCorpo } from '@/server/http/body'
import { rota } from '@/server/http/handler'
import { AppError } from '@/server/http/errors'
import { writeAudit } from '@/server/audit/write'
import { executarOnboarding } from '@/server/services/onboarding'

import type { Database } from '@/server/db/types.gen'

/** Mesma lista de onboarding.ts (VERTICAIS_LEGADAS) — a rota precisa dela pra resolver `vertical` a partir da profissão escolhida, antes de chamar o serviço. */
const VERTICAIS_LEGADAS = new Set(['barber', 'nails', 'lashes', 'brows', 'waxing', 'aesthetics', 'tattoo', 'hair'])

export const POST = rota(async (req, _ctx, requestId) => {
  const sessao = await exigirSessao()
  const dados = await lerCorpo(req, EsquemaOnboarding)

  const { tenant } = await withNovoTenant(async (svc) => {
    // docs/09-PLATAFORMA.md P4: `tenants.vertical` continua `not null` (0001) — toda profissão
    // precisa de um valor. Profissão fora das 8 legadas usa 'general' (migration 0031); dentro
    // delas, o próprio slug já É um valor válido do enum (barber, nails, etc. são iguais nos
    // dois sistemas por construção).
    const { data: profissao, error } = await svc.from('professions').select('slug').eq('id', dados.professionId).maybeSingle()
    if (error) throw new AppError('INTERNAL', { cause: error })
    if (!profissao) throw AppError.validacao({ professionId: 'Escolha uma profissão da lista.' })

    const vertical = (VERTICAIS_LEGADAS.has(profissao.slug) ? profissao.slug : 'general') as Database['public']['Enums']['vertical_pack']

    return executarOnboarding(svc, {
      userId: sessao.userId,
      businessName: dados.businessName,
      slug: dados.slug,
      timezone: dados.timezone,
      vertical,
      professionId: dados.professionId,
    })
  })

  await writeAudit(
    {
      tenantId: tenant.id,
      actorId: sessao.userId,
      actorRole: 'owner',
      action: 'tenant.onboarding',
      entity: 'tenants',
      entityId: tenant.id,
      after: { name: tenant.name, slug: tenant.slug, vertical: tenant.vertical },
      requestId,
    },
    req,
  )

  return { tenant, role: 'owner' as const }
})
