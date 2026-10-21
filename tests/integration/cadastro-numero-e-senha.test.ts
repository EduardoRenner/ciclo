import { randomInt } from 'node:crypto'

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { afterAll, describe, expect, it } from 'vitest'

import type { Database } from '@/server/db/types.gen'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) {
  throw new Error('O teste do cadastro por número precisa de NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY no .env.local.')
}

const svc = createClient<Database>(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
const anon = () => createClient<Database>(SUPABASE_URL!, ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })

/*
 * docs/114 L-03 (decisão do Vitor, 21/10): conta com número + senha, sem e-mail e sem código, porque
 * o código depende da Meta, que não está ligada. Isto prova a CONFIGURAÇÃO do Auth (`[auth.sms]
 * enable_confirmations = false`): com ela ligada, o `signUp` volta sem sessão e a pessoa fica presa
 * esperando um código que não sai. Faixa 5511 98765 xxxx, fora dos números de teste do código.
 */
const numero = () => `+55119876${String(randomInt(0, 100_000)).padStart(5, '0')}`
const SENHA = `Ciclo-${randomInt(100_000, 999_999)}-teste`
const usuarios: string[] = []

afterAll(async () => {
  for (const u of usuarios) await svc.auth.admin.deleteUser(u)
}, 60_000)

describe('cadastro com número e senha, sem e-mail (L-03)', () => {
  it('a conta nasce com sessão, nome e número no perfil, sem e-mail', async () => {
    const telefone = numero()
    const { data, error } = await anon().auth.signUp({ phone: telefone, password: SENHA, options: { data: { full_name: 'Bia Integração', phone: telefone } } })
    expect(error).toBeNull()
    expect(data.session, 'sem sessão: a confirmação de telefone está ligada no Auth').not.toBeNull()
    usuarios.push(data.user!.id)

    const { data: perfil } = await svc.from('profiles').select('full_name, phone, email').eq('id', data.user!.id).single()
    expect(perfil).toEqual({ full_name: 'Bia Integração', phone: telefone, email: null })
  }, 30_000)

  it('entra de novo com o número e a senha; senha errada não entra', async () => {
    const telefone = numero()
    const criado = await anon().auth.signUp({ phone: telefone, password: SENHA, options: { data: { full_name: 'Duda Integração', phone: telefone } } })
    expect(criado.error).toBeNull()
    usuarios.push(criado.data.user!.id)

    const certo = await anon().auth.signInWithPassword({ phone: telefone, password: SENHA })
    expect(certo.error).toBeNull()
    expect(certo.data.user?.id).toBe(criado.data.user!.id)

    const errado = await anon().auth.signInWithPassword({ phone: telefone, password: `${SENHA}x` })
    expect(errado.data.session).toBeNull()
    expect(errado.error?.code).toBe('invalid_credentials')
  }, 30_000)

  it('o mesmo número não abre uma segunda conta', async () => {
    const telefone = numero()
    const primeira = await anon().auth.signUp({ phone: telefone, password: SENHA, options: { data: { full_name: 'Lu Integração', phone: telefone } } })
    expect(primeira.error).toBeNull()
    usuarios.push(primeira.data.user!.id)

    const segunda = await anon().auth.signUp({ phone: telefone, password: `${SENHA}2`, options: { data: { full_name: 'Outra Pessoa', phone: telefone } } })
    expect(segunda.data.session).toBeNull()
    // O Auth recusa com `user_already_exists` (ou devolve um usuário falso sem sessão). Nos dois casos, o dono continua um só.
    const { data: lista } = await svc.auth.admin.listUsers({ perPage: 1000 })
    expect(lista.users.filter((u) => u.phone === telefone.slice(1))).toHaveLength(1)
  }, 30_000)
})
