import { NextResponse } from 'next/server'

import { destinoSeguro } from '@/server/auth/destino'
import { criarClienteDoUsuario } from '@/server/db/server-client'

/**
 * Link de confirmação de e-mail (cadastro) e de redefinição de senha caem
 * aqui — o Supabase manda um `code` de PKCE que só vira sessão de verdade
 * depois de trocado no servidor (nunca confiar em token que passou pela URL
 * do navegador). Sem `next`, o destino é `/onboarding`: sem sessão ainda não
 * dá para saber se a pessoa tem negócio, e quem já tem é redirecionado dali
 * para `/admin/hoje` sozinho. A recuperação de senha manda `next=/nova-senha`,
 * a única tela que precisa da sessão criada aqui e de mais nada.
 */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const destino = destinoSeguro(url.searchParams.get('next'))

  if (code) {
    const db = await criarClienteDoUsuario()
    const { error } = await db.auth.exchangeCodeForSession(code)
    if (error) return NextResponse.redirect(new URL('/entrar?erro=link_invalido', url.origin))
  }

  return NextResponse.redirect(new URL(destino, url.origin))
}
