import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

/**
 * O que este arquivo guarda HOJE, depois de 30/08: duas coisas sobre o `cron.yml`, nenhuma delas
 * sobre as rotas agendadas.
 *
 *   1. **Nada que fale com cliente final entra no `schedule`.** `reminders` e `campaigns` mandam
 *      mensagem de verdade e só podem existir como `workflow_dispatch`, sob decisão humana a cada
 *      clique.
 *   2. **A receita comentada que liga `campaigns` já nasce certa.** Ela é a única instrução que o
 *      dono vai seguir para ligar a mensageria, e `campaigns` filtra por hora local — uma receita
 *      errada ligaria a campanha para zero tenants, com job verde.
 *
 * O que este arquivo guardava ANTES, e não guarda mais: que o schedule nominal encostasse na hora
 * local exigida por cada rota agendada. Essa premissa morreu em 30/08 junto com o filtro de hora
 * dessas rotas — o disparo real do GitHub atrasa de 5 a 6,5 horas nesta base, e nenhuma janela
 * sobrevive a isso. Quem guarda o invariante novo ("rota agendada não olha o relógio do disparo")
 * é `cron-sobrevive-a-atraso.test.ts`, com o histórico medido das três rodadas.
 */

/** Os quatro fusos do Brasil. O produto é brasileiro; nenhum deles tem offset quebrado. */
const FUSOS_BR: readonly { nome: string; offset: number }[] = [
  { nome: 'America/Noronha', offset: -2 },
  { nome: 'America/Sao_Paulo', offset: -3 },
  { nome: 'America/Manaus', offset: -4 },
  { nome: 'America/Rio_Branco', offset: -5 },
]

/** As horas UTC em que uma rota de hora local `alvo` precisa ser disparada para alcançar os quatro
 *  fusos — uma por fuso. Só `campaigns` ainda usa isto: é a única rota que resta filtrando por
 *  hora local e que tem receita de agendamento escrita para alguém seguir. */
function horasUtcNecessarias(alvo: number): { nome: string; utc: number }[] {
  return FUSOS_BR.map(({ nome, offset }) => ({ nome, utc: ((alvo - offset) % 24 + 24) % 24 }))
}

