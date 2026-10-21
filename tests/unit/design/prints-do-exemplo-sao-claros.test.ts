import { existsSync, readFileSync } from 'node:fs'

import sharp from 'sharp'
import { describe, expect, it } from 'vitest'

/**
 * Os prints da visão de quem atende (`/<slug>/agendar?ver=dono`) foram tirados com o painel em
 * tema escuro e ficaram assim até 2026-09-27, depois que o painel passou a ser claro por padrão:
 * a vitrine mostrava um produto que o dono não vê mais. Os arquivos são binários, e nenhum outro
 * teste olha para eles.
 *
 * A régua é a luminância média do quadro: o fundo claro do painel dá ~245, o escuro dá ~15.
 */
const SLUGS = [
  // docs/112 EXP-S02: as contas de salão novas, que abrem a vitrine onde o seed delas rodou.
  'demo-carol-cilios',
  'demo-esmalteria-rosa-cha',
  'demo-ana-paula-unhas',
  'demo-navalha-de-ouro',
  'demo-corte-fino',
  'demo-dom-estilo',
  'demo-studio-bella',
  'demo-salao-encanto',
  'demo-espaco-vitoria',
]
const ARQUIVOS = SLUGS.flatMap((s) => [
  { arquivo: `public/exemplo/${s}-hoje.webp`, altura: 1444 },
  { arquivo: `public/exemplo/${s}-clientes.webp`, altura: 1444 },
  { arquivo: `public/exemplo/${s}-recuperar.webp`, altura: 1444 },
  { arquivo: `public/exemplo/${s}-recuperar-topo.webp`, altura: 580 },
])

async function luminanciaMedia(arquivo: string): Promise<number> {
  const { channels } = await sharp(readFileSync(arquivo)).stats()
  return (channels[0]!.mean + channels[1]!.mean + channels[2]!.mean) / 3
}

describe('prints do exemplo do dono', () => {
  it('os 36 arquivos existem (guarda contra passar vazia)', () => {
    expect(ARQUIVOS).toHaveLength(36)
    for (const { arquivo } of ARQUIVOS) expect(existsSync(arquivo), `falta ${arquivo}`).toBe(true)
  })

  it.each(ARQUIVOS)('$arquivo: tema claro e 750x$altura', async ({ arquivo, altura }) => {
    const meta = await sharp(readFileSync(arquivo)).metadata()
    expect({ w: meta.width, h: meta.height }, 'o componente declara 750 x 1444 (topo: 580)').toEqual({ w: 750, h: altura })
    expect(await luminanciaMedia(arquivo), 'print escuro: refazer com o painel em tema claro').toBeGreaterThan(200)
  })

  /*
    docs/114 F3: os prints guardam a logo do dia em que foram tirados, e a de setembro era turquesa.
    A régua é a faixa do cabeçalho (os 100 px de cima, onde fica a logo): nenhum pixel turquesa, e o
    azul do anel da logo final presente, para a asserção negativa não passar num quadro vazio.
  */
  it.each(ARQUIVOS)('$arquivo: cabeçalho com a logo final', async ({ arquivo }) => {
    const { data, info } = await sharp(readFileSync(arquivo)).extract({ left: 0, top: 0, width: 750, height: 100 }).removeAlpha().raw().toBuffer({ resolveWithObject: true })
    const perto = (i: number, [r, g, b]: number[]) => Math.abs(data[i]! - r!) + Math.abs(data[i + 1]! - g!) + Math.abs(data[i + 2]! - b!) < 60
    let turquesa = 0
    let azul = 0
    for (let i = 0; i < info.width * info.height * 3; i += 3) {
      if (perto(i, [0x14, 0xb8, 0xa6]) || perto(i, [0x0f, 0x76, 0x6e]) || perto(i, [0x0d, 0x94, 0x88])) turquesa++
      if (perto(i, [0x3b, 0x5b, 0xdb])) azul++
    }
    expect(turquesa, 'logo turquesa de antes de 21/10: refazer o print').toBe(0)
    expect(azul, 'não achei o azul do anel da logo final no cabeçalho').toBeGreaterThan(50)
  })

  /*
    A vitrine abre na primeira conta que existe no banco; se ela não está na lista de prints do
    componente, o exemplo do dono mostra o print de OUTRA conta, com outros serviços.
  */
  it('toda conta da vitrine tem os prints dela no componente', async () => {
    const { SLUGS_DE_VITRINE } = await import('@/core/tenants/demonstracao')
    const painel = readFileSync('src/app/(public)/[slug]/agendar/painel-do-dono-exemplo.tsx', 'utf8')
    const lista = painel.match(/const SLUGS_COM_PRINT = \[([^\]]*)\]/)?.[1]
    expect(lista, 'não achei SLUGS_COM_PRINT: a guarda ficou cega').toBeTruthy()
    const comPrint = [...lista!.matchAll(/"([^"]+)"/g)].map((m) => m[1])
    // dom-rocha é o último recurso e não existe em produção: o componente documenta que cai no padrão.
    const semPrint = SLUGS_DE_VITRINE.filter((s) => s !== 'dom-rocha' && !comPrint.includes(s))
    expect(semPrint).toEqual([])
    expect([...comPrint].sort()).toEqual([...SLUGS].sort())
  })

  it('controle: a régua separa claro de escuro (um quadro preto reprova)', async () => {
    const preto = await sharp({ create: { width: 10, height: 10, channels: 3, background: '#0d0c0c' } }).png().toBuffer()
    const { channels } = await sharp(preto).stats()
    expect((channels[0]!.mean + channels[1]!.mean + channels[2]!.mean) / 3).toBeLessThan(200)
  })
})
