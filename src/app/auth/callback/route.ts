import { NextResponse } from 'next/server'

import { criarClienteDoUsuario } from '@/server/db/server-client'

/**
 * Link de confirmação de e-mail (cadastro) e de redefinição de senha caem
 * aqui — o Supabase manda um `code` de PKCE que só vira sessão de verdade
 * depois de trocado no servidor (nunca confiar em token que passou pela URL
 * do navegador). Sem sessão nenhuma ainda para decidir "tem tenant ou não",
 * então o destino depois da troca é sempre `/onboarding`: quem já tem
 * negócio é redirecionado dali para `/hoje` sozinho.
 */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')

  if (code) {
    const db = await criarClienteDoUsuario()
    const { error } = await db.auth.exchangeCodeForSession(code)
    if (error) return NextResponse.redirect(new URL('/entrar?erro=link_invalido', url.origin))
  }

  return NextResponse.redirect(new URL('/onboarding', url.origin))
}
