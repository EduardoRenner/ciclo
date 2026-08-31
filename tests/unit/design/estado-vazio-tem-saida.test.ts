import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { vazioDeRecuperar } from '@/core/ciclo/vazio-de-recuperar'

/**
 * `EmptyState` exige a prop `acao` com um comentario explicito: "estado vazio nunca e so 'nenhum
 * resultado'. Tela vazia sem saida e beco sem saida." So que o tipo e `React.ReactNode`, entao um
 * `<span>Volte mais tarde</span>` satisfaz a obrigacao sem cumprir nada — foi exatamente o que a
 * tela de Recuperar receita fazia, e ficou grave quando ela virou o botao CENTRAL da barra em
 * 31/08: passou a ser a primeira coisa que um salao novo toca.
 *
 * Esta guarda faz o que o tipo nao consegue.
 */
const EXCECOES_COM_MOTIVO: Record<string, string> = {
  'src/app/admin/config/cofre/trilha.tsx':
    'Trilha de acesso ao cofre: log de conformidade alcancado de proposito pelas Configuracoes, ' +
    'com voltar no topo. Vazio ali e BOA noticia (ninguem abriu ficha de saude) e nao ha acao a ' +
    'oferecer — nao e beco, e fim de corredor com porta atras.',
}

/**
 * Fecha no `/>` que esta sozinho na linha. `icone={<X ... />}` tambem contem `/>`, e parar no
 * primeiro recortava o bloco ANTES da prop `acao` — foi assim que a primeira medicao desta
 * varredura acusou 17 telas quebradas que nao existiam.
 */
function blocosDeEmptyState(fonte: string): string[] {
  const blocos: string[] = []
  let atual: string[] | null = null
  for (const linha of fonte.split(NL)) {
    if (atual === null && linha.includes(ABERTURA)) atual = [linha]
    else if (atual !== null) atual.push(linha)
    if (atual !== null && linha.trim() === FECHAMENTO) {
      blocos.push(atual.join(NL))
      atual = null
    }
  }
  return blocos
}

const NL = String.fromCharCode(10)
const ABERTURA = '<EmptyState'
const FECHAMENTO = '/' + '>'

function tsxDe(dir: string): string[] {
  const achados: string[] = []
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const caminho = join(dir, e.name)
    if (e.isDirectory()) achados.push(...tsxDe(caminho))
    else if (e.name.endsWith('.tsx')) achados.push(caminho)
  }
  return achados
}

// `/dev/ui` e vitrine de componentes, nao tela de produto.
const ARQUIVOS = tsxDe(join('src', 'app')).filter((f) => !f.includes('dev'))
const paraPosix = (p: string) => p.split(String.fromCharCode(92)).join('/')

describe('todo estado vazio oferece uma saida de verdade', () => {
  it('a varredura acha os EmptyState — senao passa vazia', () => {
    const total = ARQUIVOS.reduce((n, f) => n + blocosDeEmptyState(readFileSync(f, 'utf8')).length, 0)
    expect(total, 'nenhum <EmptyState> encontrado — o extrator quebrou').toBeGreaterThan(10)
  })

  for (const arquivo of ARQUIVOS) {
    const blocos = blocosDeEmptyState(readFileSync(arquivo, 'utf8'))
    if (blocos.length === 0) continue

    it(`${paraPosix(arquivo)} da caminho a quem chega`, () => {
      const normalizado = paraPosix(arquivo)
      for (const bloco of blocos) {
        if (!bloco.includes('acao=')) continue
        const acao = bloco.slice(bloco.indexOf('acao='))
        if (/<Link|<button|<Button|<a |onClick/.test(acao)) continue
        expect(
          EXCECOES_COM_MOTIVO[normalizado],
          `${normalizado} passa texto como acao e nao esta na lista de excecoes. ` +
            'Ou da um Link/Button de verdade, ou declara o motivo em EXCECOES_COM_MOTIVO.',
        ).toBeDefined()
      }
    })
  }
})

describe('o vazio de Recuperar receita fala a verdade das TRES situacoes', () => {
  it('sem cliente: manda cadastrar', () => {
    expect(vazioDeRecuperar(false, false).titulo).toMatch(/[Cc]adastre/)
  })

  it('com cliente e sem ciclo: NAO manda cadastrar de novo', () => {
    // O erro que isto impede: mandar a pessoa refazer o que ela ja fez. O ciclo nasce do primeiro
    // atendimento CONCLUIDO, nao da ficha.
    const v = vazioDeRecuperar(true, false)
    expect(v.titulo, 'mandou cadastrar quem ja tem ficha').not.toMatch(/[Cc]adastre/)
    expect(v.titulo).toMatch(/atendimento/i)
  })

  it('tudo em dia: e boa noticia, nao ausencia', () => {
    expect(vazioDeRecuperar(true, true).titulo).toBe('Todo mundo em dia')
  })

  it('as tres dizem coisas diferentes', () => {
    const t = [vazioDeRecuperar(false, false), vazioDeRecuperar(true, false), vazioDeRecuperar(true, true)].map((v) => v.titulo)
    expect(new Set(t).size, 'duas situacoes diferentes com a mesma frase').toBe(3)
  })
})
