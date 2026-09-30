import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { semComentarios } from '../../helpers/fonte'

/**
 * Formulário sem `method` manda os campos NA URL quando é enviado antes de o JavaScript carregar.
 *
 * Medido em 29/09/2026 na tela de entrar, no navegador: apertar Enter logo que a página abriu (antes
 * da hidratação) levou para `/entrar?email=...&password=...`. O `onSubmit` com `preventDefault` só
 * existe depois que o React assume a página; até lá vale o HTML puro, e o padrão do HTML é GET.
 *
 * No celular de verdade, no 3G, essa janela não é um instante: é o tempo inteiro em que a pessoa
 * digita a senha enquanto o JavaScript ainda baixa. E a URL não é um lugar neutro: fica no
 * histórico do navegador, no log de acesso do servidor e da Vercel, e sai no `Referer` do próximo
 * clique. Senha, e-mail, código de verificação, telefone de cliente do salão.
 *
 * `method="post"` resolve no próprio HTML: enviado cedo, vai no corpo, que ninguém registra — e o
 * `onSubmit` continua fazendo tudo depois da hidratação, sem mudança nenhuma de comportamento.
 */

function arquivosTsx(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n)
    if (statSync(p).isDirectory()) return arquivosTsx(p)
    return p.endsWith('.tsx') ? [p.replace(/\\/g, '/')] : []
  })
}

/**
 * A tag de abertura INTEIRA de cada `<form>`. Não dá para cortar no primeiro `>`: o `onSubmit={(e)
 * => ...}` tem `>` dentro. Anda caractere a caractere contando chaves e só para no `>` de fora.
 */
function tagsDeForm(fonte: string): string[] {
  const tags: string[] = []
  const re = /<form(?=[\s>])/g
  for (let m = re.exec(fonte); m; m = re.exec(fonte)) {
    let profundidade = 0
    let i = m.index + 5
    for (; i < fonte.length; i++) {
      const c = fonte[i]
      if (c === '{') profundidade++
      else if (c === '}') profundidade--
      else if (c === '>' && profundidade === 0) break
    }
    tags.push(fonte.slice(m.index, i + 1))
  }
  return tags
}

const semMethod = (tag: string) => !/\smethod=["'](post|get)["']/i.test(tag)

const TODOS = arquivosTsx('src')

describe('o detector de <form> sem method', () => {
  it('pega a forma real do defeito, com o `>` da arrow function dentro da tag', () => {
    // Controle positivo: é a tela de entrar como estava até 29/09. Se o detector parar de casar
    // isto, a guarda de baixo passa verde sem olhar nada.
    const antes = `<form
      onSubmit={(e) => {
        e.preventDefault()
        void enviar(new FormData(e.currentTarget))
      }}
      className="flex"
    >`
    expect(tagsDeForm(antes)).toHaveLength(1)
    expect(semMethod(tagsDeForm(antes)[0]!)).toBe(true)
  })

  it('não acusa o que está certo, nem `method` escrito DENTRO de um handler', () => {
    expect(semMethod(tagsDeForm('<form method="post" onSubmit={(e) => e.preventDefault()}>')[0]!)).toBe(false)
    // `method` numa string do handler não é o atributo da tag.
    expect(semMethod(tagsDeForm('<form onSubmit={() => enviar({ method: "post" })}>')[0]!)).toBe(true)
  })
})

describe('nenhum formulário manda campo pela URL antes de o JavaScript carregar', () => {
  it('a varredura enxerga os formulários — não passa vazia', () => {
    const total = TODOS.reduce((n, a) => n + tagsDeForm(semComentarios(readFileSync(a, 'utf8'))).length, 0)
    expect(total, 'a guarda não achou <form> nenhum; algo mudou no jeito de ler').toBeGreaterThanOrEqual(15)
    // Os que já falharam, por nome: tirar `src/app/(auth)` do alcance não pode passar verde.
    expect(TODOS).toContain('src/app/(auth)/entrar/formulario.tsx')
    expect(TODOS).toContain('src/app/(public)/[slug]/orcamento/pedido.tsx')
  })

  it('todo <form> declara method="post" (ou "get" de propósito, sem campo sensível)', () => {
    const infratores: string[] = []
    for (const arquivo of TODOS) {
      const fonte = semComentarios(readFileSync(arquivo, 'utf8'))
      for (const tag of tagsDeForm(fonte)) {
        if (semMethod(tag)) infratores.push(`${arquivo}: ${tag.slice(0, 60).replace(/\s+/g, ' ')}…`)
        if (/method=["']get["']/i.test(tag) && /type=["']password["']|name=["'](email|password|phone|telefone)["']/.test(fonte)) {
          infratores.push(`${arquivo}: GET num arquivo com campo sensível`)
        }
      }
    }
    expect(infratores, 'formulário sem method: enviado antes da hidratação, os campos vão para a URL').toEqual([])
  })
})
