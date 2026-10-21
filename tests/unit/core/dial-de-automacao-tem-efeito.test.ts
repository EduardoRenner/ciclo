import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { fazSozinha } from '@/core/automacoes/config'

import { semComentarios } from '../../helpers/fonte'

/**
 * docs/112 EXP-A01 (achado D1 do `05-avisos.md`): a tela Automações gravava o nível em
 * `settings.automacoes` e só a própria tela lia. Lembrete e campanha mandariam no nível
 * "Só me avisa" no dia em que a rota fosse agendada.
 */
describe('o dial de automação tem efeito', () => {
  it('padrão de fábrica: nada age sozinho', () => {
    expect(fazSozinha({}, 'lembrete_de_agendamento')).toBe(false)
    expect(fazSozinha(null, 'lembrete_de_agendamento')).toBe(false)
  })

  it('lembrete no nível 3 age sozinho; no 1 e no 2, não', () => {
    expect(fazSozinha({ automacoes: { lembrete_de_agendamento: 3 } }, 'lembrete_de_agendamento')).toBe(true)
    expect(fazSozinha({ automacoes: { lembrete_de_agendamento: 2 } }, 'lembrete_de_agendamento')).toBe(false)
    expect(fazSozinha({ automacoes: { lembrete_de_agendamento: 1 } }, 'lembrete_de_agendamento')).toBe(false)
  })

  it('campanha nunca age sozinha: o teto dela é 2, e um 3 gravado é cortado', () => {
    expect(fazSozinha({ automacoes: { campanha_de_recuperacao: 3 } }, 'campanha_de_recuperacao')).toBe(false)
  })

  it('quem manda mensagem sozinho pergunta ao dial antes', () => {
    const lembretes = semComentarios(readFileSync('src/server/services/lembretes.ts', 'utf8'))
    expect(lembretes, 'o lembrete parou de ler o dial').toMatch(/fazSozinha\(linha\.tenants\.settings, 'lembrete_de_agendamento'\)/)
    const campanhas = semComentarios(readFileSync('src/app/api/cron/campaigns/route.ts', 'utf8'))
    expect(campanhas, 'a campanha parou de ler o dial').toMatch(/fazSozinha\(tenant\.settings, 'campanha_de_recuperacao'\)/)
  })
})
