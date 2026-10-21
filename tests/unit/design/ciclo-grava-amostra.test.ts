import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * C-015: `client_cycles.sample_size` (0092) chegou à main sem escritor — a coluna ficou 0 para todo
 * mundo e a fila de recuperar não podia dizer "vem a cada 18 dias" sem mentir. Toda porta que grava
 * `personal_cycle_days` tem de gravar `sample_size` junto, senão a coluna fica certa numa porta e
 * mentindo nas outras ("coluna sem escritor vem em fila").
 */
function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n)
    return statSync(p).isDirectory() ? arquivos(p) : p.endsWith('.ts') ? [p] : []
  })
}
const semComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

describe('toda porta que grava o ciclo pessoal grava a amostra (C-015)', () => {
  const portas = arquivos('src/server').flatMap((f) => {
    const fonte = semComentarios(readFileSync(f, 'utf8'))
    // Só quem GRAVA em client_cycles (previsao.ts grava personal_cycle_days em cycle_predictions, que não tem sample_size).
    if (!/from\('client_cycles'\)\s*\.upsert\(/.test(fonte)) return []
    const escritas = fonte.match(/^\s*personal_cycle_days:/gm)?.length ?? 0
    const amostras = fonte.match(/^\s*sample_size:/gm)?.length ?? 0
    return escritas ? [{ f, escritas, amostras }] : []
  })

  it('o detector acha as três portas conhecidas (ciclo.ts ×2, ciclo-de-quem-ja-atende.ts)', () => {
    expect(portas.reduce((a, p) => a + p.escritas, 0)).toBeGreaterThanOrEqual(3)
  })

  it.each(portas.map((p) => p.f))('%s grava sample_size em toda escrita de personal_cycle_days', (f) => {
    const p = portas.find((x) => x.f === f)!
    expect(p.amostras).toBe(p.escritas)
  })
})
