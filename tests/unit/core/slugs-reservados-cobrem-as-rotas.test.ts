import { readdirSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { SLUGS_RESERVADOS, ehRotaDoProduto } from '@/core/tenants/slugs-reservados'

/**
 * A lista de slugs reservados existe para impedir uma falha silenciosa e permanente: toda pasta de
 * `src/app/` ganha de `[slug]` no roteamento, então um salão que escolhesse o nome de uma rota do
 * produto ficaria **inacessível para sempre, sem erro nenhum avisando** — `/{slug}` passaria a
 * servir a página estática e a página pública dele nunca carregaria.
 *
 * **A lista estava incompleta, e o defeito era exatamente aquele.** Medido em 2026-09-03: faltavam
 * SEIS segmentos que existem como pasta — `avaliar`, `orcamento`, `precos`, `privacidade`,
 * `recuperar-senha` e `termos`. O comentário que a acompanhava descrevia o risco com precisão; a
 * lista simplesmente não acompanhou as rotas que nasceram depois dele.
 *
 * Lista escrita à mão contra realidade que muda é a armadilha de `consertar-a-pergunta-nao-o-caso`.
 * Este teste **deriva** os segmentos do sistema de arquivos e compara. Rota nova nasce reprovando
 * até entrar na lista — que é a única forma de ela não envelhecer de novo.
 */

const RAIZ = 'src/app'

/**
 * Os segmentos de PRIMEIRO nível que o roteador enxerga.
 *
 * Grupo de rota (`(auth)`, `(public)`) não vira segmento: os filhos dele sobem um nível, e é
 * justamente por isso que `precos` e `termos` disputavam com `[slug]` sem estar na lista. Pasta
 * dinâmica (`[slug]`) é o próprio caminho curinga e sai da conta.
 */
function segmentosDeRota(dir: string): string[] {
  const achados: string[] = []
  for (const entrada of readdirSync(dir, { withFileTypes: true })) {
    if (!entrada.isDirectory()) continue
    const nome = entrada.name
    if (nome.startsWith('_')) continue
    if (nome.startsWith('(') && nome.endsWith(')')) {
      achados.push(...segmentosDeRota(join(dir, nome)))
    } else if (!nome.startsWith('[')) {
      achados.push(nome)
    }
  }
  return achados
}

const SEGMENTOS = [...new Set(segmentosDeRota(RAIZ))].filter((s) => /^[a-z0-9][a-z0-9-]*$/.test(s))

describe('o leitor deste teste', () => {
  it('enxerga as rotas — não passa por não ter olhado nada', () => {
    expect(SEGMENTOS.length, 'nenhum segmento de rota encontrado em src/app').toBeGreaterThanOrEqual(10)
    // Dois que TÊM que aparecer: um de grupo de rota e um de pasta direta. Se o desmembramento de
    // grupo quebrar, `precos` some da varredura e o defeito original volta sem ninguém ver.
    expect(SEGMENTOS, 'a varredura parou de descer nos grupos de rota, tipo (public)').toContain('precos')
    expect(SEGMENTOS, 'a varredura parou de ver pasta direta').toContain('admin')
  })

  it('ignora grupo de rota e pasta dinâmica, que não viram segmento', () => {
    for (const naoEhSegmento of ['(public)', '(auth)', '[slug]', '[token]']) {
      expect(SEGMENTOS).not.toContain(naoEhSegmento)
    }
  })
})

describe('toda rota do produto está reservada contra slug de salão', () => {
  it('nenhum segmento real fica de fora da lista', () => {
    const desprotegidos = SEGMENTOS.filter((s) => !SLUGS_RESERVADOS.has(s))
    expect(
      desprotegidos,
      'estes segmentos existem como rota e NÃO estão reservados. Um salão que escolher um destes ' +
        'endereços fica com a página pública inacessível para sempre, e sem erro nenhum avisando — ' +
        'a rota estática ganha de `[slug]`. Acrescente em `core/tenants/slugs-reservados.ts`.',
    ).toEqual([])
  })

  it('a lista não está vazia nem virou tudo', () => {
    // Guarda contra os dois jeitos de "resolver" burlando: esvaziar a lista faz a asserção acima
    // reprovar, mas encher com tudo faria o onboarding recusar qualquer nome.
    expect(SLUGS_RESERVADOS.size).toBeGreaterThanOrEqual(SEGMENTOS.length)
    expect(SLUGS_RESERVADOS.size).toBeLessThan(60)
  })
})

describe('ehRotaDoProduto', () => {
  it('reconhece rota do produto, e ignora caixa e espaço', () => {
    expect(ehRotaDoProduto('precos')).toBe(true)
    expect(ehRotaDoProduto('  PRECOS ')).toBe(true)
    expect(ehRotaDoProduto('admin')).toBe(true)
  })

  it('não confunde um salão de verdade com rota do produto', () => {
    for (const salao of ['dom-rocha', 'barbearia-do-ze', 'studio-ana', 'precos-imbativeis']) {
      expect(ehRotaDoProduto(salao), `${salao} foi tratado como rota do produto`).toBe(false)
    }
  })
})
