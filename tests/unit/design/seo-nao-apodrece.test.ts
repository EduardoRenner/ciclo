import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

/**
 * SEO é a área do produto que apodrece mais calada: nada quebra, nada fica vermelho, e a perda só
 * aparece meses depois num gráfico que ninguém abriu. Estas guardas travam as decisões que já
 * custaram trabalho para tomar.
 */
const LAYOUT = readFileSync('src/app/layout.tsx', 'utf8')
const OG = readFileSync('src/app/opengraph-image.tsx', 'utf8')
const CSS = readFileSync('src/app/globals.css', 'utf8')
const ROBOTS = readFileSync('src/app/robots.ts', 'utf8')
const SITEMAP = readFileSync('src/app/sitemap.ts', 'utf8')

describe('o link colado no WhatsApp mostra prévia', () => {
  it('existe metadataBase — sem ele imagem relativa não vira absoluta', () => {
    // O canal de aquisição deste produto é o link mandado de um profissional para outro. Sem
    // `metadataBase` o WhatsApp não resolve a imagem e o link aparece pelado.
    expect(LAYOUT, 'metadataBase sumiu do layout raiz').toMatch(/metadataBase:\s*new URL\(/)
  })

  it('a imagem de prévia tem o tamanho que as redes cortam', () => {
    // 1200×630 (1,91:1). Os arquivos de marca são 2,46:1 e 0,94:1 — por isso a imagem é gerada.
    expect(OG).toMatch(/width:\s*1200/)
    expect(OG).toMatch(/height:\s*630/)
  })

  it('a cor da prévia é a cor da marca de verdade', () => {
    // Cravada porque não há CSS neste contexto. Se `--acc` mudar e a prévia não, o link passa a
    // divulgar uma cor que o produto não usa mais.
    const acc = CSS.match(/--acc:\s*(#[0-9a-f]{6})/i)?.[1]
    expect(acc, 'não achei --acc no globals.css').toBeDefined()
    expect(OG.toLowerCase(), `a prévia não usa o --acc atual (${acc})`).toContain(acc!.toLowerCase())
  })
})

describe('o que não pode ser indexado continua fora', () => {
  it('o painel e as rotas de sessão seguem bloqueados', () => {
    for (const rota of ['/admin', '/api', '/entrar', '/cadastro', '/onboarding']) {
      expect(ROBOTS, `${rota} saiu do disallow do robots`).toContain(`'${rota}'`)
    }
  })

  it('o tenant de demonstração fica fora do sitemap', () => {
    // Sem isto alguém acha a barbearia de exemplo no Google e marca horário nela.
    expect(SITEMAP).toContain('ehDemonstracao')
  })
})

describe('llms.txt não vira tabela de preço paralela', () => {
  /*
   * Testa o TEXTO SERVIDO, não o arquivo-fonte. A primeira versão varria o fonte e reprovou por
   * casar com "R$ 49" dentro de um COMENTÁRIO que explicava justamente por que não escrever preço
   * à mão — a armadilha nº1 da tabela do CLAUDE.md, casar com algo que o arquivo contém por outro
   * motivo. Chamar o handler de verdade não tem esse problema e ainda prova que a rota responde.
   */
  it('o preço servido vem do core, e bate com a tabela de planos', async () => {
    const { GET } = await import('@/app/llms.txt/route')
    const { precoDoPlanoPorMes } = await import('@/core/billing/planos')

    const texto = await GET().text()
    expect(texto.length, 'llms.txt veio vazio').toBeGreaterThan(300)

    // Se alguém congelar um número aqui, ele deixa de bater com o core no dia do reajuste.
    for (const tier of ['gratis', 'essencial', 'equipe', 'avancado'] as const) {
      expect(texto, `o plano ${tier} não aparece com o preço do core`).toContain(precoDoPlanoPorMes(tier))
    }
  })

  it('serve como texto puro, que é o que a convenção pede', async () => {
    const { GET } = await import('@/app/llms.txt/route')
    expect(GET().headers.get('content-type')).toMatch(/text\/plain/)
  })

  it('a lista de módulos também vem do catálogo', async () => {
    const { GET } = await import('@/app/llms.txt/route')
    const { CATALOGO } = await import('@/core/billing/planos')
    const texto = await GET().text()
    for (const m of CATALOGO) {
      expect(texto, `o módulo "${m.label}" não aparece no llms.txt`).toContain(m.label)
    }
  })
})
