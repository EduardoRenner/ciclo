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
    'src/components/shell/tela-publica.tsx',
    'src/components/shell/tela-do-cliente.tsx',
    'src/app/page.tsx',
    'src/app/(public)/links/page.tsx',
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

/**
 * O PADRÃO É CLARO (`docs/82` rodada 33, pedido do Eduardo: "deixa tudo no padrão claro").
 *
 * Havia dois padrões convivendo: as telas públicas e de entrada eram claras, e o painel seguia o
 * aparelho, então quem tinha o celular em escuro criava a conta numa tela clara e caía num painel
 * escuro. Agora o painel, sem escolha salva, também é claro. Quem quiser escuro escolhe em
 * Configurações (`escuro`) ou pede o automático (`sistema`).
 *
 * Cookie `ciclo-tema`: `claro` | `escuro` | `sistema`. AUSENTE = claro.
 */
describe('o painel é claro por padrão', () => {
  it('layout do painel: cookie ausente vira light, não sistema', () => {
    expect(
      ADMIN_LAYOUT,
      'sem cookie o painel voltou a seguir o aparelho: quem tem o celular em escuro cai num painel escuro depois de criar a conta numa tela clara',
    ).toMatch(/temaSalvo === 'escuro' \? 'dark' : temaSalvo === 'sistema' \? 'sistema' : 'light'/)
  })

  it('layout do painel: o cookie aceita os três valores, incluindo o automático explícito', () => {
    expect(ADMIN_LAYOUT).toMatch(/ciclo-tema=\(claro\|escuro\|sistema\)/)
  })

  it('seletor: sem cookie a pessoa aparece em "Claro", não em "Automático"', () => {
    const seletor = readFileSync('src/components/shell/seletor-de-tema.tsx', 'utf8')
    expect(seletor).toMatch(/ciclo-tema=\(claro\|escuro\|sistema\)/)
    expect(seletor, 'o estado inicial do seletor precisa ser o padrão real do painel').toMatch(/useState<Escolha>\('claro'\)/)
    expect(seletor).toMatch(/: 'claro'\s*\n\}/)
  })

  it.each(['src/components/shell/tela-publica.tsx', 'src/components/shell/tela-do-cliente.tsx'])(
    '%s é claro no CÓDIGO, não só no comentário',
    (caminho) => {
      /*
        O teste por arquivo lá em cima lê o texto inteiro, comentário incluído, e passou verde com
        `TelaPublica` em `sistema`: o cabeçalho conta a história e cita `data-theme="light"`. Aqui só o
        que executa.
      */
      const codigo = readFileSync(caminho, 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ')
      expect(codigo, `${caminho} não cravou data-theme="light" no código`).toMatch(/data-theme="light"/)
      expect(codigo, `${caminho} ainda tem data-theme="sistema" no código`).not.toMatch(/data-theme="sistema"/)
    },
  )

  it('o fundo de html/body do painel cobre o padrão claro', () => {
    expect(ADMIN_LAYOUT).toMatch(/dataTheme === 'light' \? '#faf8f5'/)
  })
})

/**
 * A barra do navegador e a tela de abertura do app instalado também são "tema" (`docs/82` rodada 34).
 *
 * Com o produto claro por padrão, `themeColor` do layout raiz ainda mandava `#0d0c0c` para quem tem o
 * aparelho em escuro (barra escura sobre página clara) e o `manifest.json` era escuro sempre (o app
 * instalado abria escuro e piscava para claro). Além disso o comentário do layout jurava que o
 * `seletor-de-tema` reescreve a `<meta theme-color>`, e o código dele nunca fez isso.
 */
describe('a barra do navegador e o app instalado acompanham o padrão claro', () => {
  const RAIZ = readFileSync('src/app/layout.tsx', 'utf8')
  const codigoRaiz = RAIZ.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ')

  it('layout raiz: themeColor é o claro, sem variante escura por aparelho', () => {
    const bloco = codigoRaiz.slice(codigoRaiz.indexOf('themeColor'), codigoRaiz.indexOf('width:'))
    expect(bloco, 'themeColor não achado: a guarda ficaria cega').toContain('#faf8f5')
    expect(bloco, 'themeColor voltou a mandar barra escura para quem tem o aparelho em escuro').not.toContain('#0d0c0c')
  })

  it('manifest: abertura e barra do app instalado são claras', () => {
    const m = JSON.parse(readFileSync('public/manifest.json', 'utf8')) as { background_color: string; theme_color: string }
    expect(m.background_color).toBe('#faf8f5')
    expect(m.theme_color).toBe('#faf8f5')
  })

  it('painel: quem escolheu Escuro (ou Automático) tem a barra escura, via generateViewport', () => {
    expect(ADMIN_LAYOUT, 'sem generateViewport, quem escolheu Escuro fica com barra clara sobre painel escuro').toMatch(
      /export async function generateViewport/,
    )
    expect(ADMIN_LAYOUT).toMatch(/'#0d0c0c'/)
    expect(ADMIN_LAYOUT).toMatch(/'#faf8f5'/)
  })
})
