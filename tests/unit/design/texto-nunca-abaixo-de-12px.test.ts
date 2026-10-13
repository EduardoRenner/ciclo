import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * APR-104 (docs/98 I-07): 12 px é o piso da leitura no sol. O `--text-overline` tinha 11 px e era o
 * rótulo de seção de metade das telas; o detalhe técnico do erro do painel também (`text-[11px]`).
 * Esta guarda olha as duas portas por onde um tamanho menor volta: o TOKEN e o valor arbitrário.
 */
const CSS = readFileSync('src/app/globals.css', 'utf8')

/** Tamanho de cada `--text-*` em px (ignora as variantes `--line-height`/`--letter-spacing`). */
export function tamanhosDosTokens(css: string): Record<string, number> {
  const saida: Record<string, number> = {}
  for (const m of css.matchAll(/--text-([a-z]+):\s*([\d.]+)(rem|px)\s*;/g)) {
    saida[m[1]!] = m[3] === 'rem' ? Number(m[2]) * 16 : Number(m[2])
  }
  return saida
}

const PEQUENO_ARBITRARIO = /text-\[(?:[0-9]|1[01])(?:\.\d+)?px\]|text-\[0?\.[0-6]\d*rem\]/

function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome)
    if (statSync(caminho).isDirectory()) return arquivos(caminho)
    return /\.tsx?$/.test(nome) ? [caminho] : []
  })
}

describe('texto nunca abaixo de 12 px (APR-104)', () => {
  it('a leitura achou os tokens (senão passaria vazia)', () => {
    const t = tamanhosDosTokens(CSS)
    expect(Object.keys(t)).toEqual(expect.arrayContaining(['corpo', 'label', 'overline', 'secundario']))
  })

  it('nenhum token --text-* abaixo de 12 px', () => {
    const pequenos = Object.entries(tamanhosDosTokens(CSS)).filter(([, px]) => px < 12)
    expect(pequenos).toEqual([])
  })

  it('nenhum tamanho arbitrário abaixo de 12 px no código', () => {
    const achados = arquivos('src').filter((a) => PEQUENO_ARBITRARIO.test(readFileSync(a, 'utf8')))
    expect(achados).toEqual([])
  })

  it('controle: o detector acusa os dois defeitos que existiam', () => {
    expect(tamanhosDosTokens('--text-overline: 0.6875rem; /* 11px */').overline).toBe(11)
    expect(PEQUENO_ARBITRARIO.test('className="font-mono text-[11px]"')).toBe(true)
    expect(PEQUENO_ARBITRARIO.test('className="text-[12px]"')).toBe(false)
  })
})
