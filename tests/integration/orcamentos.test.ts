import { randomUUID } from 'node:crypto'

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { criarProfissional } from '@/server/services/profissionais'
import { criarOrcamento } from '@/server/services/orcamentos'
import { executarOnboarding } from '@/server/services/onboarding'

import { GET as buscarOrcamentoPorToken } from '@/app/api/v1/public/quotes/[token]/route'
import { POST as aprovarPorToken } from '@/app/api/v1/public/quotes/[token]/approve/route'
import { POST as recusarPorToken } from '@/app/api/v1/public/quotes/[token]/reject/route'

import type { Database } from '@/server/db/types.gen'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error('O teste de orçamentos precisa de NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local.')
}

const svc = createClient<Database>(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })

const TZ = 'America/Sao_Paulo'
let tenantId: string
let userId: string
let professionalId: string
let clientId: string
const tenants: string[] = []
const usuarios: string[] = []

beforeAll(async () => {
  const marca = randomUUID().slice(0, 8)
  const { data, error } = await svc.auth.admin.createUser({
    email: `orcamento-${marca}@ciclo.test`,
    password: randomUUID(),
    email_confirm: true,
    user_metadata: { full_name: 'Dona do Orçamento' },
  })
  if (error || !data.user) throw new Error(`seed falhou: ${error?.message}`)
  userId = data.user.id
  usuarios.push(userId)

  const { tenant } = await executarOnboarding(svc, {
    userId,
    businessName: 'Salão do Orçamento',
    vertical: 'barber',
    slug: `orcamento-${marca}`,
    timezone: TZ,
  })
  tenantId = tenant.id
  tenants.push(tenantId)

  const profissional = await criarProfissional(svc, tenantId, {
    displayName: 'Profissional de Teste',
    compModel: 'owner',
    commissionBps: 0,
    rentCents: 0,
    acceptsOnline: true,
  })
  professionalId = profissional.id

  const { data: cliente, error: erroCliente } = await svc
    .from('clients')
    .insert({ tenant_id: tenantId, name: 'Cliente do Orçamento', phone_e164: `+5511${Math.floor(1e8 + Math.random() * 9e8)}` })
    .select('id')
    .single()
  if (erroCliente || !cliente) throw new Error(`seed de cliente falhou: ${erroCliente?.message}`)
  clientId = cliente.id
}, 60_000)

afterAll(async () => {
  for (const t of tenants) await svc.from('tenants').delete().eq('id', t)
  for (const u of usuarios) await svc.auth.admin.deleteUser(u)
})

function req(path: 'approve' | 'reject', token: string, body: unknown = {}): Request {
  return new Request(`https://interno/api/v1/public/quotes/${token}/${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}
function ctx(token: string) {
  return { params: Promise.resolve({ token }) }
}

describe('criarOrcamento (docs/09-PLATAFORMA.md §11)', () => {
  it('soma os itens em total_cents e já nasce "sent" com um token utilizável', async () => {
    const { quote, token } = await criarOrcamento(svc, tenantId, userId, {
      clientId,
      professionalId,
      items: [
        { description: 'Mão de obra', qty: 1, unitPriceCents: 30000 },
        { description: 'Material', qty: 2, unitPriceCents: 5000 },
      ],
      validUntil: null,
      message: 'Orçamento pra reforma do banheiro',
    })

    expect(quote.status).toBe('sent')
    expect(quote.total_cents).toBe(40000)
    expect(quote.sent_at).not.toBeNull()
    expect(token).toBeTruthy()

    const { data: itens } = await svc.from('quote_items').select('description, total_cents').eq('quote_id', quote.id).order('description')
    expect(itens).toHaveLength(2)
    expect(itens!.find((i) => i.description === 'Mão de obra')?.total_cents).toBe(30000)
  })
})

describe('GET público por token', () => {
  it('mostra o valor total visível (nunca assinatura em branco) e os itens', async () => {
    const { token } = await criarOrcamento(svc, tenantId, userId, {
      clientId,
      professionalId,
      items: [{ description: 'Serviço X', qty: 1, unitPriceCents: 12000 }],
      validUntil: null,
      message: null,
    })

    const r = await buscarOrcamentoPorToken(new Request(`https://interno/api/v1/public/quotes/${token}`), ctx(token))
    expect(r.status).toBe(200)
    const json = (await r.json()) as { data: { status: string; totalCents: number; businessName: string; items: unknown[] } }
    expect(json.data.status).toBe('sent')
    expect(json.data.totalCents).toBe(12000)
    expect(json.data.businessName).toBe('Salão do Orçamento')
    expect(json.data.items).toHaveLength(1)
  })

  it('token forjado é recusado com 404', async () => {
    const r = await buscarOrcamentoPorToken(new Request('https://interno/api/v1/public/quotes/forjado'), ctx('forjado'))
    expect(r.status).toBe(404)
  })
})

