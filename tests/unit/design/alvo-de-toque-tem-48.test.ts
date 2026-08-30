import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * L-12, `docs/31-LANCAMENTO-AUDITORIA-E-PLANO.md` — a guarda nasceu de um **erro meu de medição**,
 * e vale registrar isso porque a lição é maior que a regra.
 *
 * A auditoria de 30/08 reportou dois alvos de toque pequenos demais na landing e em `/precos`.
 * Eram falso positivo: a medição usou `getBoundingClientRect().height < 44`, que enxerga só a
 * caixa VISUAL. A classe `toque-48` desta casa não muda a caixa visual — ela adiciona um
 * `::after` absoluto de 48 px, que é o que de fato recebe o toque. Medido depois por sondagem
 * (`document.elementFromPoint` ponto a ponto, de −30 px acima a +30 px abaixo do elemento), os
 * quatro links de rodapé da landing têm caixa visual de 16 a 38 px e **área efetiva de 48–49 px**.
 *
 * Ou seja: a régua estava errada, não o produto. É a mesma classe de defeito que o `CLAUDE.md`
 * chama de guarda cega, pelo avesso — um detector que ACUSA o que está certo custa tanto quanto
 * um que ABSOLVE o que está errado, porque manda alguém "consertar" código bom.
 *
 * **O que esta guarda faz, então:** o que dá para checar de verdade no fonte. Elemento interativo
 * que declara uma altura menor que 48 px (`h-4` a `h-11`, isto é 16 a 44 px) precisa carregar
 * `toque-48`. Isso pega o caso real — alguém escrever um link pequeno e esquecer a classe — sem
 * repetir o erro de tentar adivinhar geometria lendo texto.
 *
 * **O que ela NÃO faz, e é deliberado:** não tenta calcular altura de elemento sem classe de
 * altura explícita (herda do conteúdo, do `line-height`, do pai — indecidível no fonte). Esse
 * caso continua sendo trabalho de medição no navegador, e a receita certa está escrita aqui em
 * cima para quem for fazer de novo.
 */

const RAIZES = ['src/app', 'src/components']

/** `h-4` a `h-11` — de 16 px a 44 px. `h-12` (48 px) é o piso da casa e já passa. */
const ALTURA_PEQUENA = /\bh-(4|5|6|7|8|9|10|11)\b/

function arquivos(dir: string): string[] {
  const achados: string[] = []
  for (const entrada of readdirSync(dir, { withFileTypes: true })) {
    const caminho = join(dir, entrada.name)
    if (entrada.isDirectory()) achados.push(...arquivos(caminho))
    else if (/[.]tsx$/.test(entrada.name)) achados.push(caminho)
  }
  return achados
}

export type Interativo = { arquivo: string; tag: string; classes: string }

/**
 * O valor de `className`, e só ele — sem comentário e sem outra prop.
 *
 * **Esta função existe por causa de um erro que este próprio arquivo cometeu**, e o registro fica
 * porque a lição é a armadilha nº 1 da tabela de guarda cega do `CLAUDE.md`: *casar com o que MUDA
 * quando o defeito volta, nunca com um nome que aparece em comentário ou string vizinha.*
 *
 * A primeira versão testava `elemento.includes('toque-48')` no recorte inteiro do elemento. Ela
 * pegou o alvo de 44px do onboarding na primeira execução. Aí o conserto entrou **junto com um
 * comentário explicando por que `toque-48` era seguro ali** — e o comentário passou a satisfazer a
 * busca sozinho. Na mutação de conferência a classe foi removida do `className`, o comentário
 * ficou, e a guarda passou verde protegendo nada.
 *
 * Só apareceu porque a mutação é obrigatória. Sem ela, este arquivo teria sido entregue como
 * "verificado".
 */
function className(elemento: string): string {
  const semComentario = elemento.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*$/gm, ' ')
  return [...semComentario.matchAll(/className\s*=\s*(?:"([^"]*)"|\{`([^`]*)`\}|\{"([^"]*)"\})/g)]
    .map((m) => m[1] ?? m[2] ?? m[3] ?? '')
    .join(' ')
}

/**
 * Lê o elemento de abertura de cada `<a>`, `<button>` e `<Link>` — do `<` até o `>` que está FORA
 * de qualquer chave. Delimitar pelo fim real do elemento, e não por uma janela de N caracteres, é
 * a armadilha nº 4 da tabela de guarda cega do `CLAUDE.md`: com janela, o `toque-48` do vizinho
 * cai dentro e a guarda passa.
 */
