import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { afterAll, describe, expect, it } from 'vitest'

import { desfechoDoCadastro } from '@/server/auth/desfecho-do-cadastro'
import { SENHA_MINIMA } from '@/server/auth/password'

import type { Database } from '@/server/db/types.gen'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) {
  throw new Error('O teste do cadastro precisa de NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY no .env.local.')
}

const svc = createClient<Database>(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
const anon = () => createClient<Database>(SUPABASE_URL!, ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })
const usuarios: string[] = []

afterAll(async () => {
  for (const u of usuarios) await svc.auth.admin.deleteUser(u)
}, 60_000)

/*
 * APR-025 (achado F-03): a classificação contra os erros REAIS do Auth local, não contra um objeto
 * inventado — o formato do erro é do Supabase, e é ele que pode mudar.
 */
describe('desfecho do cadastro com o Auth de verdade (APR-025)', () => {
  it(
    'senha abaixo do mínimo do Auth: senha fraca, com motivo — não "mandamos o link"',
    async () => {
      const { error } = await anon().auth.signUp({ email: `fraca-${randomUUID().slice(0, 8)}@ciclo.test`, password: '1234567' })
      expect(error?.code).toBe('weak_password')
      expect(desfechoDoCadastro(error)).toBe('senha_fraca')
    },
    30_000,
  )

  it(
    'e-mail já cadastrado: o mesmo desfecho do e-mail novo (o cadastro não vira verificador de conta)',
    async () => {
      const email = `existe-${randomUUID().slice(0, 8)}@ciclo.test`
      const criado = await svc.auth.admin.createUser({ email, password: randomUUID(), email_confirm: true })
      usuarios.push(criado.data.user!.id)
      const { error } = await anon().auth.signUp({ email, password: `Ciclo-${randomUUID()}` })
      expect(desfechoDoCadastro(error)).toBe('aceito')

      const novo = await anon().auth.signUp({ email: `novo-${randomUUID().slice(0, 8)}@ciclo.test`, password: `Ciclo-${randomUUID()}` })
      if (novo.data.user) usuarios.push(novo.data.user.id)
      expect(desfechoDoCadastro(novo.error)).toBe('aceito')
    },
    30_000,
  )

  it(
    'e-mail malformado: diz para conferir o e-mail',
    async () => {
      const { error } = await anon().auth.signUp({ email: 'sem-arroba.ciclo.test', password: `Ciclo-${randomUUID()}` })
      expect(desfechoDoCadastro(error)).toBe('email_invalido')
    },
    30_000,
  )

  it('o mínimo do Auth local é o MESMO do app (piso único)', () => {
    const config = readFileSync('supabase/config.toml', 'utf8')
    const minimo = Number(config.match(/^minimum_password_length\s*=\s*(\d+)/m)?.[1])
    expect(minimo, 'minimum_password_length não encontrado no config.toml').toBeGreaterThan(0)
    expect(minimo).toBe(SENHA_MINIMA)
  })
})
