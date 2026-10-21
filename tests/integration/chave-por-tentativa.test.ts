import { randomUUID } from 'node:crypto'

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { fetchComTentativa } from '@/lib/tentativa'
import { AppError } from '@/server/http/errors'
import { comIdempotencia } from '@/server/http/idempotency'
import { respostaErro, respostaOk } from '@/server/http/response'
import { adicionarItemComanda, buscarComanda } from '@/server/services/comanda'
import { executarOnboarding } from '@/server/services/onboarding'
import { criarProfissional } from '@/server/services/profissionais'
import { criarServico } from '@/server/services/servicos'

import type { Database } from '@/server/db/types.gen'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error('O teste de chave por tentativa precisa de NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local.')
}

const svc = createClient<Database>(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })

let tenantId: string
let professionalId: string
let servicoId: string
const tenants: string[] = []
const usuarios: string[] = []

/*
 * APR-007 de ponta a ponta, sem cookie de sessão: o `fetch` global vira um adaptador que entrega o
 * pedido do CLIENTE real (`fetchComTentativa`) ao MECANISMO real do servidor (`comIdempotencia` +
 * `adicionarItemComanda`), do mesmo jeito que a rota `tickets/[id]/items` os junta. Assim o teste
 * mede a combinação que importa — a chave que o cliente manda e o que o banco grava com ela.
 */
beforeAll(async () => {
  const marca = randomUUID().slice(0, 8)
  const { data, error } = await svc.auth.admin.createUser({
    email: `tentativa-${marca}@ciclo.test`,
    password: randomUUID(),
    email_confirm: true,
    user_metadata: { full_name: 'Dona da Tentativa' },
  })
  if (error || !data.user) throw new Error(`seed falhou: ${error?.message}`)
  usuarios.push(data.user.id)

  const { tenant } = await executarOnboarding(svc, {
    userId: data.user.id,
    businessName: 'Salão da Tentativa',
    vertical: 'nails',
    slug: `tentativa-${marca}`,
    timezone: 'America/Sao_Paulo',
  })
  tenantId = tenant.id
  tenants.push(tenantId)

  professionalId = (
    await criarProfissional(svc, tenantId, { displayName: 'Manicure', compModel: 'commission', commissionBps: 4_000, rentCents: 0, acceptsOnline: true })
  ).id
  servicoId = (
    await criarServico(svc, tenantId, {
      name: 'Esmaltação',
      description: null,
      durationMin: 60,
      bufferBeforeMin: 0,
      bufferAfterMin: 0,
      priceCents: 5_000,
      pricingModel: 'fixed',
      cycleDays: 21,
      depositBps: 0,
      depositMinCents: 0,
      parallelCapacity: 1,
      requiresAnamnesis: false,
      bookableOnline: true,
      categoryId: null,
    })
  ).id

  // Só o endereço da rota é desviado: o cliente do Supabase também usa o `fetch` global.
  const fetchReal = globalThis.fetch
  vi.stubGlobal('fetch', async (url: string | URL | Request, init?: RequestInit) => {
    if (typeof url !== 'string' || !url.startsWith('/api/v1/')) return fetchReal(url, init)
    const req = new Request(`http://test.local${url}`, init)
    const ticketId = url.split('/')[4]!
    try {
      const corpo = (await req.clone().json()) as { qty: number }
      const item = await comIdempotencia(req, { tenantId, endpoint: `/api/v1/tickets/${ticketId}/items` }, () =>
        adicionarItemComanda(svc, tenantId, ticketId, { serviceId: servicoId, professionalId, qty: corpo.qty, discountCents: 0 }),
      )
      return respostaOk(item, { requestId: 'teste' })
    } catch (erro) {
      return respostaErro(erro instanceof AppError ? erro : new AppError('INTERNAL', { cause: erro }), 'teste')
    }
  })
}, 60_000)

afterAll(async () => {
  vi.unstubAllGlobals()
  for (const t of tenants) await svc.from('tenants').delete().eq('id', t)
  for (const u of usuarios) await svc.auth.admin.deleteUser(u)
}, 60_000)

async function abrirTicketVazio() {
  const cliente = await svc.from('clients').insert({ tenant_id: tenantId, name: `Cliente ${randomUUID().slice(0, 6)}` }).select('id').single()
  const ticket = await svc.from('tickets').insert({ tenant_id: tenantId, client_id: cliente.data!.id, professional_id: professionalId }).select('id').single()
  return ticket.data!.id
}

function lancar(ticketId: string) {
  return fetchComTentativa(`/api/v1/tickets/${ticketId}/items`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ qty: 1 }),
  })
}

describe('chave de idempotência por tentativa contra o banco (APR-007)', () => {
  it(
    'duplo toque em "Adicionar item", os dois em voo: 1 item, e os dois toques recebem sucesso',
    async () => {
      const ticketId = await abrirTicketVazio()
      const [a, b] = await Promise.all([lancar(ticketId), lancar(ticketId)])
      expect([a.status, b.status]).toEqual([200, 200])

      const { items } = await buscarComanda(svc, tenantId, ticketId)
      expect(items).toHaveLength(1)
    },
    30_000,
  )

  it(
    'o mesmo item de novo DEPOIS do sucesso: 2 itens (venda repetida de propósito não some)',
    async () => {
      const ticketId = await abrirTicketVazio()
      expect((await lancar(ticketId)).status).toBe(200)
      expect((await lancar(ticketId)).status).toBe(200)

      const { items } = await buscarComanda(svc, tenantId, ticketId)
      expect(items).toHaveLength(2)
    },
    30_000,
  )
})
