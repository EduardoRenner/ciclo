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
