import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { semComentarios } from '../../helpers/fonte'

/**
 * "O material deste serviço é confiável?" tem UMA resposta, e ela mora em `custoDoServico`.
 *
 * A guarda existe porque a pergunta já foi remontada errado uma vez, e passou. `custoDoServico`
 * devolve `produtosSemCusto` desde que nasceu; `comanda.ts`, `clube.ts` e `ciclo.ts` chamavam a
 * função, pegavam só `custoCents` e reconstruíam a pergunta cada um do seu jeito. O clube
 * reconstruiu como `ficha.length === 0` — verdadeiro para toda ficha semeada pelo
 * `apply_vertical_pack`, que tem linha e não tem custo real nenhum por trás. A margem do clube
 * saía sem ressalva sobre um número inventado (`docs/51` §2).
 *
 * Mover a resposta para dentro da função conserta o caso. Só esta guarda impede o próximo
 * chamador de repetir a conta por fora — e é exatamente esse tipo de repetição que o `CLAUDE.md`
 * persegue no produto sob o nome de "duas fontes da mesma verdade".
 */

const RAIZ = 'src'
const DONO = join('src', 'core', 'comanda', 'custo-do-servico.ts')

function arquivosTs(dir: string): string[] {
  const achados: string[] = []
  for (const entrada of readdirSync(dir, { withFileTypes: true })) {
    const caminho = join(dir, entrada.name)
    if (entrada.isDirectory()) achados.push(...arquivosTs(caminho))
    else if (/\.tsx?$/.test(entrada.name)) achados.push(caminho)
  }
  return achados
}

/**
 * Atribuições de `materialIncerto`, não menções. Declaração de tipo (`materialIncerto: boolean`) e
 * leitura (`custo.materialIncerto`) ficam de fora: casar com o nome solto acusaria quem apenas
 * repassa a resposta, e a guarda nasceria sempre-vermelha.
 */
function atribuicoes(fonte: string): string[] {
  return (fonte.match(/materialIncerto:\s*[^,\n}]+/g) ?? [])
    .map((a) => a.trim())
    .filter((a) => !/materialIncerto:\s*boolean\b/.test(a))
}

/** A resposta veio pronta de quem sabe: `algo.materialIncerto`. */
function repassa(atribuicao: string): boolean {
  return /materialIncerto:\s*[\w.]*\.materialIncerto\b/.test(atribuicao)
}

describe('a pergunta "o material é confiável?" tem um dono só', () => {
  const arquivos = arquivosTs(RAIZ).filter((f) => !f.endsWith('types.gen.ts'))

  it('a varredura enxerga o código — e enxerga o dono da resposta', () => {
    expect(arquivos.length, 'nenhum arquivo lido de src/').toBeGreaterThan(100)
    expect(arquivos, 'o arquivo que responde a pergunta sumiu — esta guarda precisa ser revista').toContain(DONO)
    expect(
      atribuicoes(semComentarios(readFileSync(DONO, 'utf8'))).length,
      'custoDoServico parou de responder `materialIncerto`: a guarda ficou sem o positivo conhecido e passaria vazia',
    ).toBeGreaterThan(0)
  })

  /**
   * O piso é o positivo CONHECIDO, e não `> 0`: `clube.ts` repassa a resposta, e é justamente o
   * arquivo onde o defeito morou. Se ele parar de aparecer, ou a varredura quebrou ou alguém
   * apagou o repasse — os dois merecem vermelho, nenhum merece silêncio.
   */
  it('quem consome a resposta continua consumindo — o clube está na lista', () => {
    const clube = semComentarios(readFileSync(join('src', 'server', 'services', 'clube.ts'), 'utf8'))
    const suas = atribuicoes(clube)
    expect(suas.length, 'clube.ts parou de responder materialIncerto — o repasse sumiu').toBe(1)
    expect(repassa(suas[0]!), 'o clube voltou a montar a pergunta por fora').toBe(true)
  })

  it('ninguém fora do dono calcula a resposta — todos repassam', () => {
    const culpados: string[] = []
    for (const arquivo of arquivos) {
      if (arquivo === DONO) continue
      for (const atribuicao of atribuicoes(semComentarios(readFileSync(arquivo, 'utf8')))) {
        if (!repassa(atribuicao)) culpados.push(`${arquivo}: ${atribuicao}`)
      }
    }
    expect(
      culpados,
      'a pergunta foi remontada fora de `custoDoServico`. Foi assim que a margem do clube passou a ' +
        'afirmar um custo inventado: `ficha.length === 0` é verdade para toda ficha semeada pelo pack. ' +
        'Use o `materialIncerto` que `custoDoServico` já devolve.',
    ).toEqual([])
  })
})
