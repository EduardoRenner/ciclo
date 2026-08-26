import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

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

/** As rotas agendadas por `schedule`. `reminders` e `campaigns` estão fora de propósito — elas
 *  falam com cliente final, e o cabeçalho do `cron.yml` explica por que não entram sozinhas. */
const ROTAS_AGENDADAS = ['recompute-cycles', 'segments'] as const

function horasUtcDoSchedule(): number[] {
  const yml = readFileSync('.github/workflows/cron.yml', 'utf8')
  // Só o bloco `on:` até o primeiro `jobs:` — evita capturar cron citado em comentário lá embaixo.
  const bloco = yml.slice(0, yml.indexOf('\njobs:'))
  const horas = [...bloco.matchAll(/^\s*-\s*cron:\s*['"]\s*\d+\s+(\d+)\s/gm)].map((m) => Number(m[1]))
  return [...new Set(horas)].sort((a, b) => a - b)
}

/** A hora local que a rota exige, lida do próprio código: `if (horaLocal !== N) continue`. */
function horaLocalExigida(rota: string): number {
  const src = readFileSync(`src/app/api/cron/${rota}/route.ts`, 'utf8')
  const m = src.match(/horaLocal\s*!==\s*(\d+)/)
  expect(m, `não achei o filtro de hora em ${rota}/route.ts — o teste precisa ser atualizado junto`).not.toBeNull()
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

    const descobertos = FUSOS_BR.filter(({ offset }) => {
      const utcNecessaria = ((local - offset) % 24 + 24) % 24
      return !agendadas.includes(utcNecessaria)
    })

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
