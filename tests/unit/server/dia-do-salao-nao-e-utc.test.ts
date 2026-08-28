import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * O dia do salão não é o dia em UTC — e esta base já pagou três vezes para aprender isso.
 *
 * O `caixa.ts` documenta a regra desde o TICKET-047 e a cumpre com `Temporal` no fuso do tenant.
 * A auditoria de 2026-08-28 encontrou a MESMA conta escrita à mão em outros dois lugares, e um
 * deles é dinheiro que vira pagamento:
 *
 * | Onde | O que acontecia |
 * |---|---|
 * | `comissao.ts` | comanda fechada depois das 21h em Brasília saía do mês trabalhado e reaparecia no seguinte — e o extrato aparece na MESMA TELA que o caixa, que contava certo |
 * | `atribuicao.ts` | "o CICLO trouxe R$ X este mês" contava um mês em UTC, ao lado de um caixa que conta o mês do salão |
 *
 * As duas formas do defeito são reconhecíveis por texto, e é isso que esta guarda pega:
 *
 * 1. **`${dia}T00:00:00Z`** — concatenar a data com um instante fixo em UTC;
 * 2. **`${dia}T23:59:59`** — "fim do dia" por aproximação, que ainda deixa a fresta dos
 *    milissegundos sem dono nenhum. O certo é o intervalo semiaberto `[início, fim)`, com `fim`
 *    na meia-noite do dia SEGUINTE.
 *
 * A guarda casa com o TEXTO do instante literal, não com o nome de uma função — quem reescrever a
 * conta de outro jeito continua tendo que passar por `Temporal` e pelo fuso do tenant, e quem
 * colar a string de volta reprova aqui.
 */

const RAIZES = ['src/server', 'src/app']

/**
 * Dívida conhecida, e ela só encolhe. `alertas-estoque.ts` usa uma janela CORRIDA de 30 dias para
 * tirar uma média diária (soma dividida por 30 fixo): três horas a mais ou a menos numa janela de
 * 720 não mudam a decisão de "está na hora de repor", e o número não vira pagamento de ninguém.
 * Fica registrado como decisão, não como esquecimento.
 */
const DIVIDA_CONHECIDA: readonly string[] = ['src/server/services/alertas-estoque.ts']

const INSTANTE_UTC_LITERAL = /T00:00:00Z|T23:59:59/

function arquivos(dir: string): string[] {
  const achados: string[] = []
  for (const entrada of readdirSync(dir, { withFileTypes: true })) {
    const caminho = join(dir, entrada.name)
    if (entrada.isDirectory()) achados.push(...arquivos(caminho))
    else if (/[.]tsx?$/.test(entrada.name)) achados.push(caminho)
  }
  return achados
}

function semComentarios(caminho: string): string {
  return readFileSync(caminho, 'utf8')
    .replace(/[{][/][*][\s\S]*?[*][/][}]/g, ' ')
    .replace(/[/][*][\s\S]*?[*][/]/g, ' ')
    .replace(/^\s*[/][/].*$/gm, ' ')
}

const TODOS = RAIZES.flatMap(arquivos).map((f) => f.split(String.fromCharCode(92)).join('/'))
const CULPADOS = TODOS.filter((f) => INSTANTE_UTC_LITERAL.test(semComentarios(f)))

describe('o dia do salão nunca é montado em UTC', () => {
  it('o leitor enxerga o servidor e as telas', () => {
    expect(TODOS.length, 'nenhum arquivo lido').toBeGreaterThan(80)
    expect(TODOS, 'o caixa sumiu do caminho varrido — a guarda precisa ser revista junto').toContain('src/server/services/caixa.ts')
  })

  it('o detector reconhece as duas formas do defeito', () => {
    // Guarda contra o próprio detector: se o padrão parar de casar, a lista de culpados vem vazia
    // e a guarda passa por não ter olhado nada.
    expect(INSTANTE_UTC_LITERAL.test('gte(`${desde}T00:00:00Z`)')).toBe(true)
    expect(INSTANTE_UTC_LITERAL.test('lte(`${ate}T23:59:59Z`)')).toBe(true)
    expect(INSTANTE_UTC_LITERAL.test("toZonedDateTime({ timeZone: timezone, plainTime: '00:00' })")).toBe(false)
  })

  it('nenhum arquivo NOVO monta o dia com instante fixo em UTC', () => {
    const novos = CULPADOS.filter((f) => !DIVIDA_CONHECIDA.includes(f))
    expect(
      novos,
      'estes arquivos montam o limite de um período concatenando a data com um instante em UTC. ' +
        'Em Brasília isso desloca o dia em três horas: o que acontece depois das 21h cai no dia ' +
        'seguinte. Use `Temporal.PlainDate.from(dia).toZonedDateTime({ timeZone: timezone, ' +
        "plainTime: '00:00' }).toInstant()`, e feche o intervalo na meia-noite do dia SEGUINTE " +
        '(semiaberto), como `caixa.ts` faz desde o TICKET-047.',
    ).toEqual([])
  })

  it('a dívida conhecida só encolhe — arquivo consertado sai da lista', () => {
    const jaConsertados = DIVIDA_CONHECIDA.filter((f) => !CULPADOS.includes(f))
    expect(
      jaConsertados,
      'estes arquivos não têm mais o defeito e continuam na lista. Remova-os: lista de dívida que ' +
        'não encolhe vira decoração e para de significar alguma coisa.',
    ).toEqual([])
  })

  it('quem já conta certo continua contando — o caixa e os dois consertos desta rodada', () => {
    // O outro lado da regra: "ninguém usa string de data" passaria com as três funções quebradas
    // de outro jeito. Aqui a exigência é positiva.
    for (const arquivo of ['src/server/services/caixa.ts', 'src/server/services/comissao.ts', 'src/server/services/atribuicao.ts']) {
      const src = semComentarios(arquivo)
      expect(src, `${arquivo} não converte mais o dia pelo fuso do tenant`).toMatch(/timeZone: timezone/)
    }
  })
})
