import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { semComentarios as semComentariosDe } from '../../helpers/fonte'

/**
 * `/` é a única página do produto cujo trabalho é convencer um visitante anônimo — o resto só
 * serve quem já entrou. Até 26/08 ela chamava `sessaoAtual()` dentro do Server Component só para
 * redirecionar quem já está logado para `/admin/hoje`. `cookies()`/sessão dentro de um Server
 * Component marca a rota inteira como dinâmica (`ƒ` no build) — e naquele momento isso era visto
 * como o problema (a página não podia ser servida do CDN, `docs/21-AUDITORIA-FALHA-SILENCIOSA.md`
 * §5.2), então a checagem migrou para `src/middleware.ts` e a página virou estática.
 *
 * Em 01/09/2026 a landing voltou a ser dinâmica de propósito: nonce por requisição (CSP,
 * TICKET-057) e página estática não conviviam, e o conserto foi `force-dynamic` no layout raiz.
 * **`perf/csp-duas-faixas` desfez isso**: `/` recebe do `middleware.ts` uma CSP SEM nonce
 * (`rotaDeConteudoEstatico`) e voltou a ser estática/CDN — sem nonce não há valor para congelar.
 * O `force-dynamic` mudou para `src/app/admin/layout.tsx`. Guardado em
 * `tests/unit/design/csp-nonce-exige-rota-dinamica.test.ts`.
 *
 * Justamente por `/` ser estática de novo, o que este arquivo garante voltou a ser crítico: o
 * `Home` **não pode** ler `sessaoAtual()`/`cookies()`/`headers()` — qualquer uma marca a rota
 * como dinâmica por usuário e tira `/` do CDN. O redirecionamento de quem já entrou mora no
 * middleware, que roda em toda requisição de qualquer forma.
 *
 * Casa com o USO (chamada/import), não com o nome solto em comentário — este arquivo cita
 * `sessaoAtual()` e `redirect()` na própria explicação acima.
 */
const PAGINA = 'src/app/page.tsx'
const MIDDLEWARE = 'src/middleware.ts'

/** Só o código. Este arquivo cita `sessaoAtual()` e `redirect()` no PRÓPRIO comentário de aviso
 *  de `page.tsx` — sem tirar comentário, o teste reprovaria a própria documentação que o protege. */
function semComentarios(caminho: string): string {
  return semComentariosDe(readFileSync(caminho, 'utf8'))
}

describe('a landing (estática de novo — perf/csp-duas-faixas) não resolve sessão dentro do Server Component', () => {
  const fonte = semComentarios(PAGINA)

  it('a leitura não voltou vazia', () => {
    expect(fonte.length, `${PAGINA} veio vazio — o teste passaria por não achar nada`).toBeGreaterThan(500)
  })

  it('não importa sessaoAtual — reintroduzir isso volta a marcar a rota como dinâmica', () => {
    expect(fonte).not.toMatch(/sessaoAtual/)
  })

  /*
   * **Aqui havia `expect(fonte).not.toMatch(/async function Home/)`, e ele foi trocado em
   * 2026-09-03. O registro é obrigatório porque afrouxar guarda que reprovou é onde a proteção
   * some sem ninguém ver.**
   *
   * "Não é async" nunca foi o defeito: era um PROXY para "não lê dado de usuário aqui dentro",
   * escolhido quando a única razão concebível para um `await` na landing era a sessão. Deixou de
   * valer quando a página passou a resolver, no servidor, qual demonstração está no ar — uma
   * consulta sem dado de ninguém, igual para todo visitante, que existe porque o link "Ver uma
   * página de exemplo" apontava para um 404 em produção.
   *
   * O substituto é MAIS estreito que o proxy, não menos: em vez de proibir a forma (`async`),
   * proíbe as APIs que de fato tornam a rota dependente de quem está pedindo. Um `await` legítimo
   * passa; qualquer caminho de volta para dado por usuário reprova, inclusive os que a versão
   * anterior deixaria passar caso alguém os usasse de forma síncrona.
   */
  const POR_USUARIO: readonly { padrao: RegExp; porque: string }[] = [
    { padrao: /\bcookies\s*\(/, porque: 'cookies() liga a resposta ao navegador de quem pediu' },
    { padrao: /\bheaders\s*\(/, porque: 'headers() idem' },
    { padrao: /\bsessaoAtual\b/, porque: 'resolve a sessão que o middleware já resolveu' },
    { padrao: /\bcontextoAtual\b/, porque: 'exige tenant, e a landing é de visitante anônimo' },
    { padrao: /criarClienteDoUsuario/, porque: 'cliente autenticado do Supabase, ou seja dado por usuário' },
  ]

  it.each(POR_USUARIO)('a landing não lê dado por usuário: $porque', ({ padrao, porque }) => {
    expect(padrao.test(fonte), `${PAGINA} voltou a depender de quem está pedindo — ${porque}`).toBe(false)
  })

  it('os detectores reconhecem o defeito que substituíram', () => {
    // Guarda contra o próprio detector: se os padrões pararem de casar, tudo acima passa vazio.
    const comSessao = "export default async function Home() {\n  const s = await sessaoAtual()\n"
    expect(POR_USUARIO.some((r) => r.padrao.test(comSessao)), 'o defeito original passaria').toBe(true)
    const comCookies = "const c = await cookies()"
    expect(POR_USUARIO.some((r) => r.padrao.test(comCookies))).toBe(true)
    // E o que PRECISA passar: o await legítimo que motivou a troca.
    const legitimo = "export default async function Home() {\n  const slug = await slugDeDemonstracaoNoAr()\n"
    expect(POR_USUARIO.some((r) => r.padrao.test(legitimo)), 'o await legítimo foi reprovado').toBe(false)
  })
})

describe('o redirecionamento de quem já está logado mora no middleware', () => {
  const fonte = readFileSync(MIDDLEWARE, 'utf8')

  it('a leitura não voltou vazia', () => {
    expect(fonte.length, `${MIDDLEWARE} veio vazio`).toBeGreaterThan(500)
  })

  it('redireciona para /admin/hoje quando há cookie de sessão e o caminho é a raiz', () => {
    /*
     * Até 2026-09-08 este teste casava com `data.user && req.nextUrl.pathname === '/'`. Trocado
     * de propósito por `perf/csp-borda`: a `/` saiu da renovação de sessão do middleware
     * (`precisaRenovarSessao`), então o `getUser()` — uma ida de rede ao auth — não roda mais
     * nela. O desvio de quem já entrou passou a ser por PRESENÇA DE COOKIE (`temCookieDeSessao`),
     * que é a mesma decisão sem custo de rede. Não é afrouxamento: cookie vencido cai em
     * `/admin/hoje` e o middleware de lá renova/desvia — a garantia de que "quem entrou não vê a
     * página de venda" continua, e nada protegido é servido a partir daqui.
     */
    const cobre =
      /req\.nextUrl\.pathname\s*===\s*'\/'\s*&&\s*temCookieDeSessao\(req\)/.test(fonte) &&
      fonte.includes("hoje.pathname = '/admin/hoje'")
    expect(
      cobre,
      'o middleware não desvia mais quem já entrou para longe da landing — ' +
        'sem isso, um usuário autenticado vê a página de venda em vez do próprio painel',
    ).toBe(true)
  })
})
