import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { TOLERANCIA_HORAS, dentroDaJanela } from '@/core/cron/janela'

/**
 * O irmão de `cron-cobre-os-fusos.test.ts`, e a razão de ele não ter bastado.
 *
 * Aquele teste prova que o schedule NOMINAL alcança a hora local de cada rota nos quatro fusos.
 * Ele estava verde em 2026-08-25, e naquele mesmo dia o Motor de Ciclo processou zero tenants:
 * o disparo pedido para 06:10 UTC aconteceu às 07:06 — 56 minutos de atraso — e a rota exigia
 * hora local exatamente 3. Job verde, `tenantsProcessados: 0`, ninguém avisado (`docs/23` §2).
 *
 * Ou seja: a guarda antiga provava a ARITMÉTICA do agendamento, não a ENTREGA. `schedule` do
 * GitHub Actions é best-effort — atrasa sob carga e pode pular execução — e isso não estava
 * modelado em lugar nenhum.
 *
 * Este teste modela o atraso. Ele reprova se alguém estreitar a janela de volta para uma
 * igualdade, ou mexer no schedule de um jeito que deixe algum fuso na mão sob atraso plausível.
 */

const FUSOS_BR: readonly { nome: string; offset: number }[] = [
  { nome: 'America/Noronha', offset: -2 },
  { nome: 'America/Sao_Paulo', offset: -3 },
  { nome: 'America/Manaus', offset: -4 },
  { nome: 'America/Rio_Branco', offset: -5 },
]

const ROTAS_AGENDADAS = ['recompute-cycles', 'segments'] as const

/**
 * Atraso, em horas, que o agendamento tem que tolerar sem deixar nenhum fuso sem processamento.
 *
 * Duas horas é mais que o dobro do único atraso já medido nesta base (56 min, em 25/08). Não é
 * um número tirado do ar nem uma promessa do GitHub — é a margem que este projeto escolheu
 * bancar, e o teste existe para que ela não se perca numa mudança futura de schedule.
 */
const ATRASO_TOLERADO_HORAS = 2

/**
 * Quantos disparos elegíveis cada tenant precisa ter, sem atraso nenhum, para que UMA execução
 * pulada pelo GitHub não zere o dia dele.
 */
const DISPAROS_ELEGIVEIS_MINIMOS = 2

