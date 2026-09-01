import { createBrowserClient } from '@supabase/ssr'

import type { Database } from './types.gen'

/**
 * Cliente do navegador — só existe porque o login por OAuth (Google, Apple) tem que redirecionar
 * a aba inteira para o provedor, e isso só acontece do lado do cliente. Todo o resto do app
 * (e-mail/senha, qualquer leitura ou escrita) continua passando por `/api/v1` com
 * `criarClienteDoUsuario()` no servidor, como a regra 6 do CLAUDE.md pede — este cliente nunca
 * toca tabela nenhuma, só chama `auth.signInWithOAuth()`.
 *
 * Não reusa o `exigirEnv` de `server-client.ts`: aquele arquivo importa `next/headers` no topo, e
 * qualquer componente cliente que importasse este arquivo puxaria `next/headers` para o bundle do
 * navegador — erro de build, não de execução. As duas variáveis são `NEXT_PUBLIC_*` mesmo assim,
 * então a checagem aqui é só para falhar cedo e claro se o ambiente estiver mal configurado.
 */
function exigirEnvPublica(nome: 'NEXT_PUBLIC_SUPABASE_URL' | 'NEXT_PUBLIC_SUPABASE_ANON_KEY'): string {
  const valor = process.env[nome]
  if (!valor) throw new Error(`Variável de ambiente ausente: ${nome}`)
  return valor
}

export function criarClienteDoNavegador() {
  return createBrowserClient<Database>(
    exigirEnvPublica('NEXT_PUBLIC_SUPABASE_URL'),
    exigirEnvPublica('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  )
}
