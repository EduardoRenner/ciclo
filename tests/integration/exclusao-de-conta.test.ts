import { randomUUID } from 'node:crypto'

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { describe, expect, it } from 'vitest'

import { excluirPropriaConta, situacaoDaConta } from '@/server/services/conta'
import { executarOnboarding } from '@/server/services/onboarding'
import { AppError } from '@/server/http/errors'

import type { Database } from '@/server/db/types.gen'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error('Este teste precisa de NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local.')
}

const svc = createClient<Database>(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })

/**
 * T-DEL (docs/64-APP-STORE-CAPACITOR-PLANO.md §0.3, critério de aceite #5). O ticket foi marcado
 * "feito" (commit `e6a633b`), mas o critério #5 pedia explicitamente "teste de integração que cria
 * conta, chama a exclusão, confirma que login deixa de funcionar e que dados de outros tenants não
 * foram tocados" — e esse teste nunca existia. Achado auditando os critérios de aceite letra por
 * letra em 16/09 (mesma classe de achado do T1.5: "feito" sem prova em código não é prova).
 *
 * `excluirPropriaConta` é a ação mais destrutiva do produto pro lado de quem opera o CICLO
 * (`server/services/conta.ts`) — exatamente o tipo de caminho que merece cobertura de verdade, não
 * só revisão manual.
 */

async function criarDonoComTenant(prefixo: string) {
  const marca = randomUUID().slice(0, 8)
  const { data, error } = await svc.auth.admin.createUser({
    email: `${prefixo}-${marca}@ciclo.test`,
    password: randomUUID(),
    email_confirm: true,
    user_metadata: { full_name: `Dono ${prefixo}` },
  })
  if (error || !data.user) throw new Error(`seed de usuário falhou: ${error?.message}`)

  const { tenant } = await executarOnboarding(svc, {
    userId: data.user.id,
    businessName: `Salão ${prefixo} ${marca}`,
    vertical: 'barber',
    slug: `${prefixo}-${marca}`,
    timezone: 'America/Sao_Paulo',
  })

  return { userId: data.user.id, tenantId: tenant.id }
}

describe('excluirPropriaConta: a ação mais destrutiva do produto', () => {
  it(
    'dono sozinho no tenant consegue excluir — login para de funcionar, o negócio continua intacto',
    async () => {
      const { userId, tenantId } = await criarDonoComTenant('sozinho')

      const { data: clienteAntes } = await svc
        .from('clients')
        .insert({ tenant_id: tenantId, name: 'Cliente de teste', source: 'memoria', last_visit_at: '2026-01-01' })
        .select('id')
        .single()

      const vinculos = await excluirPropriaConta(svc, userId)
      expect(vinculos).toEqual([{ tenantId, role: 'owner' }])

      // O login de fato para de funcionar — `auth.admin.getUserById` não acha mais o usuário.
      const { data: usuarioDepois, error: erroBusca } = await svc.auth.admin.getUserById(userId)
      expect(usuarioDepois?.user, 'o usuário ainda existe depois da exclusão').toBeNull()
      expect(erroBusca, 'getUserById deveria recusar um id que não existe mais').toBeTruthy()

      // O NEGÓCIO continua intacto — regra 5.1 (cair de plano/perder login nunca apaga dado).
      const { data: tenantDepois } = await svc.from('tenants').select('id').eq('id', tenantId).maybeSingle()
      expect(tenantDepois, 'o tenant foi apagado — deveria só ficar órfão de login').toBeTruthy()
      const { data: clienteDepois } = await svc.from('clients').select('id').eq('id', clienteAntes!.id).maybeSingle()
      expect(clienteDepois, 'a ficha do cliente sumiu junto com a conta do dono').toBeTruthy()

      // O vínculo em si (membership) sai — é o cascade de `profiles`→`memberships` que o
      // comentário do módulo documenta, não uma tabela órfã.
      const { data: membershipDepois } = await svc.from('memberships').select('id').eq('user_id', userId)
      expect(membershipDepois?.length ?? 0).toBe(0)

      await svc.from('tenants').delete().eq('id', tenantId)
    },
    30_000,
  )

  it(
    'dono com equipe NÃO consegue excluir sozinho — recusa antes de tocar em auth.users',
    async () => {
      const { userId: donoId, tenantId } = await criarDonoComTenant('com-equipe')

      const { data: colega, error } = await svc.auth.admin.createUser({
        email: `colega-${randomUUID().slice(0, 8)}@ciclo.test`,
        password: randomUUID(),
        email_confirm: true,
      })
      if (error || !colega.user) throw new Error(`seed do colega falhou: ${error?.message}`)
      await svc.from('memberships').insert({ tenant_id: tenantId, user_id: colega.user.id, role: 'manager' })

      const situacao = await situacaoDaConta(svc, donoId)
      expect(situacao.bloqueios.length, 'dono de tenant com equipe deveria vir com bloqueio').toBeGreaterThan(0)

      await expect(excluirPropriaConta(svc, donoId)).rejects.toMatchObject({ code: 'VALIDATION_ERROR' } satisfies Partial<AppError>)

      // Recusado ANTES de chamar `auth.admin.deleteUser` — o dono continua existindo e conseguindo
      // logar. Se isto falhar, o bloqueio virou decoração: a exclusão aconteceu mesmo assim.
      const { data: donoDepois } = await svc.auth.admin.getUserById(donoId)
      expect(donoDepois.user, 'o dono foi excluído mesmo com o bloqueio de equipe').toBeTruthy()

      await svc.from('tenants').delete().eq('id', tenantId)
      await svc.auth.admin.deleteUser(donoId)
      await svc.auth.admin.deleteUser(colega.user.id)
    },
    30_000,
  )

  it(
    'excluir a conta de um dono não toca em nada do tenant de outro dono',
    async () => {
      const { userId: donoA, tenantId: tenantA } = await criarDonoComTenant('isola-a')
      const { userId: donoB, tenantId: tenantB } = await criarDonoComTenant('isola-b')

      const { data: clienteB } = await svc
        .from('clients')
        .insert({ tenant_id: tenantB, name: 'Cliente do tenant B', source: 'memoria', last_visit_at: '2026-01-01' })
        .select('id')
        .single()

      await excluirPropriaConta(svc, donoA)

      // O tenant B, o dono B e o cliente dele continuam de pé — a exclusão do dono A não vazou.
      const { data: donoBDepois } = await svc.auth.admin.getUserById(donoB)
      expect(donoBDepois.user, 'excluir o dono A apagou o dono B junto').toBeTruthy()
      const { data: membershipB } = await svc.from('memberships').select('id').eq('tenant_id', tenantB).eq('user_id', donoB)
      expect(membershipB?.length ?? 0).toBe(1)
      const { data: clienteBDepois } = await svc.from('clients').select('id').eq('id', clienteB!.id).maybeSingle()
      expect(clienteBDepois, 'cliente do tenant B sumiu ao excluir o dono do tenant A').toBeTruthy()

      await svc.from('tenants').delete().eq('id', tenantA)
      await svc.from('tenants').delete().eq('id', tenantB)
      await svc.auth.admin.deleteUser(donoB)
    },
    30_000,
  )
})
