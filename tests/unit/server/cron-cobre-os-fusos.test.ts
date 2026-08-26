import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { ROTAS_AGENDADAS } from '@/core/cron/agendadas'

/**
 * A costura entre o AGENDADOR e a ROTA, que quase se soltou em silêncio.
 *
 * As rotas de cron não processam "todos os tenants": cada uma age só no tenant cuja hora LOCAL
 * bate com a dela (`if (horaLocal !== 3) continue`). Esse desenho pressupunha um disparo a cada
 * 15 minutos — era o plano do cron do Vercel. Quando o agendamento passou para o GitHub Actions
 * (`docs/18-MONETIZACAO-PLANO.md` §L.5), virou UM disparo diário, e as duas metades deixaram de
 * conversar sem que nada apitasse:
 *
 *   - `recompute-cycles` (hora 3) às 06:10 UTC só alcançava UTC-3;
 *   - `segments` (hora 4) às 06:10 UTC só alcançaria UTC-2 — Fernando de Noronha;
 *   - e a rota devolve **200** com `tenantsProcessados: 0`, então o job fica **verde**.
 *
 * Medido em produção em 2026-08-24: disparo manual, os dois jobs verdes, zero tenants processados.
 * Um sistema que não faz nada e diz que está bem é pior que um que quebra.
 *
 * Este teste lê os dois arquivos de verdade — o YAML e o `.ts` de cada rota — em vez de uma lista
 * copiada. Mudar a hora dentro da rota, ou tirar uma linha do schedule, reprova aqui.
 */

/** Os quatro fusos do Brasil. O produto é brasileiro; nenhum deles tem offset quebrado. */
const FUSOS_BR: readonly { nome: string; offset: number }[] = [
  { nome: 'America/Noronha', offset: -2 },
  { nome: 'America/Sao_Paulo', offset: -3 },
  { nome: 'America/Manaus', offset: -4 },
  { nome: 'America/Rio_Branco', offset: -5 },
]

/*
 * `ROTAS_AGENDADAS` vem de `@/core/cron/agendadas` — a lista morava aqui em cópia, e desde que o
 * `/api/health` passou a depender dela (26/08) manter duas seria escolher qual das duas apodrece
 * primeiro. Lá ela é ancorada ao `cron.yml` nas duas direções.
 */

/** As horas UTC em que uma rota de hora local `alvo` precisa ser disparada para alcançar os quatro
 *  fusos — uma por fuso. A janela de 3h absorve o atraso a partir de cada uma delas. */
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

  it.each(ROTAS_AGENDADAS)('%s é alcançada em todos os quatro fusos', (rota) => {
    const agendadas = horasUtcDoSchedule()
    const local = horaLocalExigida(rota)

    const descobertos = horasUtcNecessarias(local).filter(({ utc }) => !agendadas.includes(utc))

    expect(
      descobertos.map((f) => f.nome),
      `${rota} exige hora local ${local}; o schedule (${agendadas.join(', ')} UTC) nunca chega nesses fusos — ` +
        `e a rota devolve 200 com zero processados, então isso falharia em silêncio`,
    ).toEqual([])
  })

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