export function interativos(fonte: string, arquivo = ''): Interativo[] {
  const achados: Interativo[] = []
  for (const tag of ['a', 'button', 'Link']) {
    const abertura = new RegExp(`<${tag}(?=[\\s/>])`, 'g')
    let m: RegExpExecArray | null
    while ((m = abertura.exec(fonte)) !== null) {
      let j = m.index
      let profundidade = 0
      while (j < fonte.length) {
        const c = fonte[j]
        if (c === '{') profundidade++
        else if (c === '}') profundidade--
        else if (c === '>' && profundidade === 0) break
        j++
      }
      achados.push({ arquivo, tag, classes: className(fonte.slice(m.index, j)) })
    }
  }
  return achados
}

const TODOS = RAIZES.flatMap(arquivos).map((f) => f.split(String.fromCharCode(92)).join('/'))
const ELEMENTOS = TODOS.flatMap((f) => interativos(readFileSync(f, 'utf8'), f))

describe('a leitura deste teste', () => {
  it('acha o elemento inteiro, e não uma janela de caracteres', () => {
    const dois = interativos(
      ['<a className="h-6">A</a>', '<a className="toque-48 h-6">B</a>'].join(String.fromCharCode(10)),
    )
    expect(dois).toHaveLength(2)
    expect(dois[0]!.classes.includes('toque-48'), 'o toque-48 do VIZINHO vazou para este').toBe(false)
    expect(dois[1]!.classes.includes('toque-48')).toBe(true)
  })

  it('comentário que MENCIONA toque-48 não vale como ter a classe', () => {
    /*
     * O caso que cegou a primeira versão deste arquivo. Ver o comentário de `className()`: o
     * conserto do onboarding entrou junto com um comentário explicando o `toque-48`, e o
     * comentário passou a satisfazer a busca sozinho — a guarda ficou verde com a classe removida.
     */
    const comComentario = interativos(
      ['<button', '  // toque-48 seria bom aqui', '  className="h-11"', '>x</button>'].join(String.fromCharCode(10)),
    )
    expect(comComentario).toHaveLength(1)
    expect(
      comComentario[0]!.classes.includes('toque-48'),
      'o comentário está satisfazendo a busca no lugar da classe — guarda cega',
    ).toBe(false)
    expect(comComentario[0]!.classes, 'o className de verdade tem que ter sido lido').toContain('h-11')
  })

  it('enxerga os elementos do produto — não passa por não ter olhado nada', () => {
    expect(TODOS.length, 'nenhum .tsx encontrado').toBeGreaterThan(80)
    expect(ELEMENTOS.length, 'nenhum <a>/<button>/<Link> encontrado — o parser quebrou').toBeGreaterThan(50)
    expect(
      ELEMENTOS.some((e) => e.classes.includes('toque-48')),
      'nenhum elemento usa toque-48 — a classe sumiu do projeto?',
    ).toBe(true)
  })

  it('o detector de altura pequena reconhece as alturas que importam', () => {
    // Guarda contra o próprio detector: se o regex parar de casar, tudo passa vazio.
    for (const pequena of ['h-4', 'h-6', 'h-10', 'h-11']) {
      expect(ALTURA_PEQUENA.test(`inline-flex ${pequena} items-center`), `${pequena} devia ser pequena`).toBe(true)
    }
    for (const ok of ['h-12', 'h-14', 'h-dvh', 'h-full', 'h-auto']) {
      expect(ALTURA_PEQUENA.test(`flex ${ok} items-center`), `${ok} NÃO devia ser pequena`).toBe(false)
    }
  })
})

describe('alvo de toque pequeno declara toque-48', () => {
  it('nenhum interativo com altura menor que 48px fica sem a área de toque', () => {
    const descobertos = ELEMENTOS.filter((e) => ALTURA_PEQUENA.test(e.classes) && !e.classes.includes('toque-48')).map(
      (e) => `${e.arquivo} → <${e.tag}> com altura menor que 48px`,
    )

    expect(
      descobertos,
      'estes elementos são clicáveis, declaram altura menor que 48px e não têm `toque-48`. A ' +
        'classe não muda a caixa visual — ela põe um `::after` absoluto de 48px, que é o que ' +
        'recebe o dedo. Sem ela o alvo é o tamanho que aparece, e este produto é usado de celular, ' +
        'com o polegar, por quem está atendendo alguém.',
    ).toEqual([])
  })
})
