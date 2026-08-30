import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * Achado da auditoria de 2026-08-28 — a mesma classe que o TICKET-105 fechou em duas telas.
 *
 * `A6` (rodada 1 do `docs/15`) consertou "Enviar avaliação" travado sem dizer por quê; `A15`
 * consertou "Confirmar agendamento" na página pública, com o comentário no arquivo: *"no leitor de
 * tela saía 'Confirmar agendamento, indisponível' e ponto"*. Para isso nasceu a prop
 * `motivoDesabilitado` do `Button`, que vira `title` e `sr-only`.
 *
 * A prop existia e era usada em **cinco** lugares. Havia **sete** botões travados sem ela, e o pior
 * é o de "Novo agendamento": um salão sem serviço cadastrado via o botão morto e nenhuma pista de
 * que o caminho é Configurações. É o padrão que esta auditoria encontrou em todas as rodadas —
 * conserto certo aplicado num lugar só.
 *
 * A guarda é de CLASSE: varre todo `<Button>` com `disabled` e exige a explicação, com uma exceção
 * declarada e estreita — condição que é só "já estou enviando", onde o próprio spinner do botão
 * (`carregando`) já conta a história.
 */

const RAIZES = ['src/app', 'src/components']

/**
 * Condições que dispensam explicação: o botão está travado porque a ação já está em curso. A lista
 * é fechada e explícita de propósito — "parece estado de envio" abriria a porta para qualquer
 * condição nova entrar sem justificar.
 */
const SO_ENVIO_EM_CURSO = new Set(['pendente', 'salvando', 'saindo', 'enviando', 'carregando', 'importando', 'processando'])

function arquivos(dir: string): string[] {
  const achados: string[] = []
  for (const entrada of readdirSync(dir, { withFileTypes: true })) {
    const caminho = join(dir, entrada.name)
    if (entrada.isDirectory()) achados.push(...arquivos(caminho))
    else if (/[.]tsx$/.test(entrada.name)) achados.push(caminho)
  }
  return achados
}

export type BotaoTravado = { arquivo: string; condicao: string; explica: boolean }

/**
 * Lê o elemento de abertura de cada `<Button>` — do `<Button` até o `>` que está FORA de qualquer
 * chave. Delimitar pelo fim real do elemento, e não por uma janela de N caracteres, é a armadilha
 * nº 4 da tabela de guarda cega do `CLAUDE.md`: com janela, o `motivoDesabilitado` do botão
 * vizinho cai dentro e a guarda passa.
 */
export function botoesTravados(fonte: string, arquivo = ''): BotaoTravado[] {
  const achados: BotaoTravado[] = []
  let i = 0
  while (true) {
    i = fonte.indexOf('<Button', i)
    if (i === -1) break
    let j = i
    let profundidade = 0
    while (j < fonte.length) {
      const c = fonte[j]
      if (c === '{') profundidade++
      else if (c === '}') profundidade--
      else if (c === '>' && profundidade === 0) break
      j++
    }
    const elemento = fonte.slice(i, j)
    const m = /disabled=\{([\s\S]*?)\}\s*(?:[a-zA-Z]|\/?>|$)/.exec(elemento)
    if (m) achados.push({ arquivo, condicao: m[1]!.trim(), explica: elemento.includes('motivoDesabilitado') })
    i = j + 1
  }
  return achados
}

/** A condição é apenas "a ação já está rodando"? */
function apenasEnvioEmCurso(condicao: string): boolean {
  return SO_ENVIO_EM_CURSO.has(condicao.trim())
}

const TODOS = RAIZES.flatMap(arquivos).map((f) => f.split(String.fromCharCode(92)).join('/'))
const TRAVADOS = TODOS.flatMap((f) => botoesTravados(readFileSync(f, 'utf8'), f))

describe('o leitor deste teste', () => {
  it('acha o elemento inteiro, e não uma janela de caracteres', () => {
    const dois = botoesTravados(
      ['<Button disabled={x.length === 0}>A</Button>', '<Button disabled={y} motivoDesabilitado="por isso">B</Button>'].join(
        String.fromCharCode(10),
      ),
    )
    expect(dois).toHaveLength(2)
    expect(dois[0]!.explica, 'o motivo do botão VIZINHO vazou para este').toBe(false)
    expect(dois[1]!.explica).toBe(true)
    expect(dois[0]!.condicao).toBe('x.length === 0')
  })

  it('enxerga os botões do produto — não passa por não ter olhado nada', () => {
    expect(TODOS.length, 'nenhum .tsx encontrado').toBeGreaterThan(80)
    expect(TRAVADOS.length, 'nenhum <Button disabled> encontrado — o parser quebrou').toBeGreaterThan(15)
    expect(TRAVADOS.some((b) => b.explica), 'nenhum botão explica — a prop sumiu do projeto?').toBe(true)
  })
})

describe('botão travado diz por quê', () => {
  it('nenhum botão fica indisponível sem explicação', () => {
    const mudos = TRAVADOS.filter((b) => !b.explica && !apenasEnvioEmCurso(b.condicao)).map(
      (b) => `${b.arquivo} → disabled={${b.condicao}}`,
    )
    expect(
      mudos,
      'estes botões ficam travados sem dizer o motivo. Quem enxerga às vezes deduz pelos campos ' +
        'vazios acima; no leitor de tela sai "«Ação», indisponível" e ponto. Use a prop ' +
        '`motivoDesabilitado` do Button (vira `title` e `sr-only`) com uma frase que diga O QUE ' +
        'FAZER, não o que está errado.',
    ).toEqual([])
  })

  it('a dispensa de "já está enviando" é estreita — não vale para condição de conteúdo', () => {
    // Guarda contra a própria exceção: se ela crescer para casar `!nome` ou `length === 0`, a
    // regra inteira vira decoração.
    for (const condicao of ['!nome.trim()', 'itens.length === 0', 'codigo.length !== 6', 'servicos.length === 0 || pendente']) {
      expect(apenasEnvioEmCurso(condicao), `"${condicao}" não pode ser dispensada`).toBe(false)
    }
    expect(apenasEnvioEmCurso('pendente')).toBe(true)
  })

  it('a explicação diz o que fazer, não só que está travado', () => {
    // Copy que só repete o estado ("não é possível", "indisponível") não ajuda ninguém — a regra
    // do CLAUDE.md é que o erro explique o que fazer.
    const VAZIAS = /^(não é possível|indisponível|bloqueado|desabilitado)\.?$/i
    const fracas = TODOS.flatMap((f) => {
      const src = readFileSync(f, 'utf8')
      return [...src.matchAll(/motivoDesabilitado="([^"]+)"/g)].map((m) => ({ arquivo: f, texto: m[1]! }))
    }).filter((m) => VAZIAS.test(m.texto.trim()) || m.texto.trim().length < 15)
    expect(fracas.map((m) => `${m.arquivo} → "${m.texto}"`)).toEqual([])
  })
})
