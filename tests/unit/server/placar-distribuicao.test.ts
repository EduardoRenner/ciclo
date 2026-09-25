import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { CONTA_QUE_NAO_E_NEGOCIO, montarPlacar } from '../../../scripts/placar-distribuicao.mjs'

const conta = (id: string, slug: string, plan = 'gratis') => ({ id, slug, plan, deleted_at: null })
const criada = (tenant_id: string, origem?: { canal: string; ref?: string | null }) => ({
  tenant_id,
  event_type: 'conta_criada',
  meta: origem ? { vertical: 'barber', origem } : { vertical: 'barber' },
})
const marco = (tenant_id: string, event_type: string) => ({ tenant_id, event_type, meta: {} })

describe('montarPlacar (docs/82 §13)', () => {
  it('agrupa por canal e conta cada marco do funil uma vez por conta', () => {
    const placar = montarPlacar(
      [conta('a', 'barbearia-a'), conta('b', 'barbearia-b', 'essencial'), conta('c', 'barbearia-c')],
      [
        criada('a', { canal: 'visita' }),
        criada('b', { canal: 'visita' }),
        criada('c'),
        marco('a', 'base_importada'),
        marco('a', 'recuperacao_enviada'),
        marco('a', 'recuperacao_enviada'),
        marco('b', 'cliente_voltou'),
      ],
    )
    expect(placar.funil).toEqual([
      { canal: 'visita', contas: 2, base_importada: 1, motor_viu_valor: 0, recuperacao_enviada: 1, cliente_voltou: 1, pagantes: 1 },
      { canal: 'sem origem', contas: 1, base_importada: 0, motor_viu_valor: 0, recuperacao_enviada: 0, cliente_voltou: 0, pagantes: 0 },
    ])
  })

  it('demonstração, revisão de loja e resíduo de teste não entram — nem os eventos deles', () => {
    const placar = montarPlacar(
      [conta('d', 'demo-studio-bella'), conta('r', 'apple-review'), conta('t', 'origem-e2e2-fsyb'), conta('x', 'recuperar-1a2b3c4d'), conta('ok', 'salao-real')],
      [criada('d', { canal: 'selo' }), criada('r'), criada('t', { canal: 'convite', ref: 'z' }), criada('x'), criada('ok', { canal: 'instagram' })],
    )
    expect(placar.contasReais).toBe(1)
    expect(placar.funil.map((l) => l.canal)).toEqual(['instagram'])
    expect(placar.indicacoes).toEqual([])
  })

  it('quem trouxe quem sai do ref', () => {
    const placar = montarPlacar([conta('n', 'nova')], [criada('n', { canal: 'convite', ref: 'barbearia-do-ze' })])
    expect(placar.indicacoes).toEqual([{ canal: 'convite', quem_trouxe: 'barbearia-do-ze', conta_nova: 'nova', plano: 'gratis' }])
  })

  it('conta real sem conta_criada aparece como lacuna, não some', () => {
    expect(montarPlacar([conta('v', 'veterana')], []).contasSemEvento).toBe(1)
  })

  it('o SQL do runbook exclui os mesmos prefixos que o script', () => {
    const runbook = readFileSync('docs/runbooks/placar-de-distribuicao.md', 'utf8')
    for (const prefixo of ['demo-', 'apple-review', 'teste-', 'origem-e2e']) {
      expect(CONTA_QUE_NAO_E_NEGOCIO.some((r: RegExp) => r.test(`${prefixo}x1`)), `script não exclui ${prefixo}`).toBe(true)
      expect(runbook, `runbook não exclui ${prefixo}`).toContain(prefixo)
    }
  })
})
