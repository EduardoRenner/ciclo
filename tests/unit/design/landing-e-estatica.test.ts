import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

/**
 * `/` é a única página do produto cujo trabalho é convencer um visitante anônimo — o resto só
 * serve quem já entrou. Até 26/08 ela chamava `sessaoAtual()` dentro do Server Component só para
 * redirecionar quem já está logado para `/admin/hoje`. `cookies()`/sessão dentro de um Server
 * Component marca a rota inteira como dinâmica (`ƒ` no build), então a única página com trabalho
 * de convencer não podia ser servida do CDN (`docs/21-AUDITORIA-FALHA-SILENCIOSA.md` §5.2).
 *
 * O middleware já resolve a sessão em TODA requisição (para renovar o token) — a mesma pergunta
 * feita de novo aqui dentro era redundante, não uma garantia a mais. A resposta migrou para
 * `src/middleware.ts`; esta página fica estática de propósito.
 *
 * Casa com o USO (chamada/import), não com o nome solto em comentário — este arquivo cita
 * `sessaoAtual()` e `redirect()` na própria explicação acima.
 */
const PAGINA = 'src/app/page.tsx'
const MIDDLEWARE = 'src/middleware.ts'

/** Só o código. Este arquivo cita `sessaoAtual()` e `redirect()` no PRÓPRIO comentário de aviso
 *  de `page.tsx` — sem tirar comentário, o teste reprovaria a própria documentação que o protege. */
function semComentarios(caminho: string): string {
  return readFileSync(caminho, 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ')
}

describe('a landing não resolve sessão dentro do Server Component', () => {
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
