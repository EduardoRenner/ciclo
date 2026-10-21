import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { semComentarios } from '../../helpers/fonte'

/**
 * docs/114 F3: a logo final do CICLO, aprovada pelo Vitor em 21/10 (`Documentos\CICLO-marca-final`):
 * a palavra "CICL" e os ponteiros em preto (fundo claro) ou branco (fundo escuro), e só o relógio
 * com cor, anel azul #3B5BDB e seta rosa #F06595.
 *
 * A guarda prova as duas metades da troca: o que é novo está no lugar, e NENHUM arquivo da logo
 * antiga (o wordmark e o anel rosé de 20/10) continua no repositório ou referenciado.
 */
const AZUL = '#3b5bdb'
const ROSA = '#f06595'

const ANTIGOS = ['public/marca/ciclo-wordmark-rose.png', 'public/marca/ciclo-wordmark-rose-claro.png', 'public/marca/ciclo-icone-rose.png', 'src/app/opengraph-image.tsx']

function arquivos(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const caminho = join(dir, e.name)
    if (e.isDirectory()) return arquivos(caminho)
    return /\.(tsx?|css|json|html)$/.test(e.name) ? [caminho] : []
  })
}

/** Largura e altura de um PNG, lidas do cabeçalho IHDR. */
function tamanhoDoPng(caminho: string): [number, number] {
  const b = readFileSync(caminho)
  expect(b.subarray(1, 4).toString('latin1'), `${caminho} não é PNG`).toBe('PNG')
  return [b.readUInt32BE(16), b.readUInt32BE(20)]
}

describe('a logo final no lugar (docs/114 F3)', () => {
  it('nenhum arquivo da logo antiga ficou no repositório', () => {
    expect(ANTIGOS.filter((a) => existsSync(a))).toEqual([])
  })

  it('nada em src/ nem em public/ ainda aponta para a logo antiga', () => {
    const todos = [...arquivos('src'), ...arquivos('public')]
    expect(todos.length, 'a varredura não achou arquivo nenhum').toBeGreaterThan(300)
    const achados = todos.filter((f) => /ciclo-wordmark-rose|ciclo-icone-rose/.test(semComentarios(readFileSync(f, 'utf8'))))
    expect(achados).toEqual([])
  })

  it('o cabeçalho usa a escrita preta no claro e a branca no escuro', () => {
    const preta = readFileSync('public/marca/ciclo-logo-escrita-preta.svg', 'utf8').toLowerCase()
    const branca = readFileSync('public/marca/ciclo-logo-escrita-branca.svg', 'utf8').toLowerCase()
    for (const svg of [preta, branca]) {
      expect(svg).toContain(AZUL)
      expect(svg).toContain(ROSA)
    }
    expect(preta).toContain('#0d0c0c')
    expect(branca).toContain('#ffffff')
    const topbar = readFileSync('src/components/shell/topbar.tsx', 'utf8')
    expect(topbar).toMatch(/import wordmark from '[^']*ciclo-logo-escrita-branca\.svg'/)
    expect(topbar).toMatch(/import wordmarkClaro from '[^']*ciclo-logo-escrita-preta\.svg'/)
  })

  it('o favicon é o relógio da logo, e o ícone do iPhone tem 180 px', () => {
    const favicon = readFileSync('src/app/icon.svg', 'utf8').toLowerCase()
    expect(favicon).toContain(AZUL)
    expect(favicon).toContain(ROSA)
    expect(favicon).not.toContain('#d4949f')
    expect(tamanhoDoPng('src/app/apple-icon.png')).toEqual([180, 180])
  })

  it('a imagem de compartilhamento é a aprovada, no tamanho que as redes cortam', () => {
    expect(tamanhoDoPng('src/app/opengraph-image.png')).toEqual([1200, 630])
    expect(readFileSync('src/app/opengraph-image.alt.txt', 'utf8').trim().length).toBeGreaterThan(10)
  })

  // Página em subpasta que define o próprio `openGraph` perde a imagem da raiz (medido: `/links`, o
  // link da bio, saía sem prévia). As páginas de divulgação apontam para a imagem aprovada.
  it.each(['src/app/(public)/links/page.tsx', 'src/app/(public)/calculadora/page.tsx'])('%s leva a imagem de compartilhamento', (arquivo) => {
    expect(semComentarios(readFileSync(arquivo, 'utf8'))).toMatch(/images: \[\{ url: '\/opengraph-image\.png'/)
  })

  // Os e-mails não têm imagem da marca, só a cor do botão: era o turquesa de antes de 20/10. A regra
  // da logo final proíbe fundo azul ou rosa, então o botão é o preto da escrita.
  it.each(['supabase/templates/confirmar-cadastro.html', 'supabase/templates/recuperar-senha.html', 'docs/runbooks/material/cartao-a6.html'])(
    '%s sem o turquesa da marca antiga',
    (arquivo) => {
      const html = readFileSync(arquivo, 'utf8').toLowerCase()
      expect(html).not.toMatch(/#0f766e|#14b8a6/)
      expect(html).toContain('#0d0c0c')
    },
  )

  it('o manifest aponta para ícones que existem, com os maskable separados', () => {
    const manifest = JSON.parse(readFileSync('public/manifest.json', 'utf8')) as { icons: { src: string; sizes: string; purpose: string }[] }
    expect(manifest.icons.map((i) => i.purpose).sort()).toEqual(['any', 'any', 'maskable', 'maskable'])
    for (const icone of manifest.icons) {
      const lado = Number(icone.sizes.split('x')[0])
      expect(tamanhoDoPng(join('public', icone.src))).toEqual([lado, lado])
    }
  })
})
