import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

import type { Database } from './types.gen'

export function exigirEnv(nome: string): string {
  const valor = process.env[nome]
  if (!valor) throw new Error(`Variável de ambiente ausente: ${nome}`)
  return valor
}

/**
 * Cliente com a chave pública e o JWT do usuário no cookie. É o único caminho de
 * leitura e escrita das rotas: como o token é o do usuário, a RLS do Postgres
 * continua valendo. Quem passa por cima da RLS é a `service_role`, que mora
 * sozinha em `with-tenant.ts` e não entra aqui.
 */
export async function criarClienteDoUsuario() {
  const jar = await cookies()

  // O genérico `Database` vem de `types.gen.ts`: é o que faz `select` e `insert`
  // serem conferidos contra o schema real (regra 6 do CLAUDE.md).
  return createServerClient<Database>(
    exigirEnv('NEXT_PUBLIC_SUPABASE_URL'),
    exigirEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    {
      /*
        Achado da auditoria de 2026-09-08: o default do `@supabase/ssr` é `httpOnly: false`
        (`utils/constants.js`), então access e refresh token ficavam legíveis por
        `document.cookie`. Qualquer XSS deixava de ser sequestro de aba e virava takeover
        duradouro — o refresh token continua valendo depois de a aba fechar.
        A CSP com nonce e `strict-dynamic` do middleware torna XSS improvável, e é o que segurou
        a severidade; mas defesa que depende de uma só camada não é defesa.

        **Isto governa só o cookie escrito pelo SERVIDOR.** O `createBrowserClient` escreve por
        `document.cookie`, que não tem como marcar `httpOnly` nem se quisesse — e nada no cliente
        depende de LER a sessão: `criarClienteDoNavegador` é usado num lugar só
        (`(auth)/login-social.tsx`) e apenas para `signInWithOAuth`, que não lê sessão existente.
      */
      cookieOptions: { httpOnly: true, secure: true, sameSite: 'lax' },
      cookies: {
        getAll: () => jar.getAll(),
        setAll: (novos) => {
          try {
            for (const { name, value, options } of novos) jar.set(name, value, options)
          } catch {
            // Server Component não pode escrever cookie. Quem renova a sessão é o
            // middleware, que roda antes e tem resposta na mão.
          }
        },
      },
    },
  )
}
