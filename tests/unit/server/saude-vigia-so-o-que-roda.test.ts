import { readFileSync, readdirSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { rotaDeCronAgendada } from '../../helpers/cron'
import { bancoSaudavel } from '../../helpers/saude'

import { ROTAS_AGENDADAS, ROTAS_DE_CRON, ROTA_DO_HEARTBEAT, heartbeatVigiado, type RotaDeCron } from '@/core/cron/agendadas'
import { verificarSaude } from '@/server/services/health'

/**
 * O irmão de `motor-de-ciclo-observavel`, para o defeito oposto: o alarme que toca sempre.
 *
 * Medido na produção em 26/08/2026: `/api/health` devolvia **503** por `send_reminders` estar sem
 * execução havia 454 min — só que `reminders` está fora do `schedule` DE PROPÓSITO. O endpoint
 * ficaria vermelho todos os dias, para sempre, por uma decisão consciente do dono do produto. E um
 * alarme permanente é indistinguível de nenhum alarme: no dia em que o Motor de Ciclo parasse de
 * verdade, o 503 não mudaria de cor.
 *
 * `src/core/cron/agendadas.ts` é uma CÓPIA do que está no `.github/workflows/cron.yml` (o runtime
 * da Vercel não recebe `.github/`). Este arquivo é o que impede a cópia de apodrecer.
 */

const DIR_DAS_ROTAS = 'src/app/api/cron'

describe('a lista de rotas de cron espelha o disco', () => {
  it('ROTAS_DE_CRON é exatamente o que existe em src/app/api/cron', () => {
    const noDisco = readdirSync(DIR_DAS_ROTAS, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort()
    expect(noDisco.length, 'nenhuma rota de cron encontrada — o caminho mudou?').toBeGreaterThan(0)
    expect([...ROTAS_DE_CRON].sort()).toEqual(noDisco)
  })
})

describe('ROTAS_AGENDADAS espelha o cron.yml, nas duas direções', () => {
  it('não sobra: nada é declarado agendado sem estar no schedule do cron.yml', () => {
    const mentirosas = ROTAS_AGENDADAS.filter((rota) => !rotaDeCronAgendada(rota))
    expect(
      mentirosas,
      'estas rotas estão em ROTAS_AGENDADAS mas não no `on.schedule` + matriz do cron.yml — ' +
        'o /api/health vai cobrar execução de job que ninguém dispara, e o 503 vira permanente',
    ).toEqual([])
  })

  it('não falta: rota que passou a rodar sozinha entra na lista e volta a ser vigiada', () => {
    const esquecidas = ROTAS_DE_CRON.filter((rota) => rotaDeCronAgendada(rota) && !ROTAS_AGENDADAS.includes(rota))
    expect(
      esquecidas,
      'estas rotas estão no schedule do cron.yml e fora de ROTAS_AGENDADAS — o /api/health ' +
        'deixaria de vigiar um job que agora roda sozinho, que é silêncio de novo (docs/24 §6.6)',
    ).toEqual([])
  })

  it('a lista não está vazia — o Motor de Ciclo tem que rodar sozinho', () => {
    // Sem isto, esvaziar ROTAS_AGENDADAS faria os dois casos acima passarem por vacuidade.
    expect(ROTAS_AGENDADAS).toContain('recompute-cycles')
  })
})

describe('o mapa kind → rota bate com quem grava o heartbeat', () => {
  const entradas = Object.entries(ROTA_DO_HEARTBEAT) as [string, RotaDeCron][]

  it('o mapa de heartbeats não está vazio — `it.each([])` some em vez de reprovar', () => {
    /*
     * Achado varrendo a suíte em 2026-09-09: esta era a ÚNICA lista derivada usada em `it.each`
     * sem nenhuma asserção sobre ela. Se `ROTA_DO_HEARTBEAT` esvaziar, o `it.each` não gera caso
     * nenhum — a guarda não falha, ela DESAPARECE, e `250 passed` continua parecendo saúde.
     *
     * Dói mais aqui do que em qualquer outro lugar: é a guarda de que o vigia de saúde observa os
     * crons que de fato rodam, num produto que já ficou 54h com o Motor de Ciclo parado sem
     * ninguém ver.
     */
    expect(entradas.length, 'ROTA_DO_HEARTBEAT ficou vazio — o vigia deixaria de vigiar sem reprovar nada').toBeGreaterThan(0)
    expect(entradas.map(([kind]) => kind), 'o Motor de Ciclo saiu do mapa de heartbeats').toContain('recompute_cycles')
  })

  it.each(entradas)('o kind %s é gravado dentro de src/app/api/cron/%s', (kind, rota) => {
    const fonte = readFileSync(`${DIR_DAS_ROTAS}/${rota}/route.ts`, 'utf8')
    expect(fonte.length, `route.ts de ${rota} veio vazio`).toBeGreaterThan(200)
    const gravado = fonte
      .split('registrarHeartbeat(')
      .slice(1)
      .some((depois) => depois.slice(0, 60).includes(`'${kind}'`))
    expect(
      gravado,
      `${rota}/route.ts não grava o heartbeat '${kind}' — o mapa de agendadas.ts está desatualizado, ` +
        'e um kind órfão nunca mais é vigiado nem desvigiado corretamente',
    ).toBe(true)
  })
})

describe('o /api/health não fica vermelho por job desligado de propósito', () => {
  it('reminders parado há 8h não derruba a saúde — 454 min era o número real da produção', async () => {
    const r = await verificarSaude(bancoSaudavel({ send_reminders: 8 * 60 }), new Date())
    expect(r.checks.sendReminders.ok, 'job fora do schedule derrubou o /api/health').toBe(true)
    expect(r.checks.sendReminders.detail, 'o endpoint precisa DIZER por que não vigia — a regra da casa é ler o corpo, não a cor').toMatch(/não está no schedule/)
    expect(r.ok).toBe(true)
  })

  it('e nem quando nunca rodou — que é o estado de um job que nunca foi ligado', async () => {
    const r = await verificarSaude(bancoSaudavel({ send_reminders: null, send_campaigns: null }), new Date())
    expect(r.checks.sendReminders.ok).toBe(true)
    expect(r.checks.sendCampaigns.ok).toBe(true)
    expect(r.ok).toBe(true)
  })

  it('mas o que ESTÁ agendado continua sendo cobrado — a vigilância não foi afrouxada', async () => {
    const r = await verificarSaude(bancoSaudavel({ recompute_cycles: 27 * 60 }), new Date())
    expect(r.checks.recomputeCycles.ok, 'a dispensa vazou para um job agendado').toBe(false)
    expect(r.ok).toBe(false)
  })

  it('kind desconhecido é vigiado — o padrão é alarmar, não dispensar', () => {
    expect(heartbeatVigiado('um_job_que_ninguem_mapeou')).toBe(true)
  })
})
