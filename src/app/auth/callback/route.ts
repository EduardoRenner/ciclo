import { NextResponse } from 'next/server'

import { criarClienteDoUsuario } from '@/server/db/server-client'

/**
 * `next` só pode ser caminho interno: vindo de um link de e-mail, aceitar
 * qualquer valor transformaria a rota em redirecionamento aberto (`//evil.com`
 * é URL absoluta para o navegador, por isso a segunda barra também é barrada).
 */
function destinoSeguro(next: string | null): string {
  if (!next || !next.startsWith('/') || next.startsWith('//')) return '/onboarding'
  return next
}

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
