import { randomUUID } from 'node:crypto'

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { executarOnboarding } from '@/server/services/onboarding'
import { abrirFicha } from '@/server/services/anamnese'
import { listarTrilhaDoCofre } from '@/server/services/trilha-cofre'

import type { Database } from '@/server/db/types.gen'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error('O teste de trilha do cofre precisa de NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local.')
}

const svc = createClient<Database>(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })

const TZ = 'America/Sao_Paulo'
let tenantId: string
let userId: string
const tenants: string[] = []
const usuarios: string[] = []

beforeAll(async () => {
  const marca = randomUUID().slice(0, 8)
  const { data, error } = await svc.auth.admin.createUser({
    email: `trilha-cofre-${marca}@ciclo.test`,
    password: randomUUID(),
    email_confirm: true,
    user_metadata: { full_name: 'Dona da Trilha' },
  })
  if (error || !data.user) throw new Error(`seed falhou: ${error?.message}`)
  userId = data.user.id
  usuarios.push(userId)

  const { tenant } = await executarOnboarding(svc, {
    userId,
    businessName: 'Salão da Trilha',
    vertical: 'nails',
    slug: `trilha-cofre-${marca}`,
    timezone: TZ,
  })
  tenantId = tenant.id
  tenants.push(tenantId)
}, 60_000)

afterAll(async () => {
  for (const t of tenants) await svc.from('tenants').delete().eq('id', t)
  for (const u of usuarios) await svc.auth.admin.deleteUser(u)
}, 60_000)

async function criarCliente(nome: string) {
  const cliente = await svc.from('clients').insert({ tenant_id: tenantId, name: nome }).select('id').single()
  if (cliente.error) throw cliente.error
  return cliente.data.id
}

describe('listarTrilhaDoCofre', () => {
  it(
    'abrir a ficha de uma cliente aparece na trilha com nome do cliente, quem abriu e IP',
    async () => {
      const clientId = await criarCliente('Cliente Da Trilha')
      await abrirFicha(svc, tenantId, clientId, { actorId: userId, ip: '203.0.113.9', userAgent: 'vitest' })

      const trilha = await listarTrilhaDoCofre(svc, tenantId)
      const entrada = trilha.find((e) => e.clientId === clientId)

      expect(entrada).toBeDefined()
      expect(entrada?.clientName).toBe('Cliente Da Trilha')
      expect(entrada?.actorName).toBe('Dona da Trilha')
      expect(entrada?.action).toBe('read')
      expect(entrada?.ip).toBe('203.0.113.9')
    },
    30_000,
  )

  it(
    'filtro por clientId só traz acessos daquela cliente',
    async () => {
      const clienteA = await criarCliente('Cliente A da Trilha')
      const clienteB = await criarCliente('Cliente B da Trilha')
      await abrirFicha(svc, tenantId, clienteA, { actorId: userId, ip: null, userAgent: null })
      await abrirFicha(svc, tenantId, clienteB, { actorId: userId, ip: null, userAgent: null })

      const trilha = await listarTrilhaDoCofre(svc, tenantId, { clientId: clienteA })
      expect(trilha.every((e) => e.clientId === clienteA)).toBe(true)
      expect(trilha.some((e) => e.clientId === clienteB)).toBe(false)
    },
    30_000,
  )

  it(
    'cliente sem ficha nenhuma ainda registra a tentativa (action read, sem quebrar)',
    async () => {
      const clientId = await criarCliente('Nunca Preencheu Nada')
      const ficha = await abrirFicha(svc, tenantId, clientId, { actorId: userId, ip: null, userAgent: null })
      expect(ficha).toBeNull()

      const trilha = await listarTrilhaDoCofre(svc, tenantId, { clientId })
      expect(trilha).toHaveLength(1)
    },
    30_000,
  )
})
