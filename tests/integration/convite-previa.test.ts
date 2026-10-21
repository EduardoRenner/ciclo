import { randomUUID } from 'node:crypto'

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { aceitarConvite, criarConvite, previaDoConvite } from '@/server/services/convites'
import { executarOnboarding } from '@/server/services/onboarding'

import type { Database } from '@/server/db/types.gen'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error('O teste da prévia do convite precisa de NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local.')
}

const svc = createClient<Database>(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })

/*
 * APR-023: a página `/convite/[token]` mostra de qual negócio é o convite e o papel antes de a
 * pessoa aceitar. A prévia tem a MESMA regra de validade do aceite e o mesmo silêncio: inválido,
 * usado e vencido dão `null`, sem dizer qual dos três.
 */
let tenantId: string
let donoId: string
const usuarios: string[] = []

beforeAll(async () => {
  const marca = randomUUID().slice(0, 8)
  const dono = await svc.auth.admin.createUser({ email: `convite-dono-${marca}@ciclo.test`, password: randomUUID(), email_confirm: true })
  if (dono.error || !dono.data.user) throw new Error(`seed falhou: ${dono.error?.message}`)
  donoId = dono.data.user.id
  usuarios.push(donoId)
  const { tenant } = await executarOnboarding(svc, { userId: donoId, businessName: 'Barbearia do Convite', vertical: 'barber', slug: `convite-${marca}`, timezone: 'America/Sao_Paulo' })
  tenantId = tenant.id
}, 60_000)

afterAll(async () => {
  await svc.from('tenants').delete().eq('id', tenantId)
  for (const u of usuarios) await svc.auth.admin.deleteUser(u)
}, 60_000)

describe('prévia do convite (APR-023)', () => {
  it(
    'convite válido: diz o negócio, o papel e o e-mail',
    async () => {
      const { token } = await criarConvite(svc, tenantId, donoId, { email: 'nova@ciclo.test', role: 'reception' })
      expect(await previaDoConvite(svc, token)).toEqual({ negocio: 'Barbearia do Convite', papel: 'reception', email: 'nova@ciclo.test', telefone: null })
    },
    30_000,
  )

  it(
    'depois de aceito, a prévia some (o link não serve de novo)',
    async () => {
      const email = `aceita-${randomUUID().slice(0, 6)}@ciclo.test`
      const u = await svc.auth.admin.createUser({ email, password: randomUUID(), email_confirm: true })
      usuarios.push(u.data.user!.id)
      const { token } = await criarConvite(svc, tenantId, donoId, { email, role: 'finance' })
      await aceitarConvite(svc, { userId: u.data.user!.id, userEmail: email, token })
      expect(await previaDoConvite(svc, token)).toBeNull()
    },
    30_000,
  )

  it(
    'vencido ou token errado: null, sem dizer qual',
    async () => {
      const { token, invite } = await criarConvite(svc, tenantId, donoId, { email: 'vencida@ciclo.test', role: 'professional' })
      await svc.from('invites').update({ expires_at: new Date(Date.now() - 1000).toISOString() }).eq('id', invite.id)
      expect(await previaDoConvite(svc, token)).toBeNull()
      expect(await previaDoConvite(svc, 'nao-existe-nenhum-convite-com-este-token')).toBeNull()
      expect(await previaDoConvite(svc, 'curto')).toBeNull()
    },
    30_000,
  )
})
