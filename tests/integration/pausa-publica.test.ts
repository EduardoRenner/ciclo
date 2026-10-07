import { randomUUID } from 'node:crypto'

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { AppError } from '@/server/http/errors'
import { executarOnboarding } from '@/server/services/onboarding'
import { criarPedidoDeOrcamento } from '@/server/services/pedido-de-orcamento'
import { disponibilidadePublica, perfilPublico } from '@/server/services/public-booking'

import type { Database } from '@/server/db/types.gen'

// Estas regras são as do programa de cortesia: valem com `ACESSO_ABERTO` desligado.
vi.mock('@/core/billing/acesso-aberto', () => ({ ACESSO_ABERTO: false }))

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) throw new Error('O teste da pausa pública precisa de NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.')

const svc = createClient<Database>(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })

let tenantId: string
let userId: string
let slug: string

const VIGENTE = { plano: 'equipe', ate: '2099-01-01T03:00:00.000Z', origem: 'teste', concedida_em: '2026-10-01T12:00:00.000Z', fundador: false }
const VENCIDA = { plano: 'equipe', ate: '2026-09-01T03:00:00.000Z', origem: 'teste', concedida_em: '2026-07-01T12:00:00.000Z', fundador: false }

async function definirCortesia(cortesia: unknown, plan: 'gratis' | 'equipe' = 'gratis') {
  const { data } = await svc.from('tenants').select('settings').eq('id', tenantId).single()
  const settings = { ...((data?.settings as Record<string, unknown> | null) ?? {}), cortesia }
  const { error } = await svc.from('tenants').update({ plan, settings: settings as never }).eq('id', tenantId)
  if (error) throw error
}

beforeAll(async () => {
  const marca = randomUUID().slice(0, 8)
  const { data, error } = await svc.auth.admin.createUser({ email: `pausa-${marca}@ciclo.test`, password: randomUUID(), email_confirm: true, user_metadata: { full_name: 'Dona da Pausa' } })
  if (error || !data.user) throw new Error(`seed falhou: ${error?.message}`)
  userId = data.user.id
  slug = `pausa-${marca}`
  const { tenant } = await executarOnboarding(svc, { userId, businessName: 'Salão da Pausa', vertical: 'barber', slug, timezone: 'America/Sao_Paulo' })
  tenantId = tenant.id
}, 60_000)

afterAll(async () => {
  await svc.from('tenants').delete().eq('id', tenantId)
  await svc.auth.admin.deleteUser(userId)
}, 60_000)

async function contarOrcamentos(): Promise<number> {
  const { count, error } = await svc.from('quotes').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId)
  if (error || count === null) throw new Error(`contagem de orçamentos falhou: ${error?.message}`)
  return count
}

async function recusa(promessa: Promise<unknown>): Promise<AppError> {
  try {
    await promessa
  } catch (e) {
    if (e instanceof AppError) return e
    throw e
  }
  throw new Error('Era para recusar e não recusou: o negócio pausado recebeu o pedido.')
}

describe('negócio pausado não recebe pelo link público (docs/86 C8)', () => {
  it(
    'com a cortesia vigente, a página abre e o pedido de orçamento entra (controle: o cenário recusado vem do estado, não de erro de montagem)',
    async () => {
      await definirCortesia(VIGENTE)
      const perfil = await perfilPublico(slug)
      expect(perfil.name).toBe('Salão da Pausa')
      const r = await criarPedidoDeOrcamento(slug, { message: 'Preciso de um orçamento para o salão.', name: 'Visitante', phone: '11988887777' })
      expect(r).toEqual({ ok: true })
      // Controle: o pedido virou linha. Sem isto, "nada foi gravado" mais abaixo passaria numa tabela errada.
      expect(await contarOrcamentos()).toBe(1)
    },
    30_000,
  )

  it(
    'pausado: a leitura do perfil, a consulta de horários e o pedido de orçamento recusam com a marca de indisponível',
    async () => {
      await definirCortesia(VENCIDA)
      const antes = await contarOrcamentos()

      const e1 = await recusa(perfilPublico(slug))
      expect(e1.code).toBe('NOT_FOUND')
      expect(e1.details).toEqual({ indisponivel: true, nome: 'Salão da Pausa', telefone: null })

      const e2 = await recusa(disponibilidadePublica(slug, randomUUID(), '2099-01-05'))
      expect(e2.details).toEqual({ indisponivel: true, nome: 'Salão da Pausa', telefone: null })

      const e3 = await recusa(criarPedidoDeOrcamento(slug, { message: 'Quero um orçamento agora.', name: 'Visitante', phone: '11988887777' }))
      expect(e3.details).toEqual({ indisponivel: true, nome: 'Salão da Pausa', telefone: null })

      // Recusar sem gravar: o pedido não pode ter virado linha antes de a recusa chegar.
      expect(await contarOrcamentos()).toBe(antes)
    },
    30_000,
  )

  it(
    'assinar (plano pago) reabre a página na hora, sem esperar nada',
    async () => {
      await definirCortesia(VENCIDA, 'equipe')
      const perfil = await perfilPublico(slug)
      expect(perfil.name).toBe('Salão da Pausa')
    },
    30_000,
  )

  it('um slug que não existe segue como 404 comum, sem a marca de indisponível', async () => {
    const e = await recusa(perfilPublico(`nao-existe-${randomUUID().slice(0, 8)}`))
    expect(e.code).toBe('NOT_FOUND')
    expect(e.details).toBeUndefined()
  })
})
