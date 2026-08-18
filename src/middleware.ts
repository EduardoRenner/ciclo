import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Prefixos do app do profissional — as pastas de `src/app/(app)/`. A lista é
 * explícita porque o contrário não funciona aqui: o booking público mora na raiz
 * (`/{slug}`), então "tudo protegido menos uma allow-list" bloquearia a página
 * que precisa ser aberta por qualquer cliente.
 */
const PREFIXOS_PROTEGIDOS = ['/hoje', '/agenda', '/clientes', '/recuperar', '/comanda', '/caixa', '/config']

function ehProtegida(pathname: string): boolean {
  return PREFIXOS_PROTEGIDOS.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

export async function middleware(req: NextRequest) {
  let resposta = NextResponse.next({ request: req })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anon) return resposta

  const db = createServerClient(url, anon, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (novos) => {
        for (const { name, value } of novos) req.cookies.set(name, value)
        resposta = NextResponse.next({ request: req })
        for (const { name, value, options } of novos) resposta.cookies.set(name, value, options)
      },
    },
  })

  // Este `getUser()` é o que renova o access token de 15 minutos antes de a
  // página rodar. Sem ele, o Server Component encontraria token vencido e não
  // teria como escrever o cookie novo.
  const { data } = await db.auth.getUser()

  if (!data.user && ehProtegida(req.nextUrl.pathname)) {
    const entrar = req.nextUrl.clone()
    entrar.pathname = '/entrar'
    // Guarda para onde a pessoa queria ir, para voltar depois de entrar.
    entrar.searchParams.set('proximo', req.nextUrl.pathname)
    return NextResponse.redirect(entrar)
  }

  return resposta
}

export const config = {
  matcher: [
    // Tudo, menos arquivo estático e imagem — que não têm sessão para renovar.
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
