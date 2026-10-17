import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { afterAll, describe, expect, it } from 'vitest'

import type { Database } from '@/server/db/types.gen'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) {
  throw new Error('O teste de recuperação precisa de NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY no .env.local.')
}

const svc = createClient<Database>(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
/** Cliente "de outro navegador": nada guardado, nenhum verificador PKCE de quem pediu. */
const navegadorNovo = () => createClient<Database>(SUPABASE_URL!, ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })
const usuarios: string[] = []

afterAll(async () => {
  for (const u of usuarios) await svc.auth.admin.deleteUser(u)
}, 60_000)

/*
 * APR-026 (achado F-05): o PKCE só troca o código no MESMO navegador que pediu. O `token_hash`
 * que a rota `/auth/confirmar` recebe é trocado por `verifyOtp`, que não depende disso.
 */
describe('recuperar senha em outro navegador (APR-026)', () => {
  it(
    'o token_hash do e-mail vira sessão num navegador que nunca viu o pedido, e a senha troca',
    async () => {
      const email = `recupera-${randomUUID().slice(0, 8)}@ciclo.test`
      const criado = await svc.auth.admin.createUser({ email, password: `Antiga-${randomUUID()}`, email_confirm: true })
      usuarios.push(criado.data.user!.id)

      const link = await svc.auth.admin.generateLink({ type: 'recovery', email })
      const tokenHash = link.data.properties?.hashed_token
      expect(tokenHash).toBeTruthy()

      const outro = navegadorNovo()
      const { data, error } = await outro.auth.verifyOtp({ token_hash: tokenHash!, type: 'recovery' })
      expect(error).toBeNull()
      expect(data.session?.user.email).toBe(email)

      const novaSenha = `Nova-${randomUUID()}`
      expect((await outro.auth.updateUser({ password: novaSenha })).error).toBeNull()
      expect((await navegadorNovo().auth.signInWithPassword({ email, password: novaSenha })).error).toBeNull()
    },
    30_000,
  )

  it(
    'o mesmo link usado duas vezes falha na segunda (e a rota manda para o login com o motivo)',
    async () => {
      const email = `duas-vezes-${randomUUID().slice(0, 8)}@ciclo.test`
      const criado = await svc.auth.admin.createUser({ email, password: `Antiga-${randomUUID()}`, email_confirm: true })
      usuarios.push(criado.data.user!.id)
      const tokenHash = (await svc.auth.admin.generateLink({ type: 'recovery', email })).data.properties!.hashed_token
      expect((await navegadorNovo().auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' })).error).toBeNull()
      expect((await navegadorNovo().auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' })).error).not.toBeNull()
    },
    30_000,
  )

  it('os modelos de e-mail apontam para a rota que funciona em outro navegador', () => {
    for (const [modelo, tipo] of [
      ['supabase/templates/recuperar-senha.html', 'recovery'],
      ['supabase/templates/confirmar-cadastro.html', 'signup'],
    ] as const) {
      const html = readFileSync(modelo, 'utf8')
      expect(html, modelo).toContain(`/auth/confirmar?token_hash={{ .TokenHash }}&type=${tipo}`)
      expect(html, modelo).not.toContain('{{ .ConfirmationURL }}')
    }
    const config = readFileSync('supabase/config.toml', 'utf8')
    expect(config).toMatch(/\[auth\.email\.template\.recovery\][\s\S]*?content_path = "\.\/supabase\/templates\/recuperar-senha\.html"/)
    expect(config).toMatch(/\[auth\.email\.template\.confirmation\][\s\S]*?content_path = "\.\/supabase\/templates\/confirmar-cadastro\.html"/)
  })
})
