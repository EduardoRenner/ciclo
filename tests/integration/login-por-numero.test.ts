import { randomUUID } from 'node:crypto'

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { afterAll, describe, expect, it } from 'vitest'

import type { Database } from '@/server/db/types.gen'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) {
  throw new Error('O teste do login por número precisa de NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY no .env.local.')
}

const svc = createClient<Database>(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
const anon = () => createClient<Database>(SUPABASE_URL!, ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })

/*
 * Números de `[auth.sms.test_otp]` do `supabase/config.toml`: o Auth aceita "123456" e não manda
 * nada. Um número por caso, porque o Auth só deixa pedir código de novo para o mesmo número depois
 * de 30 s (`max_frequency`).
 */
const NUMERO_CONTA_NOVA = '+5511900000004'
const NUMERO_EM_CONTA_DE_EMAIL = '+5511900000005'
const NUMERO_CODIGO_ERRADO = '+5511900000006'
const CODIGO_DE_TESTE = '123456'

const usuarios: string[] = []

async function apagarQuemTemONumero(e164: string): Promise<void> {
  const { data } = await svc.auth.admin.listUsers({ perPage: 1000 })
  for (const u of data.users) if (u.phone === e164.slice(1)) await svc.auth.admin.deleteUser(u.id)
}

afterAll(async () => {
  for (const u of usuarios) await svc.auth.admin.deleteUser(u)
  for (const n of [NUMERO_CONTA_NOVA, NUMERO_EM_CONTA_DE_EMAIL, NUMERO_CODIGO_ERRADO]) await apagarQuemTemONumero(n)
}, 60_000)

describe('login por número com o Auth de verdade (docs/110 L1)', () => {
  it(
    'conta nova pelo número nasce com nome e telefone no perfil, sem e-mail',
    async () => {
      await apagarQuemTemONumero(NUMERO_CONTA_NOVA)
      const db = anon()
      const pedido = await db.auth.signInWithOtp({
        phone: NUMERO_CONTA_NOVA,
        options: { shouldCreateUser: true, data: { full_name: 'Ana Integração', phone: NUMERO_CONTA_NOVA } },
      })
      expect(pedido.error).toBeNull()

      const { data, error } = await db.auth.verifyOtp({ phone: NUMERO_CONTA_NOVA, token: CODIGO_DE_TESTE, type: 'sms' })
      expect(error).toBeNull()
      expect(data.session).not.toBeNull()
      usuarios.push(data.user!.id)

      const { data: perfil } = await svc.from('profiles').select('full_name, phone, email').eq('id', data.user!.id).single()
      expect(perfil).toEqual({ full_name: 'Ana Integração', phone: NUMERO_CONTA_NOVA, email: null })

      const { data: emOutra, error: erroRpc } = await db.rpc('telefone_em_outra_conta')
      expect(erroRpc).toBeNull()
      expect(emOutra).toBe(false)
    },
    30_000,
  )

  it(
    'sem nome no pedido, o perfil nasce com o telefone no lugar do nome (o gatilho não quebra)',
    async () => {
      // Antes da 0142 a reserva do nome era o e-mail, que a conta por número não tem: o insert do
      // perfil falhava e a conta não nascia. Criado pelo admin para não gastar um número de teste.
      const { data, error } = await svc.auth.admin.createUser({ phone: '5511988887777', phone_confirm: true })
      expect(error).toBeNull()
      usuarios.push(data.user!.id)
      const { data: perfil } = await svc.from('profiles').select('full_name, phone').eq('id', data.user!.id).single()
      expect(perfil).toEqual({ full_name: '+5511988887777', phone: '+5511988887777' })
    },
    30_000,
  )

  it(
    'número que já está numa conta com e-mail: o RPC acusa, para quem provou o número',
    async () => {
      await apagarQuemTemONumero(NUMERO_EM_CONTA_DE_EMAIL)
      const email = `dona-${randomUUID().slice(0, 8)}@ciclo.test`
      const contaDeEmail = await svc.auth.admin.createUser({
        email,
        password: randomUUID(),
        email_confirm: true,
        user_metadata: { full_name: 'Dona do Salão', phone: NUMERO_EM_CONTA_DE_EMAIL },
      })
      usuarios.push(contaDeEmail.data.user!.id)

      const db = anon()
      expect((await db.auth.signInWithOtp({ phone: NUMERO_EM_CONTA_DE_EMAIL })).error).toBeNull()
      const { data } = await db.auth.verifyOtp({ phone: NUMERO_EM_CONTA_DE_EMAIL, token: CODIGO_DE_TESTE, type: 'sms' })
      expect(data.user).not.toBeNull()

      const { data: emOutra } = await db.rpc('telefone_em_outra_conta')
      expect(emOutra).toBe(true)
    },
    30_000,
  )

  it(
    'quem não entrou não consegue perguntar se um número tem conta',
    async () => {
      const { error } = await anon().rpc('telefone_em_outra_conta')
      expect(error).not.toBeNull()
    },
    30_000,
  )

  it(
    'código errado não abre sessão',
    async () => {
      await apagarQuemTemONumero(NUMERO_CODIGO_ERRADO)
      const db = anon()
      expect((await db.auth.signInWithOtp({ phone: NUMERO_CODIGO_ERRADO })).error).toBeNull()
      const { data, error } = await db.auth.verifyOtp({ phone: NUMERO_CODIGO_ERRADO, token: '000000', type: 'sms' })
      expect(error).not.toBeNull()
      expect(data.session).toBeNull()
    },
    30_000,
  )
})
