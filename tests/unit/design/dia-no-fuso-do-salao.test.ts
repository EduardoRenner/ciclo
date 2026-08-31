import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { Temporal } from '@js-temporal/polyfill'
import { describe, expect, it } from 'vitest'

import { semComentarios as semComentariosDe } from '../../helpers/fonte'

import { computeCycle } from '@/core/cycle/compute'

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
 * Dívida conhecida — os dois casos que sobraram, cada um por um motivo que está escrito, não por
 * esquecimento. A lista só pode encolher: arquivo novo com o mesmo defeito reprova o build.
 *
 * 1. `fidelidade.tsx` monta o `startedOn` do estado otimista em UTC — e está **certo assim**.
 *    Quem grava a coluna é o banco, com `started_on date not null default current_date`
 *    (migration 0019), e o `current_date` do Postgres roda no fuso da sessão, que no Supabase é
 *    UTC. Corrigir só o cliente faria a tela discordar do dado guardado. A raiz é o default da
 *    coluna, e mexer nela é migration — assunto da auditoria técnica.
 *
 * 2. `orcamentos/novo/formulario.tsx` gera a validade como "agora + N dias" em UTC. Das 21h à
 *    meia-noite isso dá um dia a mais — mas a favor de quem recebe o orçamento, e o servidor já
 *    interpreta o vencimento no fuso do salão (`orcamentoExpirado(valid_until, timezone)`).
 *    Impacto real: orçamento aberto um dia a mais, três horas por noite. Não paga o risco.
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
  const src = semComentariosDe(readFileSync(arquivo, 'utf8'))
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

  it('nenhuma tela nem serviço deriva o dia de agora em UTC', () => {
    // `src/server` entrou depois de o Motor de Ciclo ser corrigido: era lá que estava o caso
    // mais caro, e sem varrer a pasta o guarda não impediria o próximo.
    const infratores = [...arquivos('src/app'), ...arquivos('src/server')]
      .filter(infrator)
      .filter((a) => !DIVIDA_CONHECIDA.includes(a))

    expect(infratores, `derivam o dia de agora em UTC: ${infratores.join(', ')}`).toEqual([])
  })

  /**
   * Não basta afirmar que o padrão sumiu; este teste fixa **por que ele importava**. O Motor de
   * Ciclo recebia o dia em UTC enquanto o histórico já vinha no fuso do salão — `computeCycle`
   * comparava as duas coisas em fusos diferentes (`docs/15` A17).
   */
  it('um dia de deriva vira o estado do cliente de "está na hora" para "atrasado"', () => {
    const d = (iso: string) => Temporal.PlainDate.from(iso)
    // Ciclo pessoal de 30 dias, última visita em 22/07 → previsto para 21/08.
    const history = [d('2026-05-23'), d('2026-06-22'), d('2026-07-22')].map((date) => ({ date }))

    const noSalao = computeCycle({ history, defaultCycleDays: 30, today: d('2026-08-21') })
    const comDeriva = computeCycle({ history, defaultCycleDays: 30, today: d('2026-08-22') })

    // Quem chega exatamente no dia previsto está em dia.
    expect(noSalao.lateDays).toBe(0)
    expect(noSalao.state).toBe('due')

    // Um dia a mais e a mesma pessoa é marcada como atrasada — e `late` é o que a coloca na
    // lista de "Recuperar receita".
    expect(comDeriva.lateDays).toBe(1)
    expect(comDeriva.state).toBe('late')
  })

  it('a dívida conhecida não cresceu nem sumiu sem aviso', () => {
    // Some da lista quando alguém consertar — e aí o teste avisa para tirar daqui.
    expect(DIVIDA_CONHECIDA.filter(infrator)).toEqual(DIVIDA_CONHECIDA)
  })
})
