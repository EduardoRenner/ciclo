import { randomUUID } from 'node:crypto'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { afterAll, describe, expect, it } from 'vitest'

import { lerCortesia } from '@/core/billing/prelancamento'
import { executarOnboarding } from '@/server/services/onboarding'
import { contextoDePlano } from '@/server/services/planos'

import type { Database } from '@/server/db/types.gen'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error('O teste de cortesia precisa de NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local.')
}

const svc = createClient<Database>(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const tenantsParaLimpar: string[] = []
const usuariosParaLimpar: string[] = []

async function criarUsuario() {
  const { data, error } = await svc.auth.admin.createUser({
    email: `cortesia-${randomUUID().slice(0, 8)}@ciclo.test`,
    password: randomUUID(),
    email_confirm: true,
    user_metadata: { full_name: 'Dona da Cortesia' },
  })
  if (error || !data.user) throw new Error(`seed falhou ao criar usuário: ${error?.message}`)
  usuariosParaLimpar.push(data.user.id)
  return data.user.id
}

async function cadastrar(agora: Date) {
  const userId = await criarUsuario()
  const { tenant } = await executarOnboarding(svc, {
    userId,
    businessName: 'Salão da Cortesia',
    vertical: 'hair',
    slug: `cortesia-${randomUUID().slice(0, 8)}`,
    timezone: 'America/Sao_Paulo',
    agora,
  })
  tenantsParaLimpar.push(tenant.id)
  return { tenant, userId }
}

afterAll(async () => {
  for (const id of tenantsParaLimpar) await svc.from('tenants').delete().eq('id', id)
  for (const id of usuariosParaLimpar) await svc.auth.admin.deleteUser(id)
}, 60_000)

describe('executarOnboarding concede a cortesia (docs/87 §3.1)', () => {
  it(
    'cadastro na janela pública: settings, trilha e evento, e o plano vigente lido do banco de verdade',
    async () => {
      const agora = new Date('2026-11-20T15:00:00Z')
      const { tenant, userId } = await cadastrar(agora)

      const { data: linha } = await svc.from('tenants').select('plan, settings').eq('id', tenant.id).single()
      expect(linha?.plan, 'a cortesia não mexe em quem paga: tenants.plan continua o que era').toBe('gratis')
      const cortesia = lerCortesia(linha?.settings)
      expect(cortesia).toMatchObject({
        origem: 'pre_lancamento',
        ate: '2027-01-11T03:00:00.000Z',
        fundador: true,
        concedida_em: agora.toISOString(),
      })

      const { data: trilha } = await svc
        .from('audit_log')
        .select('action, actor_id, entity_id, after')
        .eq('tenant_id', tenant.id)
        .eq('action', 'tenant.cortesia.grant')
      expect(trilha, 'a concessão não deixou trilha em audit_log').toHaveLength(1)
      expect(trilha?.[0]).toMatchObject({ actor_id: userId, entity_id: tenant.id })
      expect(lerCortesia({ cortesia: trilha?.[0]?.after })).toEqual(cortesia)

      const { data: eventos } = await svc
        .from('product_events')
        .select('meta')
        .eq('tenant_id', tenant.id)
        .eq('event_type', 'cortesia_concedida')
      expect(eventos, 'a concessão não gerou o evento cortesia_concedida').toHaveLength(1)
      expect(eventos?.[0]?.meta).toMatchObject({ origem: 'pre_lancamento', fundador: true })

      // O ponto de ligação: o `settings->cortesia` do PostgREST chega ao contexto de plano.
      const durante = await contextoDePlano(svc, tenant.id, new Date('2026-12-20T15:00:00Z'))
      expect(durante.situacao.estado).toBe('cortesia')
      expect(durante.plano).toBe(cortesia?.plano)
      // e a expiração é decidida pelo relógio da leitura: nada foi escrito para ela acabar
      const pausada = await contextoDePlano(svc, tenant.id, new Date('2027-02-15T15:00:00Z'))
      expect(pausada.situacao.estado).toBe('pausada')
      expect(pausada.contaPausada).toBe(true)
    },
    60_000,
  )

  it(
    'cadastro depois de 12/12 leva só os 21 dias; depois de D0, também',
    async () => {
      const tarde = await cadastrar(new Date('2026-12-20T18:00:00Z'))
      const c1 = lerCortesia((await svc.from('tenants').select('settings').eq('id', tarde.tenant.id).single()).data?.settings)
      expect(c1).toMatchObject({ origem: 'teste', ate: '2027-01-11T03:00:00.000Z', fundador: false })

      const depoisDeD0 = await cadastrar(new Date('2027-01-20T14:00:00Z'))
      const c2 = lerCortesia((await svc.from('tenants').select('settings').eq('id', depoisDeD0.tenant.id).single()).data?.settings)
      expect(c2).toMatchObject({ origem: 'teste', ate: '2027-02-11T03:00:00.000Z', fundador: false })
    },
    60_000,
  )

  it(
    'se a trilha da concessão falha, o cadastro inteiro é desfeito: sem tenant órfão e sem cortesia sem registro',
    async () => {
      const userId = await criarUsuario()
      const slug = `cortesia-rollback-${randomUUID().slice(0, 8)}`

      // Só `audit_log` falha; o resto vai para o banco de verdade, para o rollback ter o que desfazer.
      const comTrilhaQuebrada = {
        from: (tabela: string) =>
          tabela === 'audit_log' ? { insert: async () => ({ error: { message: 'trilha fora do ar' } }) } : svc.from(tabela as never),
        rpc: (...args: Parameters<typeof svc.rpc>) => svc.rpc(...args),
      } as unknown as SupabaseClient<Database>

      await expect(
        executarOnboarding(comTrilhaQuebrada, {
          userId,
          businessName: 'Salão que não nasce',
          vertical: 'hair',
          slug,
          timezone: 'America/Sao_Paulo',
          agora: new Date('2026-11-20T15:00:00Z'),
        }),
      ).rejects.toThrow()

      const { data: sobrou } = await svc.from('tenants').select('id').eq('slug', slug)
      expect(sobrou, 'o tenant ficou órfão depois da falha na trilha').toEqual([])
    },
    60_000,
  )
})
