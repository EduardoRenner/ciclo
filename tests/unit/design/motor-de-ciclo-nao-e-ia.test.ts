import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { semComentarios } from '../../helpers/fonte'

/**
 * O Motor de Ciclo é **mediana de intervalos**, não aprendizado de máquina. `core/cycle/compute.ts`
 * diz no topo, com todas as letras: *determinístico, sem ML* — mediana dos gaps daquela pessoa,
 * com descarte de exceção e limite de 0,5x a 2,5x.
 *
 * Chamar isso de "aprende" empresta vocabulário de IA a uma conta de mediana. Num público que
 * precisa confiar dado de cliente (e dado de SAÚDE) ao software, ser pego exagerando custa mais
 * que o exagero rende — é o que o `docs/20-COPY-PLANO.md` §C.2 chama de gatilho nº 1 do cético.
 *
 * **Por que esta guarda existe separada, e por que ela varre o produto inteiro.** A regra já
 * existia dentro de `home-nao-promete-demais.test.ts`, que lê UM arquivo: `src/app/page.tsx`. A
 * home foi limpa e a palavra sobreviveu em cinco telas internas — inclusive na aba central de
 * quem acabou de criar conta (`vazio-de-recuperar.ts`, a primeira coisa que um salão novo lê) e
 * no `llms.txt`, que serve a frase a robô. Guarda cega de RAIZ: a varredura não olhava onde o
 * defeito podia nascer, e a auditoria de 2026-09-08 achou o resultado.
 *
 * A regra saiu de lá e mora aqui, uma vez só. Duas cópias da mesma regra divergem — este projeto
 * já pagou por isso.
 *
 * **Comentário não conta.** `semComentarios` corta antes de casar: vários arquivos EXPLICAM em
 * prosa por que o Motor não é IA, e reprovar a documentação que impede o defeito de voltar é a
 * armadilha nº 1 da tabela do `CLAUDE.md`.
 */

const RAIZES = [join('src', 'app'), join('src', 'core'), join('src', 'server'), join('src', 'components')]

const PROIBIDOS = [/aprende/i, /aprendend/i, /aprender\b/i, /ensina ao sistema/i, /intelig[êe]ncia artificial/i, /machine learning/i]

function fontes(dir: string): string[] {
  const achados: string[] = []
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const caminho = join(dir, e.name)
    if (e.isDirectory()) achados.push(...fontes(caminho))
    else if (/[.]tsx?$/.test(e.name)) achados.push(caminho.split(String.fromCharCode(92)).join('/'))
  }
  return achados
}

const ARQUIVOS = RAIZES.flatMap(fontes)

describe('a varredura enxerga o produto, não um arquivo só', () => {
  it('acha um volume de fontes compatível com o projeto', () => {
    // O piso não é decoração: a versão anterior desta regra lia UM arquivo e por isso não viu
    // cinco telas. Se a varredura encolher de novo, isto fica vermelho antes de alguém descobrir
    // pela auditoria seguinte.
    expect(ARQUIVOS.length, `varredura devolveu ${ARQUIVOS.length} arquivos — o caminho mudou?`).toBeGreaterThan(200)
  })

  it('alcança as quatro raízes, e não só `app`', () => {
    for (const raiz of ['src/app/', 'src/core/', 'src/server/', 'src/components/']) {
      expect(
        ARQUIVOS.some((a) => a.includes(raiz)),
        `${raiz} ficou fora do alcance — foi assim que a palavra sobreviveu em core/ e server/`,
      ).toBe(true)
    }
  })

  it('e o detector reconhece a frase que motivou a regra', () => {
    // Guarda contra o próprio detector: se o padrão parar de casar, tudo abaixo passa vazio.
    const frase = 'Ele aprende de quanto em quanto tempo cada uma volta.'
    expect(PROIBIDOS.some((p) => p.test(frase))).toBe(true)
    expect(PROIBIDOS.some((p) => p.test('Ele usa o intervalo de cada pessoa'))).toBe(false)
  })
})

describe('nenhuma copy descreve o Motor de Ciclo como IA', () => {
  it('o produto inteiro está livre do vocabulário de aprendizado', () => {
    const ofensores: string[] = []
    for (const arquivo of ARQUIVOS) {
      const copy = semComentarios(readFileSync(arquivo, 'utf8'))
      for (const padrao of PROIBIDOS) {
        const achado = copy.match(padrao)
        if (achado) ofensores.push(`${arquivo}: ${padrao.source} (${achado[0]})`)
      }
    }

    expect(
      ofensores,
      'copy descrevendo com vocabulário de IA um cálculo que `compute.ts` declara determinístico ' +
        '("sem ML"). Descreva o que o Motor faz de verdade: usa o intervalo entre as visitas ' +
        'daquela pessoa. Comentário não entra aqui — só o texto que alguém lê na tela.',
    ).toEqual([])
  })
})
