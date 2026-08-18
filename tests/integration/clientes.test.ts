import { randomUUID } from 'node:crypto'

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  atualizarCliente,
  buscarCliente,
  criarCliente,
  listarClientes,
  removerCliente,
} from '@/server/services/clientes'
import { executarOnboarding } from '@/server/services/onboarding'

import type { Database } from '@/server/db/types.gen'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error('O teste de clientes precisa de NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local.')
}

const svc = createClient<Database>(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })

let tenantId: string
const tenants: string[] = []
const usuarios: string[] = []

beforeAll(async () => {
  const marca = randomUUID().slice(0, 8)
  const { data, error } = await svc.auth.admin.createUser({
    email: `clientes-${marca}@ciclo.test`,
    password: randomUUID(),
    email_confirm: true,
    user_metadata: { full_name: 'Dona do Salão' },
  })
  if (error || !data.user) throw new Error(`seed falhou: ${error?.message}`)
  usuarios.push(data.user.id)

  const { tenant } = await executarOnboarding(svc, {
    userId: data.user.id,
    businessName: 'Salão de Clientes',
    vertical: 'nails',
    slug: `clientes-${marca}`,
    timezone: 'America/Sao_Paulo',
  })
  tenantId = tenant.id
  tenants.push(tenantId)
}, 60_000)

afterAll(async () => {
  for (const t of tenants) await svc.from('tenants').delete().eq('id', t)
  for (const u of usuarios) await svc.auth.admin.deleteUser(u)
}, 60_000)

describe('CRUD de clientes', () => {
  it(
    'cria cliente com telefone e normaliza para E.164',
    async () => {
      const criada = await criarCliente(svc, tenantId, {
        name: 'Ana Paula',
        phone: '(11) 98765-4321',
        tags: [],
        marketingOptIn: false,
      })

      expect(criada.phone_e164).toBe('+5511987654321')
    },
    30_000,
  )

  it(
    'cliente sem telefone é permitido (D47)',
    async () => {
      const criada = await criarCliente(svc, tenantId, { name: 'Sem Telefone', tags: [], marketingOptIn: false })
      expect(criada.phone_e164).toBeNull()
    },
    30_000,
  )

  it(
    'telefone com DDD inexistente devolve VALIDATION_ERROR no campo',
    async () => {
      const erro = await criarCliente(svc, tenantId, { name: 'DDD Ruim', phone: '10987654321', tags: [], marketingOptIn: false }).catch(
        (e: unknown) => e,
      )
      expect(erro).toMatchObject({ code: 'VALIDATION_ERROR', status: 422 })
    },
    30_000,
  )

  it(
    'telefone duplicado no mesmo tenant é bloqueado',
    async () => {
      const telefone = '11976543210'
      await criarCliente(svc, tenantId, { name: 'Primeira', phone: telefone, tags: [], marketingOptIn: false })

      const erro = await criarCliente(svc, tenantId, { name: 'Segunda', phone: telefone, tags: [], marketingOptIn: false }).catch(
        (e: unknown) => e,
      )
      expect(erro).toMatchObject({ code: 'VALIDATION_ERROR' })
      expect((erro as { details: { fields: Record<string, string> } }).details.fields).toHaveProperty('phone')
    },
    30_000,
  )

  it(
    'busca por nome encontra por substring, mesmo com acento',
    async () => {
      await criarCliente(svc, tenantId, { name: 'Verônica Souza', tags: [], marketingOptIn: false })

      const achou = await listarClientes(svc, tenantId, { busca: 'Souza' })
      expect(achou.some((c) => c.name === 'Verônica Souza')).toBe(true)
    },
    30_000,
  )

  it(
    'busca por telefone (mesmo formatado) encontra pelo hash',
    async () => {
      await criarCliente(svc, tenantId, { name: 'Achável Por Telefone', phone: '11955554444', tags: [], marketingOptIn: false })

      const achou = await listarClientes(svc, tenantId, { busca: '(11) 95555-4444' })
      expect(achou.some((c) => c.name === 'Achável Por Telefone')).toBe(true)
    },
    30_000,
  )

  it(
    'PATCH remove o telefone quando phone é explicitamente null',
    async () => {
      const criada = await criarCliente(svc, tenantId, { name: 'Vai Perder o Telefone', phone: '11944443333', tags: [], marketingOptIn: false })

      const atualizada = await atualizarCliente(svc, tenantId, criada.id, { phone: null })
      expect(atualizada.phone_e164).toBeNull()
    },
    30_000,
  )

  it(
    'remover é soft delete — some da listagem, mas o registro continua existindo',
    async () => {
      const criada = await criarCliente(svc, tenantId, { name: 'Vai Sumir', tags: [], marketingOptIn: false })

      await removerCliente(svc, tenantId, criada.id)

      const lista = await listarClientes(svc, tenantId, { busca: 'Vai Sumir' })
      expect(lista.find((c) => c.id === criada.id)).toBeUndefined()

      const direto = await svc.from('clients').select('deleted_at').eq('id', criada.id).single()
      expect(direto.data?.deleted_at).not.toBeNull()

      const erro = await buscarCliente(svc, tenantId, criada.id).catch((e: unknown) => e)
      expect(erro).toMatchObject({ code: 'NOT_FOUND' })
    },
    30_000,
  )
})
