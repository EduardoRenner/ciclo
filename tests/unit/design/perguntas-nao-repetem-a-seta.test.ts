import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { semComentarios } from '../../helpers/fonte'

/**
 * As perguntas frequentes da landing saem de `PERGUNTAS.map()`, e o lucide inlina o `<path>` e
 * todos os atributos em CADA volta. Medido no HTML servido, produção contra local:
 *
 * | | por pergunta | fixo |
 * |---|--:|--:|
 * | `<ArrowRight>` do lucide | **390 B** | — |
 * | `<use>` apontando pro `<symbol>` | **199 B** | 295 B |
 *
 * São 191 B a menos por pergunta, 49%. O custo fixo do símbolo se paga a partir da SEGUNDA
 * pergunta; com as cinco de hoje o bloco caiu de 1.950 B para 1.290 B. O que torna isto diferente
 * de uma micro-otimização é o crescimento: cada pergunta nova custava 390 B para sempre.
 *
 * Mesmo conserto das estrelas do salão e dos ícones de `/precos`, com a MESMA armadilha de
 * cascata: `fill="none"` fica no `<svg>` que USA, nunca no `<symbol>`. Dentro do símbolo o
 * atributo fica mais perto do `<path>` do que a classe do `<svg>` externo, ganha, e o ícone
 * renderiza vazado — foi assim que a primeira versão daquele conserto entregou 25 estrelas ocas
 * com typecheck, lint e suíte inteira verdes.
 *
 * Diferença para a guarda de `/precos`: aqui o `<ArrowRight>` do lucide **continua** no arquivo,
 * de propósito. Ele desenha um CTA solto, fora de qualquer laço, onde inlinar custa 304 B uma vez
 * só e trocar por símbolo sairia mais caro. Por isso esta guarda delimita o bloco das perguntas e
 * afirma dentro dele — proibir `<ArrowRight` no arquivo inteiro reprovaria o uso legítimo.
 */
const LANDING = join('src', 'app', 'page.tsx')

/** O laço das perguntas, delimitado pelo fim real do elemento — nunca por janela de caracteres. */
function blocoDasPerguntas(src: string): string {
  const i = src.indexOf('{PERGUNTAS.map(')
  if (i === -1) throw new Error(`${LANDING} não tem mais o laço PERGUNTAS.map — a guarda perdeu o alvo`)
  const fim = src.indexOf('</details>', i)
  if (fim === -1) throw new Error(`${LANDING}: laço das perguntas sem </details> — delimitação quebrou`)
  return src.slice(i, fim + '</details>'.length)
}

function fonte(): string {
  return semComentarios(readFileSync(LANDING, 'utf8'))
}

describe('as perguntas frequentes não repetem o SVG da seta', () => {
  it('a guarda ainda enxerga o alvo: símbolo, laço e bloco delimitado', () => {
    // Piso do detector. Sem isto, um `page.tsx` reescrito faria todas as asserções abaixo
    // passarem vazias em vez de gritar.
    const src = fonte()
    expect(src, 'nenhum <symbol> na landing').toMatch(/<symbol\b/)
    const bloco = blocoDasPerguntas(src)
    expect(bloco.length).toBeGreaterThan(120)
    expect(bloco).toMatch(/<summary\b/)
  })

  it('a seta de cada pergunta é <use>, não um ícone que inlina o path', () => {
    expect(blocoDasPerguntas(fonte())).toMatch(/<use\s+href=/)
  })

  it('nenhum <ArrowRight> sobrou DENTRO do laço', () => {
    // No laço ele custaria 390 B por pergunta. Fora dele é legítimo — ver o docstring.
    expect(blocoDasPerguntas(fonte())).not.toMatch(/<ArrowRight\b/)
  })

  it('o CTA solto continua com ícone, e é por isso que o import fica', () => {
    // Sem esta asserção, "limpar o import que sobrou" viraria um conserto plausível e erraria:
    // o `ArrowRight` ainda desenha o botão de ação fora de qualquer laço.
    const src = fonte()
    expect(src).toMatch(/<ArrowRight\b/)
    expect(src).toMatch(/import\s*\{[^}]*\bArrowRight\b[^}]*\}\s*from\s*'lucide-react'/)
  })

  it('as duas pontas da costura usam a MESMA constante de id', () => {
    // Guarda que confere um lado da costura não prova a costura: o `<symbol>` que DEFINE e o
    // `<use>` que CONSOME precisam sair da mesma constante. Um id literal em qualquer das pontas
    // volta a permitir que elas divirjam em silêncio, e a seta some sem erro nenhum.
    const src = fonte()
    expect(src, 'a constante do id sumiu').toMatch(/const\s+ID_SETA_PERGUNTA\s*=/)
    expect(src, 'o <symbol> não declara o id pela constante').toMatch(/<symbol\s+id=\{ID_SETA_PERGUNTA\}/)
    expect(blocoDasPerguntas(src), 'o <use> não aponta pela constante').toContain(
      String.raw`href={` + '`#${ID_SETA_PERGUNTA}`' + '}',
    )
  })

  it('o path da seta é desenhado UMA vez no arquivo', () => {
    expect(fonte().match(/d="M5 12h14"/g) ?? []).toHaveLength(1)
  })

  it('o <symbol> NÃO define fill — senão o ícone renderiza vazado', () => {
    const blocos = fonte().match(/<symbol[^>]*>/g) ?? []
    expect(blocos.length).toBeGreaterThanOrEqual(1)
    for (const b of blocos) {
      expect(b, 'fill dentro do <symbol> ganha da classe do <svg> externo').not.toMatch(/fill=/)
    }
  })

  it('o <svg> que usa define fill="none"', () => {
    const usos = [...blocoDasPerguntas(fonte()).matchAll(/<svg[\s\S]*?<use/g)].map((m) => m[0])
    expect(usos.length).toBeGreaterThanOrEqual(1)
    for (const u of usos) expect(u).toMatch(/fill="none"/)
  })
})
