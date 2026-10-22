import { randomUUID } from 'node:crypto'

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { numeroTemCadastro } from '@/server/db/with-tenant'
import { executarOnboarding } from '@/server/services/onboarding'
import { hashTelefone } from '@/server/services/telefone'

import type { Database } from '@/server/db/types.gen'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) {
  throw new Error('O teste do código só para cadastrado precisa de NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY no .env.local.')
}

const svc = createClient<Database>(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
const anon = () => createClient<Database>(SUPABASE_URL!, ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })

/** Faixa 11 97771-xxxx, só deste arquivo. */
const PROFISSIONAL = '+5511977710001'
const CLIENTE = '+5511977710002'
const CLIENTE_ANONIMIZADA = '+5511977710003'
const CLIENTE_APAGADA = '+5511977710004'
const DESCONHECIDO = '+5511977710009'
const PERFIL_DE_EMAIL = '+5511977710005'

const usuarios: string[] = []
const tenants: string[] = []

beforeAll(async () => {
  const marca = randomUUID().slice(0, 8)

  const prof = await svc.auth.admin.createUser({ phone: PROFISSIONAL.slice(1), phone_confirm: true, password: randomUUID() })
  if (prof.error || !prof.data.user) throw new Error(`seed falhou: ${prof.error?.message}`)
  usuarios.push(prof.data.user.id)

  const dona = await svc.auth.admin.createUser({
    email: `codigo-${marca}@ciclo.test`,
    password: randomUUID(),
    email_confirm: true,
    user_metadata: { full_name: 'Dona com E-mail', phone: PERFIL_DE_EMAIL },
  })
  if (dona.error || !dona.data.user) throw new Error(`seed falhou: ${dona.error?.message}`)
  usuarios.push(dona.data.user.id)

  const { tenant } = await executarOnboarding(svc, {
    userId: dona.data.user.id,
    businessName: 'Salão do Código',
    vertical: 'barber',
    slug: `codigo-${marca}`,
    timezone: 'America/Sao_Paulo',
  })
  tenants.push(tenant.id)

  const agora = new Date().toISOString()
  const { error } = await svc.from('clients').insert([
    { tenant_id: tenant.id, name: 'Cliente Ativa', phone_e164: CLIENTE, phone_hash: hashTelefone(CLIENTE) },
    { tenant_id: tenant.id, name: 'Cliente Anonimizada', phone_e164: null, phone_hash: hashTelefone(CLIENTE_ANONIMIZADA), anonymized_at: agora },
    { tenant_id: tenant.id, name: 'Cliente Apagada', phone_e164: CLIENTE_APAGADA, phone_hash: hashTelefone(CLIENTE_APAGADA), deleted_at: agora },
  ])
  if (error) throw new Error(`seed de clientes falhou: ${error.message}`)
}, 60_000)

afterAll(async () => {
  for (const t of tenants) await svc.from('tenants').delete().eq('id', t)
  for (const u of usuarios) await svc.auth.admin.deleteUser(u)
}, 60_000)

describe('código pelo WhatsApp só para número cadastrado (docs/119, migration 0147)', () => {
  it('profissional com conta pelo número: tem cadastro', async () => {
    expect(await numeroTemCadastro(PROFISSIONAL, hashTelefone(PROFISSIONAL))).toBe(true)
  }, 30_000)

  it('conta de e-mail que informou o WhatsApp no perfil: tem cadastro', async () => {
    expect(await numeroTemCadastro(PERFIL_DE_EMAIL, hashTelefone(PERFIL_DE_EMAIL))).toBe(true)
  }, 30_000)

  it('cliente de um negócio, sem conta no Auth: tem cadastro (pelo hash)', async () => {
    expect(await numeroTemCadastro(CLIENTE, hashTelefone(CLIENTE))).toBe(true)
  }, 30_000)

  it('cliente anonimizada ou apagada não recebe código', async () => {
    expect(await numeroTemCadastro(CLIENTE_ANONIMIZADA, hashTelefone(CLIENTE_ANONIMIZADA))).toBe(false)
    expect(await numeroTemCadastro(CLIENTE_APAGADA, hashTelefone(CLIENTE_APAGADA))).toBe(false)
  }, 30_000)

  it('número desconhecido: não tem cadastro', async () => {
    expect(await numeroTemCadastro(DESCONHECIDO, hashTelefone(DESCONHECIDO))).toBe(false)
  }, 30_000)

  it('sem o hash, a cliente não é achada, mas a conta continua sendo', async () => {
    expect(await numeroTemCadastro(CLIENTE, null)).toBe(false)
    expect(await numeroTemCadastro(PROFISSIONAL, null)).toBe(true)
  }, 30_000)

  it('quem está do lado de fora não pergunta ao banco se um número existe', async () => {
    const { error } = await anon().rpc('numero_tem_cadastro', { p_telefone: PROFISSIONAL, p_phone_hash: hashTelefone(PROFISSIONAL) })
    expect(error).not.toBeNull()
  }, 30_000)

  it(
    'o canal whatsapp que a rota pede é aceito pelo Auth, e o código confere (número de teste, nada sai)',
    async () => {
      const NUMERO = '+5511900000003'
      const { data: todos } = await svc.auth.admin.listUsers({ perPage: 1000 })
      for (const u of todos.users) if (u.phone === NUMERO.slice(1)) await svc.auth.admin.deleteUser(u.id)
      const criado = await svc.auth.admin.createUser({ phone: NUMERO.slice(1), phone_confirm: true, password: randomUUID() })
      usuarios.push(criado.data.user!.id)
      expect(await numeroTemCadastro(NUMERO, hashTelefone(NUMERO))).toBe(true)

      const db = anon()
      const pedido = await db.auth.signInWithOtp({ phone: NUMERO, options: { shouldCreateUser: true, channel: 'whatsapp' } })
      expect(pedido.error).toBeNull()
      const { data, error } = await db.auth.verifyOtp({ phone: NUMERO, token: '123456', type: 'sms' })
      expect(error).toBeNull()
      expect(data.user?.id).toBe(criado.data.user!.id)
    },
    30_000,
  )

  it('nem quem entrou com uma conta qualquer', async () => {
    const email = `curiosa-${randomUUID().slice(0, 8)}@ciclo.test`
    const senha = randomUUID()
    const u = await svc.auth.admin.createUser({ email, password: senha, email_confirm: true })
    usuarios.push(u.data.user!.id)
    const db = anon()
    expect((await db.auth.signInWithPassword({ email, password: senha })).error).toBeNull()
    const { error } = await db.rpc('numero_tem_cadastro', { p_telefone: PROFISSIONAL, p_phone_hash: hashTelefone(PROFISSIONAL) })
    expect(error).not.toBeNull()
  }, 30_000)
})
