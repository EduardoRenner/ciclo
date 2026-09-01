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
 * **Essa parte da história mudou em 01/09/2026, e por isso o arquivo perdeu "estatica" do nome.**
 * Medido ao vivo em produção: nonce por requisição (CSP, TICKET-057) e página estática não
 * convivem — o nonce gravado no HTML fica congelado na primeira renderização, o header muda a
 * cada chamada, os dois nunca voltam a bater, e o navegador bloqueia TODO `<script>`. Era o site
 * inteiro sem JavaScript, agendamento público incluído. `src/app/layout.tsx` agora tem
 * `export const dynamic = 'force-dynamic'`, herdado por toda rota — a landing voltou a ser
 * dinâmica, mas por um motivo diferente do de 26/08 (achado completo em `docs/DECISOES.md`,
 * 01/09/2026).
 *
 * O que este arquivo continua garantindo, e ainda vale: o `Home` **não precisa** voltar a chamar
 * `sessaoAtual()` — o middleware já resolve a sessão em toda requisição (para renovar o token), e
 * fazer a mesma pergunta de novo aqui dentro seria trabalho redundante, não uma garantia a mais.
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

describe('a landing (agora dinâmica por causa do CSP) não resolve sessão dentro do Server Component', () => {
  const fonte = semComentarios(PAGINA)

  it('a leitura não voltou vazia', () => {
    expect(fonte.length, `${PAGINA} veio vazio — o teste passaria por não achar nada`).toBeGreaterThan(500)
  })

  it('não importa sessaoAtual — reintroduzir isso volta a marcar a rota como dinâmica', () => {
    expect(fonte).not.toMatch(/sessaoAtual/)
  })

  it('o componente Home não é async — não há await para justificar', () => {
    expect(fonte).not.toMatch(/async function Home/)
  })
})

describe('o redirecionamento de quem já está logado mora no middleware', () => {
  const fonte = readFileSync(MIDDLEWARE, 'utf8')

  it('a leitura não voltou vazia', () => {
    expect(fonte.length, `${MIDDLEWARE} veio vazio`).toBeGreaterThan(500)
  })

  it('redireciona para /admin/hoje quando data.user existe e o caminho é a raiz', () => {
    const cobre = /data\.user\s*&&\s*req\.nextUrl\.pathname\s*===\s*'\/'/.test(fonte) && fonte.includes("hoje.pathname = '/admin/hoje'")
    expect(
      cobre,
      'o middleware não redireciona mais quem já está logado para longe da landing — ' +
        'sem isso, um usuário autenticado vê a página de venda em vez do próprio painel',
    ).toBe(true)
  })
})
