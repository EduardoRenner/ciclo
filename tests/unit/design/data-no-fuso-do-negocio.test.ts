import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { semComentarios } from '../../helpers/fonte'

/**
 * APR-202 (docs/98 C-51, C-33, G-57): data e hora de um INSTANTE (`starts_at`, `created_at`,
 * `expires_at`…) formatadas sem `timeZone` saem no fuso do APARELHO de quem olha — a dona em Manaus
 * via o horário de São Paulo uma hora mais cedo. Toda chamada de `toLocaleDateString`/
 * `toLocaleTimeString` e todo `new Date(…).toLocaleString` no painel precisa de `timeZone`.
 *
 * Fica de fora o que não é instante: data-só de nascimento (`new Date(2000, …)`), dia-só com
 * `T00:00:00` (constrói local e mostra local, mesmo dia) e `toLocaleString` de NÚMERO.
 */
const RAIZES = ['src/app/admin', 'src/components']

function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome)
    if (statSync(caminho).isDirectory()) return arquivos(caminho)
    return /\.tsx?$/.test(nome) ? [caminho] : []
  })
}

/** Fecha os parênteses da chamada a partir do `(` de abertura e devolve o texto dos argumentos. */
function argumentos(src: string, abre: number): string {
  let nivel = 0
  for (let k = abre; k < src.length; k++) {
    if (src[k] === '(') nivel++
    else if (src[k] === ')') {
      nivel--
      if (nivel === 0) return src.slice(abre + 1, k)
    }
  }
  return src.slice(abre + 1)
}

export function chamadasSemFuso(src: string): string[] {
  const achados: string[] = []
  const padrao = /(\.toLocaleDateString|\.toLocaleTimeString|new Date\([^)]*\)\.toLocaleString|\bd\.toLocaleString)\s*\(/g
  for (let m = padrao.exec(src); m; m = padrao.exec(src)) {
    const antes = src.slice(Math.max(0, m.index - 60), m.index)
    if (/new Date\(2000,/.test(antes) || /T00:00:00/.test(antes)) continue
    const args = argumentos(src, m.index + m[0].length - 1)
    if (!/timeZone/.test(args)) achados.push(src.slice(m.index, m.index + m[0].length + Math.min(args.length, 50)).replace(/\s+/g, ' '))
  }
  return achados
}

describe('data de instante sai no fuso do negócio, nunca no do aparelho (APR-202)', () => {
  it('o detector reconhece a chamada sem fuso e aceita a com fuso', () => {
    expect(chamadasSemFuso(`new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit' })`)).toHaveLength(1)
    expect(chamadasSemFuso(`new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', timeZone: fuso })`)).toEqual([])
    expect(chamadasSemFuso(`(cents / 100).toLocaleString('pt-BR', { style: 'currency' })`), 'número não é instante').toEqual([])
    expect(chamadasSemFuso(`new Date(2000, 1, 2).toLocaleDateString('pt-BR', { day: '2-digit' })`), 'aniversário é data-só').toEqual([])
  })

  it('nenhuma tela do painel formata instante sem timeZone', () => {
    const todos = RAIZES.flatMap((r) => arquivos(r))
    expect(todos.length, 'o varredor não achou arquivos').toBeGreaterThan(50)
    const culpados = todos.flatMap((a) => chamadasSemFuso(semComentarios(readFileSync(a, 'utf8'))).map((c) => `${a}: ${c}`))
    expect(culpados, 'passe `timeZone` (useFuso() no cliente, ctx.tenant.timezone no servidor)').toEqual([])
  })
})
