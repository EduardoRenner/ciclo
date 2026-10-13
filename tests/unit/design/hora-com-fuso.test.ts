import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

import { describe, expect, it } from 'vitest'

import { semComentarios } from '../../helpers/fonte'

import { horaLocal } from '@/lib/formato'

/**
 * APR-019 (achado C-07): `horaLocal(instante)` sem fuso formata no fuso do RUNTIME. O HTML do
 * painel sai do servidor, que na Vercel é UTC: a Agenda mostrava 12:11 para 09:11 por até 1 s, até a
 * hidratação. O fuso passou a ser obrigatório no tipo — esta guarda segura quem contornar com
 * `undefined` ou cópia nova da função, e conta argumentos até o `)` que FECHA a chamada, não por
 * janela de caracteres (a vizinha cairia dentro da janela).
 */
function argumentosDasChamadas(fonte: string, nome: string): number[] {
  const contagens: number[] = []
  const alvo = `${nome}(`
  let i = fonte.indexOf(alvo)
  while (i !== -1) {
    // `function horaLocal(` é a definição, não chamada.
    const antes = fonte.slice(Math.max(0, i - 9), i)
    if (!/function\s$/.test(antes)) {
      let profundidade = 0
      let virgulas = 0
      let temConteudo = false
      for (let j = i + alvo.length; j < fonte.length; j++) {
        const c = fonte[j]!
        if (c === '(' || c === '[' || c === '{') profundidade++
        else if (c === ')' || c === ']' || c === '}') {
          if (profundidade === 0) break
          profundidade--
        } else if (c === ',' && profundidade === 0) virgulas++
        if (!/\s/.test(c)) temConteudo = true
      }
      contagens.push(temConteudo ? virgulas + 1 : 0)
    }
    i = fonte.indexOf(alvo, i + alvo.length)
  }
  return contagens
}

function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome)
    if (statSync(caminho).isDirectory()) return arquivos(caminho)
    return /\.tsx?$/.test(nome) ? [caminho] : []
  })
}

const SRC = join(process.cwd(), 'src')
const chamadas: { arquivo: string; argumentos: number }[] = []
for (const arquivo of arquivos(SRC)) {
  const fonte = semComentarios(readFileSync(arquivo, 'utf8'))
  for (const argumentos of argumentosDasChamadas(fonte, 'horaLocal')) chamadas.push({ arquivo: relative(SRC, arquivo).replaceAll('\\', '/'), argumentos })
}

describe('hora no fuso do negócio (APR-019)', () => {
  it('controle positivo: o contador vê 1 argumento, 2 argumentos e argumento com vírgula aninhada', () => {
    expect(argumentosDasChamadas('horaLocal(a.starts_at)', 'horaLocal')).toEqual([1])
    expect(argumentosDasChamadas('horaLocal(a.starts_at, fuso)', 'horaLocal')).toEqual([2])
    expect(argumentosDasChamadas('horaLocal(itens[f(1, 2)]!.ends_at)', 'horaLocal')).toEqual([1])
    expect(argumentosDasChamadas('export function horaLocal(iso: string, timezone: string)', 'horaLocal')).toEqual([])
  })

  it('a varredura acha as chamadas (não passa vazia)', () => {
    expect(chamadas.length).toBeGreaterThan(8)
  })

  it('toda chamada de horaLocal passa o fuso', () => {
    expect(chamadas.filter((c) => c.argumentos < 2)).toEqual([])
  })

  it('nenhuma chamada passa `undefined` no lugar do fuso', () => {
    const contornos = arquivos(SRC).filter((a) => /horaLocal\([^()]*,\s*undefined\s*\)/.test(semComentarios(readFileSync(a, 'utf8'))))
    expect(contornos).toEqual([])
  })

  it('o mesmo instante sai na hora de cada fuso, sem depender do runtime', () => {
    const instante = '2026-10-13T12:11:00.000Z'
    expect(horaLocal(instante, 'America/Sao_Paulo')).toBe('09:11')
    expect(horaLocal(instante, 'UTC')).toBe('12:11')
    expect(horaLocal(instante, 'America/Manaus')).toBe('08:11')
  })
})
