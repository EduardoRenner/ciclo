import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { semComentarios } from '../../helpers/fonte'

/**
 * O wordmark da marca aparece em quatro páginas públicas, sempre no mesmo tamanho: `h-7 w-auto`,
 * que a 1102x448 de origem dá **69x28 px** — medido no navegador, não deduzido.
 *
 * Sem a prop `sizes`, o `next/image` não tem como saber disso. Ele cai no `deviceSizes` e monta o
 * `srcSet` pelas larguras de viewport, então o navegador baixa a variante de **1200 px** para um
 * slot de 69. Medido na produção em 2026-09-04, com o `Accept` que um navegador de verdade manda:
 *
 * | variante | PNG | WebP |
 * |---|--:|--:|
 * | `w=1200` (o que era servido) | 8.269 B | **13.248 B** |
 * | `w=256` (o que `sizes` escolhe a 2x) | 2.568 B | **5.450 B** |
 *
 * São **7,8 kB a menos, 59%** — e na landing isso pesa duas vezes, porque aquela imagem é a única
 * com `priority`: ela é pré-carregada e disputa banda com o resto na primeira pintura, que é
 * exatamente o momento que dói no celular antigo com 3G.
 *
 * Nota lateral medida no caminho, e que NÃO é o que esta guarda protege: para este arquivo o WebP
 * é MAIOR que o PNG em toda largura (+178% em `w=640`). É o esperado para logo — pouca cor e área
 * chapada comprimem melhor em PNG com paleta do que em WebP com perda. O `next/image` converte
 * assim que o navegador aceita, e não há controle por imagem. Depois do `sizes` o custo absoluto
 * ficou pequeno o bastante para não valer briga; se um dia valer, o caminho é SVG, que é o formato
 * certo para wordmark.
 */
const PAGINAS = [
  join('src', 'app', 'page.tsx'),
  join('src', 'app', '(public)', 'precos', 'page.tsx'),
  join('src', 'app', '(public)', 'privacidade', 'page.tsx'),
  join('src', 'app', '(public)', 'termos', 'page.tsx'),
  // Achados em 2026-09-19 (auditoria de Web Experience): a guarda só cobria estas quatro páginas
  // — `selo.tsx` (telas de auth) e `topbar.tsx` (TODA tela /admin/*, o maior alcance dos seis usos)
  // ficaram de fora, sem `sizes`, sem ninguém notar, porque nada aqui olhava pra eles. Achado por
  // inspeção manual da aba de rede, não por esta guarda — motivo exato de estendê-la agora.
  join('src', 'components', 'shell', 'selo.tsx'),
  join('src', 'components', 'shell', 'topbar.tsx'),
]

/**
 * Todas as tags `<Image>` que renderizam o wordmark (variável começando em `wordmark`, cobre tanto
 * `wordmark` quanto `wordmarkClaro` — `topbar.tsx` alterna os dois por tema e tem os DOIS na mesma
 * página). Antes disto a busca pegava só a primeira ocorrência por arquivo: bastava achar uma tag e
 * o resto do arquivo ficava fora do radar — era exatamente esse ponto cego que deixou a segunda
 * `<Image>` de `topbar.tsx` sem cobertura se essa fosse a única mudança feita aqui.
 */
function tagsDoWordmark(arquivo: string): string[] {
  const src = semComentarios(readFileSync(arquivo, 'utf8'))
  const tags: string[] = []
  const regex = /<Image src=\{wordmark\w*\}/g
  for (const m of src.matchAll(regex)) {
    const fim = src.indexOf('>', m.index)
    tags.push(src.slice(m.index, fim))
  }
  if (tags.length === 0) throw new Error(`${arquivo} não renderiza mais o wordmark — a guarda perdeu o alvo`)
  return tags
}

describe('a imagem da marca diz de que tamanho ela é', () => {
  it('a guarda alcança as seis páginas/componentes onde o wordmark aparece, em doze tags', () => {
    // Piso afirmado por NOME e por CONTAGEM: uma lista que encolhe em silêncio protege menos do
    // que parece — desde 2026-09-21 as seis páginas/componentes desta lista forçam tema claro
    // (a "frente de casa" inteira: home, preços, privacidade, termos, selo das telas de auth e o
    // painel), então as seis têm 2 tags cada agora (claro e escuro) — 12 no total.
    expect(PAGINAS).toHaveLength(6)
    const total = PAGINAS.reduce((soma, p) => soma + tagsDoWordmark(p).length, 0)
    expect(total).toBe(12)
  })

  it.each(PAGINAS)('%s declara sizes em TODA tag, senão o navegador baixa a variante mais larga', (arquivo) => {
    for (const tag of tagsDoWordmark(arquivo)) expect(tag).toMatch(/sizes=/)
  })

  it('a landing mantém o priority — é ela que paga o preload', () => {
    // Se o `priority` sair, o `sizes` continua certo mas o motivo de urgência muda; a guarda
    // deixaria de descrever a realidade e vale saber pela reprovação, não por leitura.
    expect(tagsDoWordmark(PAGINAS[0]!)[0]).toMatch(/priority/)
  })
})
