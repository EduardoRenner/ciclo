import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { ROTAS_AGENDADAS, ROTA_DO_HEARTBEAT } from '@/core/cron/agendadas'

/**
 * Em 26/08 o Motor de Ciclo passou DOIS dias sem processar tenant nenhum, com HTTP 200 e job
 * verde. O conserto foi dar heartbeat a ele e vigiá-lo em `/api/health`.
 *
 * O conserto olhou o job que tinha falhado — não a pergunta que o defeito fazia: **quais jobs
 * agendados ninguém observa?**. Cinco dias depois, em 31/08, `segments` continuava rodando SEIS
 * VEZES POR DIA sem heartbeat e sem checagem. Se começasse a falhar em todo disparo, `/api/health`
 * ficaria verde para sempre, porque a AUSÊNCIA de sinal era lida como "está tudo bem".
 *
 * Esta guarda existe para a pergunta, não para o caso: rota nova no `schedule` sem quem a observe
 * reprova aqui, antes de virar mais um silêncio de dois dias.
 */
const HEALTH = 'src/server/services/health.ts'

describe('todo cron agendado tem quem o observe', () => {
  const kindsPorRota = new Map<string, string[]>()
  for (const [kind, rota] of Object.entries(ROTA_DO_HEARTBEAT)) {
    kindsPorRota.set(rota, [...(kindsPorRota.get(rota) ?? []), kind])
  }

  it('há rotas agendadas para conferir — senão esta guarda passa vazia', () => {
    expect(ROTAS_AGENDADAS.length).toBeGreaterThan(0)
  })

  for (const rota of ROTAS_AGENDADAS) {
    it(`"${rota}" tem um kind de heartbeat`, () => {
      expect(
        kindsPorRota.get(rota),
        `a rota "${rota}" roda sozinha em produção e nenhum heartbeat aponta para ela — se parar, ninguém fica sabendo`,
      ).toBeDefined()
    })

    it(`"${rota}" grava o heartbeat de verdade na rota`, () => {
      // Não basta existir no mapa: a rota tem que CHAMAR `registrarHeartbeat`. Um mapa apontando
      // para uma rota que nunca escreve deixaria a saúde vermelha para sempre, que é o defeito
      // espelhado (e o que aconteceu com `send_reminders` em 26/08).
      const fonte = readFileSync(`src/app/api/cron/${rota}/route.ts`, 'utf8')
      const kind = kindsPorRota.get(rota)![0]!
      expect(
        fonte,
        `${rota}/route.ts não chama registrarHeartbeat(svc, '${kind}') — o mapa promete um sinal que a rota não emite`,
      ).toContain(`registrarHeartbeat(svc, '${kind}')`)
    })

    it(`"${rota}" é conferida em /api/health`, () => {
      const saude = readFileSync(HEALTH, 'utf8')
      const kind = kindsPorRota.get(rota)![0]!
      expect(
        saude,
        `nada em ${HEALTH} chama checarHeartbeat para "${kind}" — o sinal é gravado e ninguém lê`,
      ).toContain(`checarHeartbeat(db, '${kind}'`)
    })
  }
})
