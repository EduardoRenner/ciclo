import { readdirSync, readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { ROTAS_AGENDADAS, ROTAS_DE_CRON } from '@/core/cron/agendadas'

/**
 * APR-027a (achados C-06, G-11, G-12): `expirar-graca` existia, a tela de plano prometia a queda para
 * o Grátis, e a rota não tinha gatilho nenhum — nem horário no `cron.yml`, nem botão no
 * `workflow_dispatch`. Rota de cron sem gatilho é uma promessa que ninguém cumpre.
 *
 * Toda rota de `src/app/api/cron` precisa de um destes: horário (`ROTAS_AGENDADAS`, conferido contra
 * o `cron.yml` por outra guarda), botão no `workflow_dispatch`, ou estar aqui com o MOTIVO de não ter
 * — e o ticket que dá o gatilho. A lista é para encolher.
 */
const SEM_GATILHO: Record<string, string> = {
  'expirar-graca':
    'a queda para o Grátis tem que valer sem depender de cron (APR-027b, lê a graça na hora); até lá, o ' +
    'Mercado Pago não está ligado e não há plano em graça para expirar',
  'legal-intimacoes': 'pacote Advocacia ainda sem cliente pagante; agendar junto do primeiro escritório (APR-617)',
  'lgpd-retention': 'retenção LGPD sem base antiga para limpar ainda; agendar antes de completar 1 ano de dado (APR-617)',
}

function noBotaoDoWorkflow(): Set<string> {
  const yml = readFileSync('.github/workflows/cron.yml', 'utf8')
  const bloco = yml.match(/workflow_dispatch:[\s\S]*?options:\s*\n((?:\s*-\s*[\w-]+\s*\n)+)/)
  return new Set((bloco?.[1] ?? '').split('\n').map((l) => l.replace(/^\s*-\s*/, '').trim()).filter(Boolean))
}

const PASTAS = readdirSync('src/app/api/cron', { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)

describe('todo cron tem gatilho ou motivo (APR-027a)', () => {
  it('controle positivo: o leitor do workflow acha os botões conhecidos', () => {
    const botoes = noBotaoDoWorkflow()
    expect(botoes.has('recompute-cycles')).toBe(true)
    expect(botoes.has('reminders')).toBe(true)
  })

  it('a lista de rotas de cron é a das pastas', () => {
    expect([...ROTAS_DE_CRON].sort()).toEqual([...PASTAS].sort())
  })

  it('toda rota de cron tem horário, botão ou motivo escrito', () => {
    const botoes = noBotaoDoWorkflow()
    const semNada = PASTAS.filter((r) => !ROTAS_AGENDADAS.includes(r as never) && !botoes.has(r) && !(r in SEM_GATILHO))
    expect(semNada).toEqual([])
  })

  it('a lista sem gatilho não guarda quem já ganhou gatilho, e todo motivo é escrito', () => {
    const botoes = noBotaoDoWorkflow()
    for (const [rota, motivo] of Object.entries(SEM_GATILHO)) {
      expect(PASTAS, `${rota} não existe mais`).toContain(rota)
      expect(ROTAS_AGENDADAS.includes(rota as never) || botoes.has(rota), `${rota} já tem gatilho: tire da lista`).toBe(false)
      expect(motivo.length, rota).toBeGreaterThan(40)
    }
  })
})
