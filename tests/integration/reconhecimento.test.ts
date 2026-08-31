import { randomUUID } from 'node:crypto'

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { gerarTokenReconhecimento } from '@/server/services/reconhecimento'
import { hashTelefone, normalizarTelefoneBR } from '@/server/services/telefone'
import { executarOnboarding } from '@/server/services/onboarding'

import { GET as reconhecerPorToken } from '@/app/api/v1/public/[slug]/reconhecer/route'

import type { Database } from '@/server/db/types.gen'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error('O teste de reconhecimento precisa de NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local.')
}

const svc = createClient<Database>(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })

const TZ = 'America/Sao_Paulo'
let tenantId: string
let outroTenantId: string
let slug: string
let userId: string
let serviceId: string
const tenants: string[] = []
const usuarios: string[] = []

const TELEFONE = normalizarTelefoneBR('11976543210')!

function req(slugDoPath: string, token: string): Request {
  return new Request(`https://interno/api/v1/public/${slugDoPath}/reconhecer?token=${encodeURIComponent(token)}`)
}
function ctx(slugDoPath: string) {
  return { params: Promise.resolve({ slug: slugDoPath }) }
}

beforeAll(async () => {
  const marca = randomUUID().slice(0, 8)
  const { data, error } = await svc.auth.admin.createUser({
    email: `reconhecimento-${marca}@ciclo.test`,
    password: randomUUID(),
    email_confirm: true,
    user_metadata: { full_name: 'Dona do Reconhecimento' },
  })
  if (error || !data.user) throw new Error(`seed falhou: ${error?.message}`)
  userId = data.user.id
  usuarios.push(userId)

  slug = `reconhecimento-${marca}`
  const { tenant } = await executarOnboarding(svc, {
    userId,
    businessName: 'Salão do Reconhecimento',
    vertical: 'barber',
    slug,
    timezone: TZ,
  })
  tenantId = tenant.id
  tenants.push(tenantId)

  const { tenant: outro } = await executarOnboarding(svc, {
    userId,
    businessName: 'Outro Salão',
    vertical: 'barber',
    slug: `outro-${marca}`,
    timezone: TZ,
  })
  outroTenantId = outro.id
  tenants.push(outroTenantId)

  const { data: servico, error: erroServico } = await svc.from('services').select('id').eq('tenant_id', tenantId).limit(1).single()
  if (erroServico || !servico) throw new Error(`seed não trouxe serviço nenhum: ${erroServico?.message}`)
  serviceId = servico.id

  const { data: cliente, error: erroCliente } = await svc
    .from('clients')
    .insert({ tenant_id: tenantId, name: 'Bruna Oliveira', phone_e164: TELEFONE, phone_hash: hashTelefone(TELEFONE), last_visit_at: new Date().toISOString() })
    .select('id')
    .single()
  if (erroCliente || !cliente) throw new Error(`seed de cliente falhou: ${erroCliente?.message}`)

  const { error: erroCiclo } = await svc.from('client_cycles').insert({
    tenant_id: tenantId,
    client_id: cliente.id,
    service_id: serviceId,
    personal_cycle_days: 24,
    last_visit_on: new Date().toISOString().slice(0, 10),
  })
  if (erroCiclo) throw new Error(`seed de ciclo falhou: ${erroCiclo.message}`)
}, 60_000)

afterAll(async () => {
  for (const t of tenants) await svc.from('tenants').delete().eq('id', t)
  for (const u of usuarios) await svc.auth.admin.deleteUser(u)
})

describe('GET /{slug}/reconhecer (docs/34-PAGINA-PUBLICA-PLANO.md, Fase 2)', () => {
  it('cliente conhecida: primeiro nome, dias desde a última e sugestão de serviço', async () => {
    const token = gerarTokenReconhecimento(tenantId, TELEFONE)
    const r = await reconhecerPorToken(req(slug, token), ctx(slug))
    expect(r.status).toBe(200)
    const json = (await r.json()) as {
      data: { conhecida: boolean; primeiroNome?: string; diasDesdeUltima?: number | null; sugestao?: { serviceId: string } | null }
    }
    expect(json.data.conhecida).toBe(true)
    expect(json.data.primeiroNome).toBe('Bruna')
    expect(json.data.diasDesdeUltima).toBe(0)
    expect(json.data.sugestao?.serviceId).toBe(serviceId)
  })

  it('token de outro tenant não reconhece nada, mesmo com o mesmo telefone', async () => {
    const token = gerarTokenReconhecimento(outroTenantId, TELEFONE)
    const r = await reconhecerPorToken(req(slug, token), ctx(slug))
    expect(r.status).toBe(200)
    const json = (await r.json()) as { data: { conhecida: boolean } }
    expect(json.data.conhecida).toBe(false)
  })

  it('token forjado/inválido devolve conhecida:false, nunca erro', async () => {
    const r = await reconhecerPorToken(req(slug, 'forjado'), ctx(slug))
    expect(r.status).toBe(200)
    const json = (await r.json()) as { data: { conhecida: boolean } }
    expect(json.data.conhecida).toBe(false)
  })

  it('telefone sem cliente cadastrada devolve conhecida:false', async () => {
    const outroTelefone = normalizarTelefoneBR('11988887777')!
    const token = gerarTokenReconhecimento(tenantId, outroTelefone)
    const r = await reconhecerPorToken(req(slug, token), ctx(slug))
    const json = (await r.json()) as { data: { conhecida: boolean } }
    expect(json.data.conhecida).toBe(false)
  })
})
