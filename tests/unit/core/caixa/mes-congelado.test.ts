import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { contaDoMesFecha, lucroPelasPartes } from '@/core/caixa/mes-congelado'

describe('o mês congelado fecha pelas próprias partes (APR-211)', () => {
  it('três meses de exemplo: receita − material − taxa − comissão − aluguel = lucro', () => {
    const meses = [
      { revenueCents: 1_000_000, materialCents: 120_000, feeCents: 25_000, commissionCents: 400_000, fixedCostCents: 180_000, profitCents: 275_000 },
      { revenueCents: 430_000, materialCents: 0, feeCents: 8_600, commissionCents: 0, fixedCostCents: 200_000, profitCents: 221_400 },
      { revenueCents: 0, materialCents: 0, feeCents: 0, commissionCents: 0, fixedCostCents: 0, profitCents: 0 },
    ]
    for (const m of meses) expect(contaDoMesFecha(m), JSON.stringify(m)).toBe(true)
  })

  it('sem o aluguel na conta, o mês com aluguel NÃO fecha — é o buraco que a coluna nova tapa', () => {
    const m = { revenueCents: 1_000_000, materialCents: 120_000, feeCents: 25_000, commissionCents: 400_000, fixedCostCents: 180_000, profitCents: 275_000 }
    expect(lucroPelasPartes({ ...m, fixedCostCents: 0 })).not.toBe(m.profitCents)
  })

  it('a migration 0131 cria as duas colunas e o congelamento grava as duas', () => {
    const migration = readFileSync('supabase/migrations/0131_mes_congelado_guarda_aluguel_e_gorjeta.sql', 'utf8')
    expect(migration).toMatch(/add column if not exists fixed_cost_cents bigint not null default 0/)
    expect(migration).toMatch(/add column if not exists tip_cents bigint not null default 0/)
    const servico = readFileSync('src/server/services/caixa.ts', 'utf8')
    expect(servico).toMatch(/fixed_cost_cents: resumo\.fixedCostCents/)
    expect(servico).toMatch(/tip_cents: resumo\.tipCents/)
  })
})
