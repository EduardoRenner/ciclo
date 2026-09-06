import { readFileSync, readdirSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { sqlSemComentarios as semComentarios } from '../../helpers/fonte'

/**
 * O pack diz o que o serviço GASTA. Nunca quanto aquele salão PAGOU.
 *
 * Medido em 2026-09-06: `apply_vertical_pack` (0002) semeia os produtos do catálogo já com
 * `avg_cost_cents` preenchido — no pack de cabelo (0057), tintura a R$ 22,00 o tubo — e logo
 * abaixo semeia a ficha de consumo que os liga aos serviços. Um salão criado hoje fechava a
 * primeira "Coloração" com R$ 24,60 de material sem ter comprado nada, e — o que dói — sem
 * ressalva na tela: `custoDoServico` só conta o produto com custo ZERO, e a ficha existia. O
 * número inventado passava vestido de número completo, que é o defeito que o `docs/48` §Fase 3
 * proíbe em todas as letras.
 *
 * A 0069 zerou o catálogo e o custo já semeado. Esta guarda existe para o pack seguinte.
 */

const DIR = 'supabase/migrations'

/** A partir da 0069, que é onde a regra passou a valer. As anteriores são história aplicada, e migration aplicada não se edita. */
const PRIMEIRA_SOB_A_REGRA = 69

/**
 * Casa com a SEMEADURA — `"avg_cost_cents":2200` dentro do JSON do pack — e com mais nada. O nome
 * da coluna sozinho aparece em comentário, em `jsonb_set(produto, '{avg_cost_cents}', '0')` e no
 * `where` da própria 0069: casar com ele acusaria o conserto de ser o defeito, que é a armadilha
 * de "guarda casa com o próprio comentário" já paga três vezes nesta base.
 */
/**
 * Função e não constante: `RegExp` com `/g` guarda `lastIndex` entre chamadas, e um `.test()`
 * depois do outro pula arquivo sim, arquivo não. Uma guarda que perde o segundo arquivo da lista é
 * a mesma classe de falso verde que ela existe para evitar.
 */
function semeaduras(sql: string): string[] {
  return sql.match(/"avg_cost_cents"\s*:\s*(?!0\s*[,}])\d+/g) ?? []
}


function numeroDa(nome: string): number {
  return Number(nome.slice(0, 4))
}

function migrations(): string[] {
  return readdirSync(DIR)
    .filter((nome) => nome.endsWith('.sql'))
    .sort()
}

describe('nenhum pack semeia o custo do produto', () => {
  /**
   * O controle positivo, e ele não é decoração. Uma guarda que varre N arquivos e não acha nada
   * passa igual quando o padrão quebrou e quando o código está limpo. A 0057 é o defeito original,
   * preservado em disco: se o detector deixar de acusá-la, ele está cego e o teste tem que gritar
   * — nunca passar em silêncio.
   */
  it('o detector acusa a 0057, que é o defeito original em disco', () => {
    const original = migrations().find((nome) => nome.startsWith('0057'))
    expect(original, 'a 0057 sumiu do disco — o controle positivo desta guarda depende dela').toBeDefined()

    const achados = semeaduras(semComentarios(readFileSync(`${DIR}/${original}`, 'utf8')))
    expect(achados.length, 'o detector parou de casar com a semeadura conhecida: a guarda está cega').toBeGreaterThanOrEqual(7)
  })

  it('o detector NÃO acusa a 0069, que é o conserto e cita a coluna o tempo todo', () => {
    const conserto = migrations().find((nome) => nome.startsWith('0069'))
    expect(conserto, 'a 0069 sumiu — é ela que zera o catálogo').toBeDefined()

    const sql = readFileSync(`${DIR}/${conserto}`, 'utf8')
    expect(sql, 'a 0069 precisa continuar zerando o custo já semeado').toMatch(/set\s+avg_cost_cents\s*=\s*0/)
    expect(semeaduras(semComentarios(sql)), 'o conserto está sendo lido como defeito').toEqual([])
  })

  /**
   * O cortador de comentário testado contra ele mesmo, nas duas quebras de linha. Sem este caso a
   * guarda volta a acusar prosa, e ninguém descobre até alguém escrever um comentário honesto
   * explicando o defeito — que é exatamente o que a 0069 faz, em vinte linhas.
   */
  it('prosa que cita a semeadura não é semeadura, em LF e em CRLF', () => {
    const prosa = '-- o pack semeava {"avg_cost_cents":2200} e a tela não avisava'
    expect(semeaduras(semComentarios(prosa)), 'comentário em LF acusado como código').toEqual([])
    expect(semeaduras(semComentarios(prosa + '\r\nselect 1;')), 'comentário em CRLF acusado como código').toEqual([])

    // E o controle na outra direção: fora de comentário, a MESMA string tem que ser acusada.
    const codigo = 'products = \'[{"avg_cost_cents":2200}]\'::jsonb'
    expect(semeaduras(semComentarios(codigo)), 'a guarda parou de ver o defeito').toHaveLength(1)
  })

  it('nenhuma migration a partir da 0069 semeia custo em pack', () => {
    const sobARegra = migrations().filter((nome) => numeroDa(nome) >= PRIMEIRA_SOB_A_REGRA)
    expect(sobARegra.length, 'a 0069 é o piso desta varredura e ela tem que estar aqui').toBeGreaterThan(0)

    const culpadas = sobARegra.filter((nome) => semeaduras(semComentarios(readFileSync(`${DIR}/${nome}`, 'utf8'))).length > 0)
    expect(
      culpadas,
      'pack não sabe quanto aquele salão paga no produto: semeie a QUANTIDADE da ficha e deixe avg_cost_cents em 0. Quem escreve o custo é a compra (services/estoque.ts).',
    ).toEqual([])
  })
})