function horasUtcDoSchedule(): number[] {
  const yml = readFileSync('.github/workflows/cron.yml', 'utf8')
  const bloco = yml.slice(0, yml.indexOf('\njobs:'))
  const horas = [...bloco.matchAll(/^\s*-\s*cron:\s*['"]\s*\d+\s+(\d+)\s/gm)].map((m) => Number(m[1]))
  return [...new Set(horas)].sort((a, b) => a - b)
}

/** Lida do código da rota, não de uma lista copiada — se a rota mudar de alvo, este teste muda junto. */
function alvoDaRota(rota: string): number {
  const src = readFileSync(`src/app/api/cron/${rota}/route.ts`, 'utf8')
  const m = src.match(/dentroDaJanela\(.+,\s*(\d+)\)/)
  expect(m, `não achei a janela de hora em ${rota}/route.ts — o teste precisa ser atualizado junto`).not.toBeNull()
  return Number(m![1])
}

/** As horas LOCAIS em que aquele fuso é visitado, dado o schedule e um atraso uniforme. */
function horasLocaisVisitadas(offset: number, atrasoHoras: number): number[] {
  return horasUtcDoSchedule().map((utc) => ((utc + atrasoHoras + offset) % 24 + 24) % 24)
}

function disparosElegiveis(offset: number, alvo: number, atrasoHoras: number): number {
  return horasLocaisVisitadas(offset, atrasoHoras).filter((local) => dentroDaJanela(local, alvo)).length
}

describe('o agendamento entrega mesmo quando o GitHub atrasa', () => {
  it('o schedule tem pelo menos um horário', () => {
    // Guarda contra este arquivo inteiro passar vazio se o regex do YAML parar de casar.
    expect(horasUtcDoSchedule().length).toBeGreaterThan(0)
  })

  it('a janela é maior que uma hora — igualdade exata é o defeito que este teste existe para pegar', () => {
    expect(
      TOLERANCIA_HORAS,
      'com tolerância 1 a janela vira a igualdade exata que fez o Motor de Ciclo processar zero em 25/08',
    ).toBeGreaterThan(1)
  })

  it.each(ROTAS_AGENDADAS)('%s alcança todo fuso do Brasil mesmo com atraso', (rota) => {
    const alvo = alvoDaRota(rota)

    const descobertos: string[] = []
    for (const { nome, offset } of FUSOS_BR) {
      for (let atraso = 0; atraso <= ATRASO_TOLERADO_HORAS; atraso++) {
        if (disparosElegiveis(offset, alvo, atraso) === 0) descobertos.push(`${nome} com ${atraso}h de atraso`)
      }
    }

    expect(
      descobertos,
      `${rota} (alvo ${alvo}h local, janela de ${TOLERANCIA_HORAS}h) fica sem nenhum disparo elegível nesses casos — ` +
        'e a rota devolve 200 com zero processados, então isso falharia em silêncio',
    ).toEqual([])
  })

  it.each(ROTAS_AGENDADAS)('%s tem disparo sobrando, para o caso de o GitHub pular um', (rota) => {
    const alvo = alvoDaRota(rota)

    const semFolga = FUSOS_BR.filter(({ offset }) => disparosElegiveis(offset, alvo, 0) < DISPAROS_ELEGIVEIS_MINIMOS)

    expect(
      semFolga.map((f) => f.nome),
      `${rota} tem menos de ${DISPAROS_ELEGIVEIS_MINIMOS} disparos elegíveis nesses fusos: uma execução pulada ` +
        'pelo GitHub já custaria o dia inteiro',
    ).toEqual([])
  })
})

describe('nenhuma rota agendada volta para a igualdade exata', () => {
  /**
   * A lista acima é escrita à mão. Se alguém agendar uma rota nova e não vier aqui, os testes de
   * cima passariam sem nunca olhar para ela — verde vazio, o defeito que o `CLAUDE.md` nomeia.
   * Este caso lê a matriz do YAML e obriga as duas listas a concordarem.
   */
  function rotasNaMatrizDoYml(): string[] {
    const yml = readFileSync('.github/workflows/cron.yml', 'utf8')
    const m = yml.match(/^\s*rota:\s*\[([^\]]+)\]/m)
    expect(m, 'não achei a matriz `rota: [...]` no cron.yml — o teste precisa ser atualizado junto').not.toBeNull()
    return m![1].split(',').map((s) => s.trim()).sort()
  }

  it('a lista deste teste é a mesma que o cron.yml agenda', () => {
    expect(rotasNaMatrizDoYml()).toEqual([...ROTAS_AGENDADAS].sort())
  })

  it.each(ROTAS_AGENDADAS)('%s não filtra hora por igualdade', (rota) => {
    const src = readFileSync(`src/app/api/cron/${rota}/route.ts`, 'utf8')
    expect(
      /horaLocal\s*!==/.test(src),
      `${rota} voltou a comparar hora local por igualdade — é exatamente o que fez o Motor de Ciclo ` +
        'processar zero tenants em 25/08, com o job verde',
    ).toBe(false)
  })
})

describe('a janela em si', () => {
  it('aceita o alvo e as horas seguintes, e recusa a anterior', () => {
    expect(dentroDaJanela(3, 3)).toBe(true)
    expect(dentroDaJanela(4, 3)).toBe(true)
    expect(dentroDaJanela(2, 3)).toBe(false)
    expect(dentroDaJanela(3 + TOLERANCIA_HORAS, 3)).toBe(false)
  })

  it('atravessa a meia-noite sem virar do avesso', () => {
    // Nenhuma rota usa alvo 23 hoje. A alternativa é uma conta que funciona por acidente até
    // alguém mudar um número — e aí falha de madrugada, em silêncio, que é o tema deste arquivo.
    expect(dentroDaJanela(23, 23, 3)).toBe(true)
    expect(dentroDaJanela(0, 23, 3)).toBe(true)
    expect(dentroDaJanela(1, 23, 3)).toBe(true)
    expect(dentroDaJanela(2, 23, 3)).toBe(false)
    expect(dentroDaJanela(22, 23, 3)).toBe(false)
  })
})
