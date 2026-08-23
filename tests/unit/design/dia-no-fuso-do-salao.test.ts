import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { Temporal } from '@js-temporal/polyfill'
import { describe, expect, it } from 'vitest'

/**
 * `new Date().toISOString().slice(0, 10)` é "hoje em UTC", não hoje no salão.
 * Em Brasília (UTC-3) devolve o dia SEGUINTE das 21h à meia-noite — o dono
 * fechava às 21h30, abria `/admin/agenda` e via amanhã. Três horas erradas por
 * noite, todas as noites (`docs/15-AUDITORIA-DESIGN-UX.md` A8).
 *
 * O certo, e o que `/admin/caixa` já fazia, é
 * `Temporal.Now.instant().toZonedDateTimeISO(timezone).toPlainDate()` — depois
 * de saber o fuso do tenant, que é a regra 4 do CLAUDE.md.
 *
 * Cuidado ao ler o `grep`: `d.toISOString().slice(0, 10)` sobre uma data
 * construída com `Date.UTC(...)` a partir de um ISO **já resolvido pelo
 * servidor** é correto e proposital — é só aritmética de calendário
 * (`agenda.tsx`, `caixa.tsx`, `agendar.tsx` fazem assim). O que este teste
 * proíbe é derivar o dia de **agora**.
 */

/**
 * Dívida conhecida, fora do escopo da auditoria de design: as duas abaixo
 * escrevem dado (início de assinatura, validade de orçamento), não são default
 * de apresentação. Ficam registradas aqui em vez de num TODO solto para que a
 * auditoria técnica as encontre — e para que a lista só possa encolher:
 * arquivo novo com o mesmo defeito reprova o build.
 *
 * Fora de `src/app` há mais um caso, mais caro, que este teste não alcança:
 * `src/server/services/agendamentos.ts` passa o dia em UTC para o recálculo do
 * Motor de Ciclo tendo o `timezone` do tenant na linha de cima.
 */
const DIVIDA_CONHECIDA = [
  join('src', 'app', 'admin', 'clientes', '[id]', 'fidelidade.tsx'),
  join('src', 'app', 'admin', 'orcamentos', 'novo', 'formulario.tsx'),
]

/**
 * Toda construção `new Date(<arg>).toISOString().slice(0, 10)`, com `<arg>`
 * capturado. Equilibrar parênteses em expressão regular não vale a pena — um
 * nível de aninhamento cobre `Date.now() + Number(x) * 86_400_000`, que é o
 * caso real, e o que decide é o predicado abaixo, não o formato.
 */
const CONSTRUCAO = /new Date\(((?:[^()]|\([^()]*\))*)\)\.toISOString\(\)\.slice\(\s*0\s*,\s*10\s*\)/g

/**
 * Deriva de "agora" quando não recebe argumento nenhum ou parte de `Date.now()`.
 * `new Date(Date.UTC(...))` sobre um ISO já resolvido é o padrão correto e não
 * entra aqui.
 */
function derivaDeAgora(arg: string): boolean {
  return arg.trim() === '' || /\bDate\.now\(\)/.test(arg)
}

/**
 * Comentário citando o padrão errado não é o padrão errado. Sem isto, o próprio
 * comentário que explica a correção em `agenda/page.tsx` reprovaria o teste —
 * e guarda que tropeça na documentação faz as pessoas apagarem a documentação.
 */
function semComentarios(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')
}

function arquivos(dir: string): string[] {
  const achados: string[] = []
  for (const entrada of readdirSync(dir, { withFileTypes: true })) {
    const caminho = join(dir, entrada.name)
    if (entrada.isDirectory()) achados.push(...arquivos(caminho))
    else if (/\.tsx?$/.test(entrada.name)) achados.push(caminho)
  }
  return achados
}

function infrator(arquivo: string): boolean {
  const src = semComentarios(readFileSync(arquivo, 'utf8'))
  return [...src.matchAll(CONSTRUCAO)].some((m) => derivaDeAgora(m[1] ?? ''))
}

describe('o dia padrão vem do fuso do salão, não de UTC', () => {
  it('a diferença é real: 21h30 em São Paulo já é o dia seguinte em UTC', () => {
    const noSalao = Temporal.ZonedDateTime.from({
      year: 2026,
      month: 8,
      day: 21,
      hour: 21,
      minute: 30,
      timeZone: 'America/Sao_Paulo',
    })
    const emUtc = new Date(noSalao.toInstant().epochMilliseconds).toISOString().slice(0, 10)

    expect(noSalao.toPlainDate().toString()).toBe('2026-08-21')
    expect(emUtc).toBe('2026-08-22')
  })

  it('nenhuma tela deriva o dia de agora em UTC', () => {
    const infratores = arquivos('src/app')
      .filter(infrator)
      .filter((a) => !DIVIDA_CONHECIDA.includes(a))

    expect(infratores, `derivam o dia de agora em UTC: ${infratores.join(', ')}`).toEqual([])
  })

  it('a dívida conhecida não cresceu nem sumiu sem aviso', () => {
    // Some da lista quando alguém consertar — e aí o teste avisa para tirar daqui.
    expect(DIVIDA_CONHECIDA.filter(infrator)).toEqual(DIVIDA_CONHECIDA)
  })
})
