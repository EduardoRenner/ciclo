import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

/**
 * O tema claro (2026-09-10) vive num `<div data-theme>` que o `admin/layout.tsx` embrulha, não no
 * `<html>` — para não tornar `/` dinâmica lendo cookie no layout raiz.
 *
 * Isso tem uma armadilha que só aparece no navegador: **variável CSS não sobe para o ancestral**.
 * O `<body>` fica ACIMA do wrapper, então `body { background: var(--bg) }` e `body { color:
 * var(--txt) }` resolvem no escuro mesmo com o wrapper no claro — e o `<body>` aparecia escuro
 * nas bordas, e os títulos de card herdavam a `color` já computada em escuro.
 *
 * O conserto tem três peças e esta guarda cobra as três:
 *  1. `#raiz-do-tema` pinta o próprio `background` (a cor não desce para ele sozinha do `body`).
 *  2. `#raiz-do-tema` declara `color: var(--txt)` (senão a subárvore herda o valor escuro pronto).
 *  3. `admin/layout` emite um `<style>` que estende a cor ao `<html>`/`<body>` (rubber-band).
 */

const CSS = readFileSync('src/app/globals.css', 'utf8')
const ADMIN_LAYOUT = readFileSync('src/app/admin/layout.tsx', 'utf8')

describe('o tema do wrapper alcança o que está acima dele', () => {
  it('#raiz-do-tema pinta o próprio fundo', () => {
    // Casa com a regra CSS de verdade (`#raiz-do-tema { ... background: var(--bg) }`), não com a
    // string solta — o id aparece no comentário e no `admin/layout` por outros motivos.
    const bloco = CSS.slice(CSS.indexOf('#raiz-do-tema {'), CSS.indexOf('}', CSS.indexOf('#raiz-do-tema {')))
    expect(bloco, 'o wrapper de tema parou de pintar o próprio fundo').toMatch(/background:\s*var\(--bg\)/)
  })

  it('#raiz-do-tema re-declara color, senão a subárvore herda o texto escuro do body', () => {
    const bloco = CSS.slice(CSS.indexOf('#raiz-do-tema {'), CSS.indexOf('}', CSS.indexOf('#raiz-do-tema {')))
    expect(
      bloco,
      'sem `color: var(--txt)` no wrapper, os títulos de card ficam quase invisíveis no tema claro ' +
        '(herdam a cor JÁ COMPUTADA do body, que é escura)',
    ).toMatch(/color:\s*var\(--txt\)/)
  })

  it('admin/layout estende a cor de fundo ao html/body', () => {
    // O `<style>` inline: `style-src` da CSP permite inline, só `script-src` tem strict-dynamic.
    expect(ADMIN_LAYOUT, 'sumiu o <style> que cobre o rubber-band do celular no tema claro').toMatch(
      /html,body\{background:/,
    )
  })

  it('o wrapper carrega o data-theme do COOKIE lido no servidor, não de um script', () => {
    // A primeira tentativa usava <script> no <head> e a CSP bloqueava. Se isto voltar a casar
    // `localStorage` no caminho do servidor, o flash e o bloqueio voltaram junto.
    expect(ADMIN_LAYOUT).toMatch(/ciclo-tema=/)
    expect(ADMIN_LAYOUT).toMatch(/data-theme=\{dataTheme\}/)
    expect(
      /dangerouslySetInnerHTML[\s\S]{0,120}localStorage/.test(ADMIN_LAYOUT),
      'voltou um <script> lendo localStorage no layout — a CSP bloqueia e o nonce dá mismatch',
    ).toBe(false)
  })

  it('os três valores de data-theme que o CSS entende estão mapeados', () => {
    // `globals.css` tem blocos para `light`, `dark` e `sistema`. Se o layout mandar outra string,
    // o tema não aplica e ninguém vê erro.
    for (const v of ['sistema', 'light', 'dark']) {
      expect(CSS, `globals.css não trata data-theme="${v}"`).toContain(`data-theme="${v}"`)
    }
  })
})

/**
 * A MESMA armadilha, achada de novo em 2026-09-21 — desta vez em wrappers que usam
 * `data-theme="light"` inline (`style={{...}}`), não uma regra de CSS com id como `#raiz-do-tema`.
 * `TelaPublica` (`/entrar`, `/cadastro`, `/onboarding`), a home, `[slug]/layout.tsx` (agendamento
 * público) e, na mesma rodada, `/precos`/`/privacidade`/`/termos` (para não ficarem as únicas
 * telas escuras da "frente de casa" depois que o resto virou claro) — todos passaram a forçar tema
 * claro a pedido do Eduardo, e todos precisaram do MESMO par `color`/`background` explícito no
 * wrapper, pela mesma razão: `body` (`app/layout.tsx`) já declara `color: var(--txt)`, herdado e
 * não recalculado, e como o wrapper é DESCENDENTE de `body` (não ancestral), a variável reescrita
 * lá dentro não sobe — sem redeclarar, a subárvore inteira herda a cor escura já computada no
 * `body`. Medido ao vivo: o `<h1>` da home e de `/entrar`/`/cadastro` saíam quase brancos sobre
 * fundo claro antes deste conserto.
 */
describe('a mesma armadilha, em wrappers com style inline em vez de #raiz-do-tema', () => {
  const ARQUIVOS = [
    'src/components/shell/tela-do-cliente.tsx',
    'src/app/page.tsx',
    'src/app/(public)/[slug]/layout.tsx',
    'src/app/(public)/precos/page.tsx',
    'src/app/(public)/privacidade/page.tsx',
    'src/app/(public)/termos/page.tsx',
  ]

  it.each(ARQUIVOS)('%s redeclara color E background no wrapper de data-theme="light"', (caminho) => {
    const fonte = readFileSync(caminho, 'utf8')
    expect(fonte, `${caminho} perdeu o data-theme="light"`).toMatch(/data-theme="light"/)
    expect(
      fonte,
      `${caminho}: sem \`color: 'var(--txt)'\` no style do wrapper, texto sem classe de cor própria ` +
        'herda o escuro já computado no body — a mesma armadilha do #raiz-do-tema, documentada acima.',
    ).toMatch(/color:\s*['"]var\(--txt\)['"]/)
    expect(fonte, `${caminho}: mesmo raciocínio, agora para \`background\`.`).toMatch(/background:\s*['"]var\(--bg\)['"]/)
  })
})

/**
 * `TelaPublica` (`/entrar`, `/cadastro`, `/onboarding`) deixou de forçar tema claro: a pessoa criava a
 * conta numa tela clara e caía num painel escuro, e o salto lia como dois produtos diferentes
 * (`docs/82` rodada 31, pedido do Eduardo). O painel segue "sistema" (ou a escolha salva); o shell de
 * entrada agora segue o mesmo padrão, então os dois resolvem para o MESMO tema em qualquer aparelho.
 *
 * Continua valendo o par `color`/`background` explícito no wrapper (mesma armadilha da herança), e o
 * fundo de `html`/`body` precisa acompanhar o tema resolvido, não ficar cravado num só.
 */
describe('TelaPublica segue o mesmo tema do painel', () => {
  const fonte = readFileSync('src/components/shell/tela-publica.tsx', 'utf8')
  // Só o que executa: o cabeçalho explica o passado e cita `data-theme="light"` de propósito.
  const codigo = fonte.replace(/\/\*[\s\S]*?\*\//g, ' ')

  it('não força claro', () => {
    expect(codigo, 'TelaPublica voltou a cravar data-theme="light": o salto cadastro claro, painel escuro volta junto').not.toMatch(
      /data-theme="light"/,
    )
  })

  it('usa data-theme="sistema", igual ao padrão do painel', () => {
    expect(codigo).toMatch(/data-theme="sistema"/)
  })

  it('redeclara color E background no wrapper (a herança do body é escura)', () => {
    expect(codigo).toMatch(/color:\s*['"]var\(--txt\)['"]/)
    expect(codigo).toMatch(/background:\s*['"]var\(--bg\)['"]/)
  })

  it('o fundo de html/body acompanha o tema do sistema, nas duas direções', () => {
    expect(codigo, 'sem o fundo claro, o rubber-band do celular mostra o escuro sob a tela clara').toMatch(/#faf8f5/)
    expect(codigo, 'sem o fundo escuro, o rubber-band mostra claro sob a tela escura').toMatch(/#0d0c0c/)
    expect(codigo, 'a troca entre os dois tem que vir do @media, não de um valor fixo').toMatch(/prefers-color-scheme/)
  })
})

/**
 * As telas que o CLIENTE FINAL abre por link (`/confirmar`, `/avaliar`, `/lista-espera`, `/orcamento`)
 * não definiam tema nenhum e caíam no escuro do `:root`, mesmo com o aparelho em claro, enquanto a
 * página do salão que ele acabou de usar (`/[slug]`) é clara. Quem recebe "confirme seu horário" no
 * WhatsApp saía de uma página clara para uma escura, medido a 375 px com o sistema em claro
 * (`docs/82` rodada 32). Elas passam pelo mesmo `TelaDoCliente`, claro como a página do salão.
 *
 * A guarda cobra o layout de CADA pasta, por nome: uma pasta nova de link de cliente nasce escura
 * sem ninguém notar, e varrer "todas as pastas" passaria vazio se a lista de raízes ficasse velha.
 */
describe('as telas de link do cliente usam o mesmo tema da página do salão', () => {
  const PASTAS = ['confirmar', 'avaliar', 'lista-espera', 'orcamento']

  it.each(PASTAS)('/%s tem layout com TelaDoCliente', (pasta) => {
    const caminho = `src/app/(public)/${pasta}/layout.tsx`
    let fonte = ''
    try {
      fonte = readFileSync(caminho, 'utf8')
    } catch {
      fonte = ''
    }
    expect(fonte, `${caminho} não existe: a tela de ${pasta} cai no escuro do :root`).not.toBe('')
    expect(fonte, `${caminho} não passa pelo TelaDoCliente`).toMatch(/<TelaDoCliente>/)
  })

  it('o componente é claro, como a página do salão', () => {
    const codigo = readFileSync('src/components/shell/tela-do-cliente.tsx', 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ')
    expect(codigo).toMatch(/data-theme="light"/)
    expect(codigo).toMatch(/html,body\{background:#faf8f5\}/)
  })
})
