import { describe, expect, it } from 'vitest'

import { EsquemaProdutoParcial } from '@/server/services/estoque'
import { EsquemaModeloParcial } from '@/server/services/mensagens-prontas'
import { EsquemaProfissionalParcial } from '@/server/services/profissionais'
import { EsquemaServicoParcial } from '@/server/services/servicos'

/**
 * Achado da rodada 6 (2026-09-21), a mesma classe do PATCH de cliente: `Esquema.partial()` sobre um
 * schema com `.default(...)` PREENCHE o default quando o campo falta (Zod 4). Então um PATCH só com o
 * campo que mudou reaplicava o resto dos padrões e gravava por cima:
 *
 *   - serviço: sinal (`depositBps`) → 0, ciclo (`cycleDays`) → 21, `requiresAnamnesis` → false,
 *     `bookableOnline` → true (um serviço escondido do site voltava a ser marcável), buffers, capacidade;
 *   - profissional: `commissionBps` → 0, `compModel` → 'owner', `acceptsOnline` → true;
 *   - produto: `avgCostCents` → 0 (o custo do insumo some do lucro), `isRetail` → false;
 *   - modelo de mensagem: `active` → true (um modelo desativado voltava a ser oferecido).
 *
 * Estava ATIVO em produção: `PATCH /services/:id` com `{ suggestedProductId }` (sugestão de produto no
 * momento de marcar, de 15/09) zerava o sinal do serviço a cada vez que o dono escolhia o produto.
 *
 * O que se guarda é o COMPORTAMENTO: o parse de um PATCH devolve exatamente o que veio.
 */
describe('schemas de PATCH: enviar um campo não inventa os outros', () => {
  const casos: [string, { safeParse: (x: unknown) => { success: boolean; data?: unknown } }, Record<string, unknown>][] = [
    ['serviço (só a sugestão de produto)', EsquemaServicoParcial, { suggestedProductId: '11111111-1111-4111-8111-111111111111' }],
    ['serviço (só o nome)', EsquemaServicoParcial, { name: 'Corte' }],
    ['profissional (só o nome)', EsquemaProfissionalParcial, { displayName: 'Ana' }],
    ['produto (só o nome)', EsquemaProdutoParcial, { name: 'Máscara' }],
    ['modelo de mensagem (só o texto)', EsquemaModeloParcial, { body: 'Olá, tudo bem?' }],
  ]

  it.each(casos)('%s: o parse devolve EXATAMENTE o que veio', (_nome, esquema, corpo) => {
    const r = esquema.safeParse(corpo)
    expect(r.success).toBe(true)
    expect(r.data).toEqual(corpo)
  })

  it('CONTROLE POSITIVO — o que foi enviado, inclusive um valor igual ao padrão, chega', () => {
    // `false`/`0` enviados de propósito não podem ser confundidos com "campo ausente".
    expect(EsquemaServicoParcial.safeParse({ depositBps: 0, requiresAnamnesis: false }).data).toEqual({ depositBps: 0, requiresAnamnesis: false })
    expect(EsquemaModeloParcial.safeParse({ active: false }).data).toEqual({ active: false })
  })
})
