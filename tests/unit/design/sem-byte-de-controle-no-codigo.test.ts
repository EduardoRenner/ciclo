import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * Byte de controle invisível no código-fonte — 2026-09-23.
 *
 * `\b` escrito por um heredoc de Python vira o byte 0x08 (backspace), e um regex com ele NUNCA casa.
 * Não aparece na leitura do arquivo, não quebra tipo nem lint, e a guarda que o contém passa verde
 * para sempre. Achado duas vezes no mesmo dia: num teste novo (pego antes do commit) e em
 * `estrelas-nao-repetem-o-svg.test.ts`, onde `/<ChevronRight\b/` tinha virado `/<ChevronRight<0x08>/`
 * e a volta do ícone do lucide passava sem ninguém ver.
 *
 * Nenhum arquivo de código tem razão para conter C0 fora de tab, quebra de linha e retorno.
 */
const RAIZES = ['src', 'tests']
const EXTENSOES = /\.(ts|tsx|js|mjs|css|sql)$/
// Monta a classe sem escrever os bytes no fonte — senão este arquivo seria o primeiro achado.
const CONTROLE = new RegExp(`[${String.fromCharCode(0)}-${String.fromCharCode(8)}${String.fromCharCode(11)}${String.fromCharCode(12)}${String.fromCharCode(14)}-${String.fromCharCode(31)}]`)

function arquivos(dir: string): string[] {
  const achados: string[] = []
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const caminho = join(dir, e.name)
    if (e.isDirectory()) achados.push(...arquivos(caminho))
    else if (EXTENSOES.test(e.name)) achados.push(caminho)
  }
  return achados
}

describe('nenhum byte de controle invisível no código', () => {
  it('o detector enxerga o backspace (controle positivo)', () => {
    expect(CONTROLE.test(`/<ChevronRight${String.fromCharCode(8)}/`)).toBe(true)
    // O `\b` de regex escrito certo: barra (92) + b. Montado por código pelo mesmo motivo do CONTROLE.
    expect(CONTROLE.test(`/<ChevronRight${String.fromCharCode(92)}b/\t\r\n`)).toBe(false)
  })

  it('src/ e tests/ estão limpos', () => {
    const lista = RAIZES.flatMap(arquivos)
    expect(lista.length, 'a varredura não achou arquivo nenhum').toBeGreaterThan(500)
    const sujos = lista.filter((f) => CONTROLE.test(readFileSync(f, 'utf8')))
    expect(sujos).toEqual([])
  })
})
