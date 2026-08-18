import { cookies } from 'next/headers'

import { COOKIE_TENANT } from '@/server/auth/tenant'
import { exigirSessao } from '@/server/auth/session'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { rota } from '@/server/http/handler'

export const GET = rota(async (req) => {
  const sessao = await exigirSessao()
  const db = await criarClienteDoUsuario()

  const [perfil, vinculos] = await Promise.all([
    db.from('profiles').select('id, full_name, email, phone, avatar_url, locale').eq('id', sessao.userId).maybeSingle(),
    db
      .from('memberships')
      .select('role, tenants ( id, name, slug, vertical, timezone )')
      .eq('user_id', sessao.userId)
      .eq('active', true),
  ])

  const memberships = (vinculos.data ?? [])
    .filter((v) => v.tenants !== null)
    .map((v) => ({ ...v.tenants, role: v.role }))

  // Diferente das outras rotas, aqui a ausência de tenant não é erro: é o estado
  // de quem acabou de se cadastrar e ainda vai passar pelo onboarding. Quem
  // decide o que fazer com `activeTenant: null` é a UI.
  const jar = await cookies()
  const pedido = req.headers.get('x-tenant-id') ?? jar.get(COOKIE_TENANT)?.value ?? null
  const ativo = memberships.find((m) => m.id === pedido) ?? (memberships.length === 1 ? memberships[0] : null)

  return {
    profile: perfil.data,
    memberships,
    activeTenant: ativo ?? null,
    aal: sessao.aal,
  }
})
