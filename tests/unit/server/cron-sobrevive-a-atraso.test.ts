import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { ROTAS_AGENDADAS } from '@/core/cron/agendadas'

/**
 * A MESMA falha derrubou o Motor de Ciclo três vezes, e cada conserto sobreviveu ao próprio
 * defeito porque atacava o sintoma. Este arquivo é a terceira tentativa, e ele guarda um
 * invariante diferente dos dois anteriores.
 *
 *   - **25/08** — a rota exigia hora local EXATA (`hora === 3`). O disparo pedido para 06:10 UTC
 *     aconteceu às 07:06 (56 min de atraso), virou 04:06 local, caiu fora. Zero tenants, HTTP 200,
 *     job verde (`docs/23` §2).
 *   - **26/08** — conserto: a igualdade virou uma JANELA de 3h (`TOLERANCIA_HORAS`), calibrada
 *     contra aquele atraso de 56 min. O teste desta época provava que a janela sobrevivia a 2h de
 *     atraso, e passava.
 *   - **30/08** — medido com `gh run list` na produção: o atraso real do `schedule` do GitHub
 *     nesta base é de **5 a 6,5 horas**. Os seis disparos nominais (05:10–10:10 UTC) aconteceram
 *     às 11:38, 12:39, 13:09, 13:48, 14:24 e 15:02. Todos os tenants são UTC-3 → hora local 8,6 a
 *     12,0, contra uma janela elegível de 3h–5h. **Zero sobreposição, seis disparos por dia, dois
 *     dias e meio seguidos.** A guarda de 26/08 estava verde o tempo todo: ela modelava 2h de
 *     atraso porque 2h era o dobro do único atraso já medido — e a realidade triplicou aquilo.
 *
 * **A lição que este arquivo codifica:** enquanto a rota puder ser dessincronizada pelo relógio do
 * agendador, existe um atraso que a derruba, e nenhum teste consegue adivinhar qual é. A saída não
 * é uma janela maior — é a rota **não depender da hora do disparo**. Para as rotas agendadas isso
 * é de graça, porque o filtro de hora nelas sempre foi economia de processamento e nunca
 * corretude: reprocessar o mesmo tenant no mesmo dia é upsert por PK (TICKET-036).
 *
 * Então o invariante guardado aqui é: **rota dentro do `schedule` não olha a hora local do
 * tenant.** Sem relógio na condição, não há atraso que a zere.
 */

/**
 * Rotas que disparam num horário de conveniência do tenant, e por isso PRECISAM continuar olhando
 * a hora local. Em `campaigns` o relógio não é economia — é não acordar cliente às 3 da manhã; em
 * `stock-alerts` é entregar o aviso quando o dono abre o salão, e não de madrugada.
 *
 * `reminders` fica fora desta lista de propósito: ela nunca olhou a hora do TENANT, e sim a hora
 * do AGENDAMENTO — é por isso que a receita comentada dela no `cron.yml` pode ser um curinga de
 * 15 em 15 minutos, sem hora fixa. Ver o caso equivalente em `cron-cobre-os-fusos.test.ts`.
 */
const ROTAS_COM_HORARIO_DE_CONVENIENCIA = ['campaigns', 'stock-alerts'] as const

function fonteDaRota(rota: string): string {
  return readFileSync(`src/app/api/cron/${rota}/route.ts`, 'utf8')
}

/**
 * Casa com a CHAMADA (`dentroDaJanela(`), nunca com o nome solto: o nome também aparece na linha
 * de `import`, e casar com ele daria um falso positivo eterno — é a armadilha nº 1 da tabela de
 * guarda cega do `CLAUDE.md`.
 */
function filtraPorHoraLocal(fonte: string): boolean {
  return /dentroDaJanela\s*\(/.test(fonte) || /horaLocalDe\s*\(/.test(fonte)
}

describe('a leitura deste teste', () => {
  it('enxerga o código das rotas — não passa por não ter lido nada', () => {
    for (const rota of [...ROTAS_AGENDADAS, ...ROTAS_COM_HORARIO_DE_CONVENIENCIA]) {
      expect(fonteDaRota(rota).length, `${rota}/route.ts veio vazio`).toBeGreaterThan(300)
    }
  })

  it('o detector reconhece uma chamada de filtro quando existe uma', () => {
    // Guarda contra o próprio detector: se o regex parar de casar, os testes abaixo passariam
    // vazios afirmando que ninguém filtra — que é exatamente o resultado que eles procuram.
    expect(filtraPorHoraLocal('if (!dentroDaJanela(horaLocalDe(tz, agora), 3)) continue')).toBe(true)
    expect(filtraPorHoraLocal("import { dentroDaJanela } from '@/core/cron/janela'")).toBe(false)
    expect(filtraPorHoraLocal('const x = 1')).toBe(false)
  })
})

describe('rota agendada não pode ser dessincronizada pelo atraso do agendador', () => {
  it.each(ROTAS_AGENDADAS)('%s não filtra por hora local do tenant', (rota) => {
    expect(
      filtraPorHoraLocal(fonteDaRota(rota)),
      `${rota} voltou a filtrar por hora local. Isso já custou o Motor de Ciclo três vezes: com ` +
        'igualdade exata (25/08, 56 min de atraso) e com janela de 3h (30/08, 5–6,5h de atraso). ' +
        'O `schedule` do GitHub é best-effort e o atraso medido nesta base é de horas, não de ' +
        'minutos — qualquer janela é refém dele, e a rota devolve 200 com zero processados, então ' +
        'a falha é SILENCIOSA. Nestas rotas o filtro de hora é economia de processamento, não ' +
        'corretude (upsert por PK, TICKET-036): processar todo tenant em todo disparo é a versão ' +
        'certa. Se o custo voltar a importar (~500 tenants), registre a última data local ' +
        'processada por tenant — não ressuscite o relógio do disparo.',
    ).toBe(false)
  })

  it.each(ROTAS_COM_HORARIO_DE_CONVENIENCIA)('%s CONTINUA filtrando por hora — ali o relógio é conveniência do tenant, não economia', (rota) => {
    expect(
      filtraPorHoraLocal(fonteDaRota(rota)),
      `${rota} parou de olhar a hora local do tenant — sem esse filtro ela entrega de madrugada. ` +
        'O motivo de tirar o filtro das rotas agendadas (elas só calculam e gravam no proprio ' +
        'banco) NAO vale aqui: nestas a hora e o proposito, nao economia.',
    ).toBe(true)
  })
})