describe('aprovar/recusar por link', () => {
  it('aprovar marca approved_at e avisa a equipe (best-effort, não trava a resposta)', async () => {
    const { quote, token } = await criarOrcamento(svc, tenantId, userId, {
      clientId,
      professionalId,
      items: [{ description: 'Item', qty: 1, unitPriceCents: 8000 }],
      validUntil: null,
      message: null,
    })

    const r = await aprovarPorToken(req('approve', token), ctx(token))
    expect(r.status).toBe(200)
    const json = (await r.json()) as { data: { status: string } }
    expect(json.data.status).toBe('approved')

    const linha = await svc.from('quotes').select('status, approved_at').eq('id', quote.id).single()
    expect(linha.data?.status).toBe('approved')
    expect(linha.data?.approved_at).not.toBeNull()
  })

  it('recusar grava o motivo quando informado', async () => {
    const { quote, token } = await criarOrcamento(svc, tenantId, userId, {
      clientId,
      professionalId,
      items: [{ description: 'Item', qty: 1, unitPriceCents: 8000 }],
      validUntil: null,
      message: null,
    })

    const r = await recusarPorToken(req('reject', token, { reason: 'Muito caro' }), ctx(token))
    expect(r.status).toBe(200)

    const linha = await svc.from('quotes').select('status, rejected_reason').eq('id', quote.id).single()
    expect(linha.data?.status).toBe('rejected')
    expect(linha.data?.rejected_reason).toBe('Muito caro')
  })

  it('clicar em aprovar duas vezes não quebra — devolve o mesmo estado aprovado, sem erro', async () => {
    const { token } = await criarOrcamento(svc, tenantId, userId, {
      clientId,
      professionalId,
      items: [{ description: 'Item', qty: 1, unitPriceCents: 1000 }],
      validUntil: null,
      message: null,
    })

    const r1 = await aprovarPorToken(req('approve', token), ctx(token))
    expect(r1.status).toBe(200)
    const r2 = await aprovarPorToken(req('approve', token), ctx(token))
    expect(r2.status).toBe(200)
    const json2 = (await r2.json()) as { data: { status: string } }
    expect(json2.data.status).toBe('approved')
  })

  it('aprovar um orçamento já recusado é erro de verdade, não idempotência silenciosa', async () => {
    const { token } = await criarOrcamento(svc, tenantId, userId, {
      clientId,
      professionalId,
      items: [{ description: 'Item', qty: 1, unitPriceCents: 1000 }],
      validUntil: null,
      message: null,
    })

    await recusarPorToken(req('reject', token), ctx(token))
    const r = await aprovarPorToken(req('approve', token), ctx(token))
    expect(r.status).toBe(422)
  })

  it('orçamento vencido (valid_until no passado) não pode mais ser aprovado', async () => {
    const { quote, token } = await criarOrcamento(svc, tenantId, userId, {
      clientId,
      professionalId,
      items: [{ description: 'Item', qty: 1, unitPriceCents: 1000 }],
      validUntil: '2020-01-01',
      message: null,
    })
    void quote

    const r = await aprovarPorToken(req('approve', token), ctx(token))
    expect(r.status).toBe(422)

    // GET público também reflete o vencimento e materializa o status.
    const rGet = await buscarOrcamentoPorToken(new Request(`https://interno/api/v1/public/quotes/${token}`), ctx(token))
    const json = (await rGet.json()) as { data: { status: string } }
    expect(json.data.status).toBe('expired')
  })
})
