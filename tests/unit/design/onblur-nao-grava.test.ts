import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { semComentarios } from '../../helpers/fonte'

/**
 * APR-112 (docs/98 C-13): num formulário com botão de enviar, nenhum campo grava no `onBlur`.
 *
 * Medido na comanda: o desconto gravava ao sair do campo, e quem digitava e tocava direto em
 * "Receber" (o gesto natural) disparava o PATCH do blur e o POST do fechamento JUNTOS; o fechamento
 * lia o valor antigo e a comanda saía sem desconto. Dois envios para uma intenção é o defeito; o
 * conserto foi levar desconto e gorjeta no corpo do fechamento (112a) e tirar o blur (112b).
 *
 * A guarda casa com o que muda quando o defeito volta: um `onBlur={algo}` cujo `algo` chama uma
 * escrita (`fetch`/`chamar`/`apiFetch`/`fetchComTentativa` com método de escrita, ou um handler
 * do arquivo que a contém).
 */
const ESCRITA = /\b(fetch|chamar|apiFetch|fetchComTentativa)\s*\(|method:\s*'(POST|PATCH|PUT|DELETE)'/

function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome)
    if (statSync(caminho).isDirectory()) return arquivos(caminho)
    return /\.tsx$/.test(nome) ? [caminho] : []
  })
}

/** O corpo de `function nome(` até a próxima função ou o `return (` do componente. */
function corpoDaFuncao(fonte: string, nome: string): string | null {
  const m = fonte.match(new RegExp(`(?:async\\s+)?function\\s+${nome}\\s*\\(`))
  if (!m || m.index === undefined) return null
  const resto = fonte.slice(m.index + m[0].length)
  const fim = resto.search(/\n\s{2}(?:async\s+)?function\s|\n\s{2}return \(/)
  return fim < 0 ? resto : resto.slice(0, fim)
}

export function blursQueGravam(fonte: string): string[] {
  const achados: string[] = []
  for (const m of fonte.matchAll(/onBlur=\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/g)) {
    const handler = m[1]!.trim()
    if (ESCRITA.test(handler)) {
      achados.push(handler.slice(0, 60))
      continue
    }
    const nome = handler.match(/^([A-Za-z_$][\w$]*)$/)?.[1]
    if (!nome) continue
    const corpo = corpoDaFuncao(fonte, nome)
    if (corpo && ESCRITA.test(corpo)) achados.push(nome)
  }
  return achados
}

describe('nenhum campo grava no onBlur num formulário com botão de enviar (APR-112)', () => {
  const telas = arquivos('src/app')

  it('a varredura enxerga telas (senão passaria vazia)', () => {
    expect(telas.length).toBeGreaterThan(50)
  })

  it('nenhum onBlur chama uma escrita, nem por nome de handler', () => {
    const culpados = telas.flatMap((a) => blursQueGravam(semComentarios(readFileSync(a, 'utf8'))).map((h) => `${a}: onBlur={${h}}`))
    expect(culpados).toEqual([])
  })

  it('controle: o detector acusa o defeito que existia na comanda, inline e por nome', () => {
    const porNome = `
  function salvarDescontoGorjeta() {
    iniciarTransicao(async () => {
      await chamar('/api/v1/tickets/x', { method: 'PATCH', body: '{}' })
    })
  }
  return (
    <input onBlur={salvarDescontoGorjeta} />
  )`
    expect(blursQueGravam(porNome)).toEqual(['salvarDescontoGorjeta'])
    expect(blursQueGravam(`<input onBlur={() => fetch('/x', { method: 'POST' })} />`)).toHaveLength(1)
    expect(blursQueGravam(`<input onBlur={() => setTocado(true)} />`)).toEqual([])
  })
})
