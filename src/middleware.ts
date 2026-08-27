import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Prefixos do app do profissional — as pastas de `src/app/admin/`. A lista é
 * explícita porque o contrário não funciona aqui: o site público mora na raiz
 * (`/{slug}`), então "tudo protegido menos uma allow-list" bloquearia a página
 * que precisa ser aberta por qualquer cliente.
 */
const PREFIXOS_PROTEGIDOS = ['/admin', '/onboarding']

/**
 * Exige sessão: sem usuário, redireciona para `/entrar`. **Só telas.**
 *
 * `/api/*` não entra aqui de propósito — uma chamada de API sem sessão precisa de `401` no
 * envelope JSON de `docs/02-API.md §1`, não de um `302` para uma página de login que nenhum
 * `fetch()` sabe interpretar.
 */
export function exigeSessao(pathname: string): boolean {
  return PREFIXOS_PROTEGIDOS.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

/**
 * Nunca pode ser guardado por navegador, CDN ou proxy (auditoria de segurança, achado S10).
 *
 * Antes isto era a mesma pergunta que `exigeSessao`, e por isso **nenhuma resposta de `/api/v1`
 * levava `Cache-Control`** — nem `GET /clients/{id}/vault`, que devolve ficha de saúde
 * decifrada, nem `GET /media/{id}/url`, que devolve URL assinada, nem `GET /cash/daily`. O
 * CLAUDE.md deste projeto proíbe cachear `/vault` no service worker, e o service worker obedece;
 * a camada HTTP, que é a que sobrevive ao PWA, nunca tinha recebido a mesma regra.
 *
 * As duas perguntas são separadas porque as respostas são diferentes: `/api/*` não exige sessão
 * (o público de agendamento vive lá), mas nada em `/api/*` deve ser cacheado — as rotas públicas
 * são de volume baixo e a disponibilidade delas não depende de cache de navegador.
 */
export function naoCacheavel(pathname: string): boolean {
  return exigeSessao(pathname) || pathname === '/api' || pathname.startsWith('/api/')
}

/**
 * O middleware só precisa falar com o servidor de auth quando a resposta é uma **tela**.
 *
 * `docs/28-LATENCIA-DE-CLIQUE-PLANO.md` §3 P1-a. O `getUser()` lá embaixo é uma ida de rede ao
 * servidor de auth do Supabase (~110 ms medidos daqui, ~40 ms de dentro do `gru1`), e ela
 * acontecia em **toda** requisição que o matcher pega — inclusive nas ~90 rotas de `/api/v1`,
 * que logo em seguida perguntam a mesma coisa de novo pelo `contextoAtual`. Uma ida inteira
 * duplicada no caminho de todo clique.
 *
 * Por que é seguro tirar de `/api/*`:
 *
 * - **Guarda.** `exigeSessao` já devolve `false` para `/api/*` de propósito — quem protege rota
 *   de API é `exigirSessao()` dentro dela, com `401` no envelope JSON, não um `302` que nenhum
 *   `fetch()` sabe ler. Nada de autorização mora aqui.
 * - **Renovação de token.** É o único serviço real que o `getUser()` do middleware presta a uma
 *   rota de API, e ela não depende dele: Route Handler **pode escrever cookie** (ao contrário de
 *   Server Component), então o `setAll` de `criarClienteDoUsuario` funciona e o próprio
 *   `@supabase/ssr` renova e persiste o token quando ele estiver vencido.
 *
 * Tela continua passando pelo caminho completo, porque aí a renovação só pode acontecer aqui.
 */
export function precisaRenovarSessao(pathname: string): boolean {
  return !(pathname === '/api' || pathname.startsWith('/api/'))
}

/**
 * TICKET-057. CSP com nonce por requisição, gerado no Edge Runtime (que tem
 * `crypto.randomUUID()` global, sem precisar de `node:crypto`). O nonce vai
 * no header **da requisição** (não só da resposta) porque é assim que o
 * Next.js encontra o próprio nonce para carimbar o script de hidratação que
 * ele injeta — sem isso, `'strict-dynamic'` bloquearia o próprio app.
 * `'unsafe-inline'` do `script-src` fica só como fallback de navegador antigo
 * sem suporte a nonce: todo navegador que entende `nonce-`/`strict-dynamic`
 * ignora `unsafe-inline` sozinho (CSP nível 2+), então não afrouxa nada de
 * verdade. `style-src` **não** leva nonce — testado ao vivo (`preview_start`)
 * e confirmado: nonce em `style-src` só vale para `<style>`/`<link>`, nunca
 * para o atributo `style=""` que o React usa toda hora para valor calculado
 * (barra de progresso, posição no calendário…), e com nonce presente o
 * `'unsafe-inline'` é ignorado pelo navegador — toda `style={{...}}` do app
 * quebraria. `'unsafe-inline'` solto em `style-src` é o padrão aceito nesse
 * caso: risco de XSS por CSS é ordens de grandeza menor que por script, e é
 * o `script-src` que carrega a defesa de verdade.
 */
function cabecalhosDeSeguranca(nonce: string): string {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  let origemSupabase = ''
  try {
    origemSupabase = supabaseUrl ? new URL(supabaseUrl).origin : ''
  } catch {
    origemSupabase = ''
  }

  // `next dev` recompila módulo com `eval()` (devtool `eval-source-map`, mais
  // rápido pra HMR) — sem `unsafe-eval` o próprio dev server quebra com
  // "Evaluating a string as JavaScript violates the CSP". O build de
  // produção não usa `eval`, então isso nunca sai daqui em produção.
  const permiteEval = process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''

  const csp = `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-inline'${permiteEval};
    style-src 'self' 'unsafe-inline';
    img-src 'self' blob: data: ${origemSupabase};
    font-src 'self' data:;
    connect-src 'self' ${origemSupabase};
    worker-src 'self';
    manifest-src 'self';
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    upgrade-insecure-requests;
  `

  return csp.replace(/\s{2,}/g, ' ').trim()
}

function aplicarCabecalhosDeSeguranca(resposta: NextResponse, csp: string, semCache: boolean): void {
  resposta.headers.set('Content-Security-Policy', csp)
  // HSTS só faz efeito em HTTPS (Vercel), e não atrapalha `pnpm dev` em HTTP —
  // o navegador ignora o header fora de conexão segura.
  resposta.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload')
  resposta.headers.set('X-Content-Type-Options', 'nosniff')
  // Redundante com `frame-ancestors 'none'` do CSP — mantido para navegador
  // que só entende o header antigo, sem custo para o que já entende os dois.
  resposta.headers.set('X-Frame-Options', 'DENY')
  resposta.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  resposta.headers.set(
    'Permissions-Policy',
    'geolocation=(), camera=(), microphone=(), payment=(), usb=(), interest-cohort=()',
  )
  resposta.headers.set('Cross-Origin-Opener-Policy', 'same-origin')
  resposta.headers.set('Cross-Origin-Resource-Policy', 'same-origin')

  /**
   * docs/13-CAUSA-RAIZ-LAYOUT-LEGADO.md (T6). O Next já não pré-renderiza
   * estas rotas (`force-dynamic`/uso de `cookies()`), então o header default
   * já tende a ser `no-store` — mas isso é efeito colateral de como a rota é
   * escrita, não uma garantia. Cravar aqui é defesa em profundidade: mesmo
   * que um CDN entre na frente algum dia, ou uma tela nova esqueça de forçar
   * dinâmico, dado de tenant (faturamento, agenda, ficha de cliente) nunca
   * fica cacheável — nem pelo navegador, nem por infraestrutura no meio.
   */
  if (semCache) resposta.headers.set('Cache-Control', 'private, no-store, max-age=0, must-revalidate')
}

export async function middleware(req: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64')
  const csp = cabecalhosDeSeguranca(nonce)
  const protegida = exigeSessao(req.nextUrl.pathname)
  const semCache = naoCacheavel(req.nextUrl.pathname)

  const requestHeaders = new Headers(req.headers)
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('Content-Security-Policy', csp)

  let resposta = NextResponse.next({ request: { headers: requestHeaders } })
  aplicarCabecalhosDeSeguranca(resposta, csp, semCache)

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anon) return resposta
  // Rota de API já sai daqui com CSP e `no-store` aplicados — o que ela não paga mais é a ida
  // de rede ao servidor de auth que ela mesma refaz um instante depois.
  if (!precisaRenovarSessao(req.nextUrl.pathname)) return resposta

  const db = createServerClient(url, anon, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (novos) => {
        for (const { name, value } of novos) req.cookies.set(name, value)
        resposta = NextResponse.next({ request: { headers: requestHeaders } })
        aplicarCabecalhosDeSeguranca(resposta, csp, semCache)
        for (const { name, value, options } of novos) resposta.cookies.set(name, value, options)
      },
    },
  })

  // Este `getUser()` é o que renova o access token de 15 minutos antes de a
  // página rodar. Sem ele, o Server Component encontraria token vencido e não
  // teria como escrever o cookie novo.
  const { data } = await db.auth.getUser()

  /*
   * A landing (`/`) fazia essa mesma pergunta DE NOVO dentro do Server Component
   * (`sessaoAtual()`, em `src/app/page.tsx`), só para redirecionar quem já está logado — e
   * `cookies()`/sessão dentro de um Server Component marca a rota inteira como dinâmica (`ƒ`).
   * Era a única razão da única página cujo trabalho é convencer um visitante anônimo não poder
   * ser servida do CDN (`docs/21-AUDITORIA-FALHA-SILENCIOSA.md` §5.2). O middleware já resolve
   * `data.user` para TODA rota — inclusive esta —, então a resposta já está aqui.
   */
  if (data.user && req.nextUrl.pathname === '/') {
    const hoje = req.nextUrl.clone()
    hoje.pathname = '/admin/hoje'
    const redirecionamento = NextResponse.redirect(hoje)
    aplicarCabecalhosDeSeguranca(redirecionamento, csp, semCache)
    return redirecionamento
  }

  if (!data.user && protegida) {
    const entrar = req.nextUrl.clone()
    entrar.pathname = '/entrar'
    // Guarda para onde a pessoa queria ir, para voltar depois de entrar.
    entrar.searchParams.set('proximo', req.nextUrl.pathname)
    const redirecionamento = NextResponse.redirect(entrar)
    aplicarCabecalhosDeSeguranca(redirecionamento, csp, semCache)
    return redirecionamento
  }

  return resposta
}

export const config = {
  matcher: [
    // Tudo, menos arquivo estático e imagem — que não têm sessão para renovar.
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
