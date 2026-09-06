import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { semComentarios as semComentariosDe } from '../../helpers/fonte'

/**
 * Achado ao executar o `docs/48` C4 (`docs/49` I-04).
 *
 * A `0065` deu ao serviço duas réguas: `cycle_days` (palpite do catálogo, 21 ou o do pack da
 * profissão) e `cycle_days_observado` (a cadência que a clientela DAQUELE salão de fato tem). O
 * job noturno passou a preferir a medida. O `recomputarCicloDeUmAtendimento` — que roda ao
 * concluir um atendimento — continuou lendo só `cycle_days`.
 *
 * As duas funções escrevem a MESMA linha de `client_cycles`. Então concluir um atendimento
 * revertia a previsão daquela pessoa para o palpite de catálogo, e a madrugada seguinte a trazia
 * de volta: o número da tela oscilava sozinho, e nada ficava vermelho, porque cada caminho estava
 * certo por si. É a família do `consertar-a-pergunta-nao-o-caso` — o conserto de um lado deixou o
 * irmão dele sem vigia.
 *
 * A guarda não pergunta "o `recomputarCicloDeUmAtendimento` está certo?", e sim "a régua sai de um
 * lugar só?". Caminho novo nasce coberto.
 */

const CORE = 'src/core/ciclo/regua-do-servico.ts'
const SEPARADOR = String.fromCharCode(92)

function arquivos(dir: string): string[] {
  const achados: string[] = []
  for (const entrada of readdirSync(dir, { withFileTypes: true })) {
    const caminho = join(dir, entrada.name)
    if (entrada.isDirectory()) achados.push(...arquivos(caminho))
    else if (/\.tsx?$/.test(entrada.name)) achados.push(caminho)
  }
  return achados
}

function semComentarios(caminho: string): string {
  return semComentariosDe(readFileSync(caminho, 'utf8'))
}

const TODOS = arquivos('src')

describe('a régua efetiva do ciclo sai de um lugar só', () => {
  it('a leitura enxerga o projeto — a guarda não passa por não ter olhado nada', () => {
    expect(TODOS.length).toBeGreaterThan(100)
    expect(semComentarios(CORE), 'a função que centraliza a régua sumiu').toMatch(/export function reguaEfetivaDias\(/)
  })

  /**
   * `cycle_days_observado ?? cycle_days` (ou o inverso) fora do módulo é uma SEGUNDA definição da
   * mesma regra — a forma exata de divergência que existiu entre os dois recálculos.
   */
  it('ninguém escolhe entre as duas réguas fora do módulo que decide isso', () => {
    const normalizado = (caminho: string) => caminho.split(SEPARADOR).join('/')
    const foraDoLugar = TODOS.filter((f) => normalizado(f) !== CORE && !f.endsWith('types.gen.ts')).filter((f) => {
      const src = semComentarios(f)
      return /cycle_days_observado\s*\?\?/.test(src) || /cycleDaysObservado\s*\?\?/.test(src)
    })
    expect(
      foraDoLugar,
      'estes arquivos decidem sozinhos qual régua usar, em vez de chamar `reguaEfetivaDias` — ' +
        `foi assim que os dois recálculos divergiram: ${foraDoLugar.join(', ')}`,
    ).toEqual([])
  })

  it('todo cálculo de ciclo recebe a régua efetiva, e não a coluna crua', () => {
    const src = semComentarios('src/server/services/ciclo.ts')

    expect(
      /cycleDaysPorServico = new Map\([\s\S]*?reguaEfetivaDias\(/.test(src),
      'o mapa de réguas do job noturno não passa mais por `reguaEfetivaDias`',
    ).toBe(true)

    const chamadas = src.match(/computeCycle\(\{[^}]*\}\)/g) ?? []
    expect(chamadas.length, 'nenhuma chamada de computeCycle encontrada — o recálculo mudou de forma').toBeGreaterThanOrEqual(2)

    /*
      Duas formas aceitas, e nenhuma outra: o atalho `defaultCycleDays,` (a variável que veio do
      mapa, já efetiva) e a chamada direta. `defaultCycleDays: servico.data.cycle_days` — o defeito
      real — não é nenhuma das duas.
    */
    const torto = chamadas.filter((c) => !/defaultCycleDays\s*(,|:\s*reguaEfetivaDias\()/.test(c))
    expect(
      torto,
      'uma chamada de computeCycle recebe uma régua que não veio de `reguaEfetivaDias` — concluir ' +
        `um atendimento reverteria a previsão para o palpite do catálogo: ${torto.join(' | ')}`,
    ).toEqual([])
  })
})
