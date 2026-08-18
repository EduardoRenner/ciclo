import { randomUUID } from 'node:crypto'

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { executarOnboarding } from '@/server/services/onboarding'
import { listarAlertasDeEstoque } from '@/server/services/alertas-estoque'

import type { Database } from '@/server/db/types.gen'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error('O teste de alertas de estoque precisa de NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local.')
}

const svc = createClient<Database>(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })

const TZ = 'America/Sao_Paulo'
const HOJE = '2026-08-18'
let tenantId: string
const tenants: string[] = []
const usuarios: string[] = []

beforeAll(async () => {
  const marca = randomUUID().slice(0, 8)
  const { data, error } = await svc.auth.admin.createUser({
    email: `alertas-estoque-${marca}@ciclo.test`,
    password: randomUUID(),
    email_confirm: true,
    user_metadata: { full_name: 'Dona dos Alertas' },
  })
  if (error || !data.user) throw new Error(`seed falhou: ${error?.message}`)
  usuarios.push(data.user.id)

  const { tenant } = await executarOnboarding(svc, {
    userId: data.user.id,
    businessName: 'Salão dos Alertas',
    vertical: 'nails',
    slug: `alertas-estoque-${marca}`,
    timezone: TZ,
  })
  tenantId = tenant.id
  tenants.push(tenantId)
}, 60_000)

afterAll(async () => {
  for (const t of tenants) await svc.from('tenants').delete().eq('id', t)
  for (const u of usuarios) await svc.auth.admin.deleteUser(u)
}, 60_000)

async function criarProduto(opcoes: { name: string; stockQty: number; reorderPoint: number; expiresAt?: string | null }) {
  const produto = await svc
    .from('products')
    .insert({ tenant_id: tenantId, name: opcoes.name, stock_qty: opcoes.stockQty, reorder_point: opcoes.reorderPoint, expires_at: opcoes.expiresAt ?? null })
    .select('id')
    .single()
  if (produto.error) throw produto.error
  return produto.data.id
}

describe('listarAlertasDeEstoque', () => {
  it(
    'produto tranquilo (estoque alto, sem validade) não aparece na lista',
    async () => {
      const produtoId = await criarProduto({ name: 'Tranquilo', stockQty: 500, reorderPoint: 10 })
      const alertas = await listarAlertasDeEstoque(svc, tenantId, HOJE)
      expect(alertas.some((a) => a.productId === produtoId)).toBe(false)
    },
    30_000,
  )

  it(
    'estoque no ou abaixo do ponto de pedido entra na lista com precisaRecomprar',
    async () => {
      const produtoId = await criarProduto({ name: 'Acabando', stockQty: 3, reorderPoint: 5 })
      const alertas = await listarAlertasDeEstoque(svc, tenantId, HOJE)
      const alerta = alertas.find((a) => a.productId === produtoId)
      expect(alerta).toBeDefined()
      expect(alerta?.precisaRecomprar).toBe(true)
    },
    30_000,
  )

  it(
    'produto vencido entra bloqueado, mesmo com estoque alto',
    async () => {
      const produtoId = await criarProduto({ name: 'Vencido', stockQty: 1_000, reorderPoint: 1, expiresAt: '2026-07-01' })
      const alertas = await listarAlertasDeEstoque(svc, tenantId, HOJE)
      const alerta = alertas.find((a) => a.productId === produtoId)
      expect(alerta?.validade).toBe('bloqueado')
    },
    30_000,
  )

  it(
    'produto vencendo em 20 dias entra em alerta de validade',
    async () => {
      const produtoId = await criarProduto({ name: 'Vencendo Logo', stockQty: 1_000, reorderPoint: 1, expiresAt: '2026-09-07' })
      const alertas = await listarAlertasDeEstoque(svc, tenantId, HOJE)
      const alerta = alertas.find((a) => a.productId === produtoId)
      expect(alerta?.validade).toBe('alerta')
    },
    30_000,
  )
})
