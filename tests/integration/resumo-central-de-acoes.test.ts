import { randomUUID } from 'node:crypto'

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { afterAll, describe, expect, it } from 'vitest'

import { criarCliente, removerCliente } from '@/server/services/clientes'
import { criarProfissional } from '@/server/services/profissionais'
import { criarServico } from '@/server/services/servicos'
import { executarOnboarding } from '@/server/services/onboarding'

import type { Database } from '@/server/db/types.gen'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) throw new Error('Precisa de NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.')

const svc = createClient<Database>(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })

/**
 * migration 0089 — `resumo_central_de_acoes` substitui quatro consultas separadas
 * (`clients`, `appointments`, `v_clientes_a_recuperar`, `v_client_segments`, todas `count`) por
 * uma função só, numa ida de rede (docs/28 §12). As views por trás já têm suíte própria
 * (`quantos-estao-sumindo-e-um-numero-so`, `view-no-fuso-do-salao`); este arquivo prova só que a
 * FUNÇÃO devolve os números certos — em particular que `clientes` e `agendamentos` contam de
 * verdade contra dado seedado, e que cliente arquivado (soft-delete) não entra na contagem.
 */
const usuarios: string[] = []
const tenants: string[] = []

async function novoTenant() {
  const marca = randomUUID().slice(0, 8)
  const { data, error } = await svc.auth.admin.createUser({ email: `resumo-${marca}@ciclo.test`, password: randomUUID(), email_confirm: true })
  if (error || !data.user) throw new Error(`seed falhou: ${error?.message}`)
  usuarios.push(data.user.id)

  const { tenant } = await executarOnboarding(svc, {
    userId: data.user.id,
    businessName: 'Salão do Resumo',
    vertical: 'barber',
    slug: `resumo-${marca}`,
    timezone: 'America/Sao_Paulo',
  })
  tenants.push(tenant.id)
  return tenant.id
}

afterAll(async () => {
  for (const t of tenants) await svc.from('tenants').delete().eq('id', t)
  for (const u of usuarios) await svc.auth.admin.deleteUser(u)
}, 60_000)

describe('resumo_central_de_acoes (RPC, 0089)', () => {
  it(
    'conta clientes e agendamentos de verdade, e cliente arquivado não entra na contagem',
    async () => {
      const tenantId = await novoTenant()

      const c1 = await criarCliente(svc, tenantId, { name: 'Cliente Ativo 1', tags: [], marketingOptIn: false })
      const c2 = await criarCliente(svc, tenantId, { name: 'Cliente Ativo 2', tags: [], marketingOptIn: false })
      const c3 = await criarCliente(svc, tenantId, { name: 'Cliente Arquivado', tags: [], marketingOptIn: false })
      await removerCliente(svc, tenantId, c3.id)

      const profissional = await criarProfissional(svc, tenantId, {
        displayName: 'Profissional de Teste',
        compModel: 'owner',
        commissionBps: 0,
        rentCents: 0,
        acceptsOnline: true,
      })
      const servico = await criarServico(svc, tenantId, {
        name: 'Corte do Teste de Resumo',
        description: null,
        durationMin: 30,
        bufferBeforeMin: 0,
        bufferAfterMin: 0,
        priceCents: 5000,
        pricingModel: 'fixed',
        cycleDays: 21,
        depositBps: 0,
        depositMinCents: 0,
        parallelCapacity: 1,
        requiresAnamnesis: false,
        bookableOnline: true,
        categoryId: null,
      })

      const inicio = new Date(Date.now() + 60 * 60_000)
      const { error: erroAg1 } = await svc.from('appointments').insert({
        tenant_id: tenantId,
        client_id: c1.id,
        professional_id: profissional.id,
        service_id: servico.id,
        starts_at: inicio.toISOString(),
        ends_at: new Date(inicio.getTime() + 30 * 60_000).toISOString(),
        status: 'pending',
        price_cents: 5000,
      })
      if (erroAg1) throw new Error(`seed de agendamento falhou: ${erroAg1.message}`)

      const inicio2 = new Date(Date.now() + 120 * 60_000)
      const { error: erroAg2 } = await svc.from('appointments').insert({
        tenant_id: tenantId,
        client_id: c2.id,
        professional_id: profissional.id,
        service_id: servico.id,
        starts_at: inicio2.toISOString(),
        ends_at: new Date(inicio2.getTime() + 30 * 60_000).toISOString(),
        status: 'pending',
        price_cents: 5000,
      })
      if (erroAg2) throw new Error(`seed de agendamento falhou: ${erroAg2.message}`)

      const { data, error } = await svc.rpc('resumo_central_de_acoes', { p_tenant: tenantId }).single()
      if (error) throw error

      expect(data?.clientes, 'cliente arquivado não pode entrar na contagem').toBe(2)
      expect(data?.agendamentos).toBe(2)
    },
    30_000,
  )

  it(
    'tenant novo sem nada devolve zero em tudo, não erro',
    async () => {
      const tenantId = await novoTenant()

      const { data, error } = await svc.rpc('resumo_central_de_acoes', { p_tenant: tenantId }).single()
      if (error) throw error

      expect(data).toEqual({ clientes: 0, agendamentos: 0, em_risco: 0, aniversariantes: 0 })
    },
    30_000,
  )
})