function horasUtcDoSchedule(): number[] {
  const yml = readFileSync('.github/workflows/cron.yml', 'utf8')
  // Só o bloco `on:` até o primeiro `jobs:` — evita capturar cron citado em comentário lá embaixo.
  const bloco = yml.slice(0, yml.indexOf('\njobs:'))
  const horas = [...bloco.matchAll(/^\s*-\s*cron:\s*['"]\s*\d+\s+(\d+)\s/gm)].map((m) => Number(m[1]))
  return [...new Set(horas)].sort((a, b) => a - b)
}

/** A hora local que a rota toma como início da janela, lida do próprio código:
 *  `dentroDaJanela(horaLocalDe(...), N)`. Casa com a CHAMADA, nunca com o nome solto — o nome
 *  aparece também na linha de `import` (regra do `CLAUDE.md` sobre guarda cega). */
function horaLocalExigida(rota: string): number {
  const src = readFileSync(`src/app/api/cron/${rota}/route.ts`, 'utf8')
  const m = src.match(/dentroDaJanela\(.+,\s*(\d+)\)/)
  expect(m, `não achei a janela de hora em ${rota}/route.ts — o teste precisa ser atualizado junto`).not.toBeNull()
  return Number(m![1])
}

describe('o schedule do cron alcança a hora local de cada rota, em todo fuso do Brasil', () => {
  it('o schedule tem pelo menos um horário', () => {
    // Guarda contra o teste passar vazio se o regex parar de casar.
    expect(horasUtcDoSchedule().length).toBeGreaterThan(0)
  })

  /*
   * O caso "%s é alcançada em todos os quatro fusos" morava aqui e SAIU em 2026-08-30, junto com o
   * filtro de hora das rotas agendadas. Ele provava que o schedule NOMINAL encostava na janela de
   * cada rota — e estava verde no dia em que o Motor de Ciclo passou dois dias e meio processando
   * zero, porque o disparo REAL do GitHub atrasa de 5 a 6,5 horas nesta base.
   *
   * A premissa que ele testava não existe mais: rota agendada não olha a hora local (o porquê,
   * medido, está em `cron-sobrevive-a-atraso.test.ts`, que é quem guarda esse invariante agora).
   * Manter o caso aqui seria pior que removê-lo — `horaLocalExigida` não acharia mais a chamada,
   * e o teste ou explodiria ou passaria vazio afirmando cobertura que ninguém precisa.
   *
   * O bloco de `campaigns` no fim deste arquivo CONTINUA valendo: aquela rota mantém o filtro de
   * hora de propósito, e a receita comentada que a liga precisa nascer certa.
   */

  it('não agenda rota que fala com cliente final', () => {
    /*
     * `reminders` e `campaigns` mandam mensagem de verdade. O cabeçalho do `cron.yml` lista os
     * passos que precisam acontecer antes de ligar qualquer uma automaticamente — entre eles
     * confirmar credencial de WhatsApp e conferir tenant real. Enquanto isso não for feito, elas
     * só podem existir como `workflow_dispatch` (disparo manual, um de cada vez, sob decisão
     * humana explícita a cada clique) — nunca dentro de `schedule` (automático, sem ninguém
     * olhando). Por isso o teste isola só o bloco `schedule:`, não o `on:` inteiro: o segundo
     * também contém `workflow_dispatch`, onde as duas têm que aparecer (F0, ver
     * `docs/25-ESTRATEGIA-E-EXECUCAO.md`) para o disparo manual único do playbook ser possível.
     */
    const yml = readFileSync('.github/workflows/cron.yml', 'utf8')
    const inicioSchedule = yml.indexOf('\n  schedule:')
    const fimSchedule = yml.indexOf('\n  workflow_dispatch:')
    expect(inicioSchedule, 'não achei o bloco schedule: no cron.yml — o teste precisa ser atualizado junto').toBeGreaterThan(-1)
    expect(fimSchedule, 'não achei o bloco workflow_dispatch: no cron.yml — o teste precisa ser atualizado junto').toBeGreaterThan(inicioSchedule)

    const blocoSchedule = yml.slice(inicioSchedule, fimSchedule)
    for (const perigosa of ['reminders', 'campaigns']) {
      expect(
        blocoSchedule.includes(perigosa),
        `${perigosa} apareceu dentro de schedule: — ela manda mensagem para cliente final e não pode rodar sozinha`,
      ).toBe(false)
    }
  })
})

/**
 * O passo 4 do rodapé do `cron.yml` é a ÚNICA instrução que o dono do produto vai seguir para
 * ligar a mensageria: descomentar aquelas linhas. Até 26/08 a linha de `campaigns` era
 * `0 12 * * *` — e `campaigns` só age no tenant cuja hora local é 10, então 12:00 UTC alcançava
 * apenas UTC-2. Seguir a receita à risca teria ligado a campanha para ninguém, com HTTP 200 e job
 * verde: o mesmo silêncio de dois dias que a auditoria de ontem acabou de pagar para descobrir.
 *
 * Uma receita comentada não roda, então nada a testava. Este bloco testa.
 */
describe('a receita comentada do passo 4 já nasce certa', () => {
  const yml = readFileSync('.github/workflows/cron.yml', 'utf8')
  /** Só o rodapé, depois dos jobs — é onde as linhas comentadas moram. */
  const rodape = yml.slice(yml.indexOf('\njobs:'))

  function horasComentadasPara(rota: string): number[] {
    return [...rodape.matchAll(/^#\s*-\s*cron:\s*'(\S+)\s+(\S+)[^']*'\s*#\s*(\S+)/gm)]
      .filter((m) => m[3] === rota)
      .map((m) => Number(m[2]))
      .filter((h) => Number.isFinite(h))
  }

  it('as linhas de campaigns existem no rodapé — o teste não passa por não achar nada', () => {
    expect(horasComentadasPara('campaigns').length).toBeGreaterThan(0)
  })

  it('as horas sugeridas para campaigns alcançam os quatro fusos', () => {
    const sugeridas = horasComentadasPara('campaigns')
    const local = horaLocalExigida('campaigns')
    const descobertos = horasUtcNecessarias(local).filter(({ utc }) => !sugeridas.includes(utc))

    expect(
      descobertos.map((f) => f.nome),
      `a receita do passo 4 sugere ${sugeridas.join(', ')} UTC, e campaigns exige hora local ` +
        `${local}; esses fusos ficariam sem campanha nenhuma no dia em que alguém descomentar`,
    ).toEqual([])
  })

  it('reminders pode ser um `*/15` só porque NÃO filtra por hora local do tenant', () => {
    // Se um dia alguém puser janela por fuso em reminders, a linha `*/15` continua correta, mas
    // esta afirmação deixa de ser o motivo — e aí a receita precisa ser revista junto.
    const fonte = readFileSync('src/app/api/cron/reminders/route.ts', 'utf8')
    expect(fonte).not.toMatch(/dentroDaJanela|horaLocalDe/)
  })
})
