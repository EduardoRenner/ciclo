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
const SLUGS = ['demo-navalha-de-ouro', 'demo-corte-fino', 'demo-dom-estilo', 'demo-studio-bella', 'demo-salao-encanto', 'demo-espaco-vitoria']
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
  it('os 24 arquivos existem (guarda contra passar vazia)', () => {
    expect(ARQUIVOS).toHaveLength(24)
    for (const { arquivo } of ARQUIVOS) expect(existsSync(arquivo), `falta ${arquivo}`).toBe(true)
  })

  it.each(ARQUIVOS)('$arquivo: tema claro e 750x$altura', async ({ arquivo, altura }) => {
    const meta = await sharp(readFileSync(arquivo)).metadata()
    expect({ w: meta.width, h: meta.height }, 'o componente declara 750 x 1444 (topo: 580)').toEqual({ w: 750, h: altura })
    expect(await luminanciaMedia(arquivo), 'print escuro: refazer com o painel em tema claro').toBeGreaterThan(200)
  })

  it('controle: a régua separa claro de escuro (um quadro preto reprova)', async () => {
    const preto = await sharp({ create: { width: 10, height: 10, channels: 3, background: '#0d0c0c' } }).png().toBuffer()
    const { channels } = await sharp(preto).stats()
    expect((channels[0]!.mean + channels[1]!.mean + channels[2]!.mean) / 3).toBeLessThan(200)
  })
})
