import { describe, expect, it } from 'vitest'

import { registrarEntradaEstoque } from '@/server/services/estoque'

/**
 * `tests/integration/estoque.test.ts` cobre o caminho feliz contra banco de verdade — mas
 * reproduzir a CORRIDA (outra escrita mudando `stock_qty`/`avg_cost_cents` entre a leitura deste
 * código e o seu UPDATE) exigiria derrubar duas conexões no meio de duas chamadas simultâneas
 * contra Postgres de verdade. Fake de `db` alcança determinística: a leitura INICIAL devolve um
 * valor já OBSOLETO (o que este código "viu"), enquanto o estado de verdade do fake já é outro
 * (a escrita concorrente que aconteceu no meio) — a primeira tentativa de UPDATE por CAS não pode
 * casar, forçando a releitura e o recálculo que o conserto existe para fazer.
 */
function fakeDbComCorrida() {
  // Estado de VERDADE: uma escrita concorrente (fora deste teste) já levou o produto de
  // 10un/R$5,00 para 15un/R$4,80 antes da primeira tentativa de UPDATE deste código.
  const estadoDeVerdade = { stock_qty: 15, avg_cost_cents: 480 }
  let leituras = 0

  const chamadasUpdate: { filtros: [string, unknown][] }[] = []

  const leituraProduto = {
    select: () => leituraProduto,
    eq: () => leituraProduto,
    maybeSingle: () => {
      leituras++
      // Primeira leitura: devolve o valor OBSOLETO que este código vai carregar consigo
      // (10un/R$5,00) — é o snapshot que ele tinha antes da corrida externa já ter mudado o
      // banco. Releituras (depois de perder a corrida) devolvem o estado de verdade atual.
      if (leituras === 1) return Promise.resolve({ data: { stock_qty: 10, avg_cost_cents: 500 }, error: null })
      return Promise.resolve({ data: { ...estadoDeVerdade }, error: null })
    },
  }

  function cadeiaDeUpdate(valores: Record<string, unknown>) {
    const registro: { filtros: [string, unknown][] } = { filtros: [] }
    chamadasUpdate.push(registro)
    function resolver() {
      const stockQtyEsperado = registro.filtros.find((f) => f[0] === 'stock_qty')?.[1]
      const custoEsperado = registro.filtros.find((f) => f[0] === 'avg_cost_cents')?.[1]
      // Réplica do UPDATE...WHERE real: sem filtro em `stock_qty`/`avg_cost_cents` (código sem
      // CAS), o `WHERE tenant_id = x AND id = y` sempre casa a linha — é exatamente por isso que
      // o defeito é silencioso, a escrita "funciona" e sobrescreve sem avisar. Com o filtro
      // (código com CAS), só casa se o valor ainda for o que foi lido.
      const temFiltroDeCas = stockQtyEsperado !== undefined || custoEsperado !== undefined
      const casou = !temFiltroDeCas || (stockQtyEsperado === estadoDeVerdade.stock_qty && custoEsperado === estadoDeVerdade.avg_cost_cents)
      if (!casou) return { data: null, error: null }
      estadoDeVerdade.stock_qty = valores.stock_qty as number
      estadoDeVerdade.avg_cost_cents = (valores.avg_cost_cents as number | undefined) ?? estadoDeVerdade.avg_cost_cents
      return { data: { ...estadoDeVerdade, id: 'produto-1' }, error: null }
    }
    const cadeia = {
      eq: (coluna: string, valor: unknown) => {
        registro.filtros.push([coluna, valor])
        return cadeia
      },
      select: () => ({
        maybeSingle: () => Promise.resolve(resolver()),
        // `.single()` do código antigo (sem CAS): sempre casa, então nunca teria o `null` que
        // faria `.single()` do supabase-js lançar — não precisa simular esse lado.
        single: () => Promise.resolve(resolver()),
      }),
    }
    return cadeia
  }

  const db = {
    from: (tabela: string) => {
      if (tabela === 'stock_moves') return { insert: () => Promise.resolve({ error: null }) }
      if (tabela !== 'products') throw new Error(`fake não cobre a tabela ${tabela}`)
      return {
        select: () => leituraProduto,
        update: (valores: Record<string, unknown>) => cadeiaDeUpdate(valores),
      }
    },
  }

  return { db: db as unknown as Parameters<typeof registrarEntradaEstoque>[0], chamadasUpdate, estadoDeVerdade }
}

describe('registrarEntradaEstoque — não perde a corrida em stock_qty/avg_cost_cents', () => {
  it('primeira tentativa de UPDATE perde a corrida, relê e recalcula sobre o valor de verdade', async () => {
    const { db, chamadasUpdate, estadoDeVerdade } = fakeDbComCorrida()

    const resultado = await registrarEntradaEstoque(db, 'tenant-1', {
      productId: 'produto-1',
      qty: 5,
      unitCostCents: 600,
      note: null,
    })

    // Duas tentativas de UPDATE: a primeira (com o valor obsoleto 10/500) não casa nada, a
    // segunda (com o valor relido 15/480) casa e grava. Sem o conserto, só existiria uma
    // tentativa — e ela sobrescreveria o estado de verdade com um número menor do que deveria.
    expect(chamadasUpdate, 'não tentou de novo depois de perder a corrida — a corrida foi perdida em silêncio').toHaveLength(2)

    // 15 (estado de verdade, não os 10 que este código leu primeiro) + 5 (entrada) = 20.
    expect(resultado?.stock_qty, 'usou o stock_qty obsoleto em vez do valor relido após perder a corrida').toBe(20)

    // Custo médio: (15×480 + 5×600) / 20 = 510 — calculado sobre o estado relido (15/480), não
    // sobre o obsoleto (10/500) que teria dado (10×500 + 5×600)/15 = 533.
    expect(resultado?.avg_cost_cents, 'custo médio calculado sobre o snapshot obsoleto, não sobre o valor relido').toBe(510)

    expect(estadoDeVerdade).toEqual({ stock_qty: 20, avg_cost_cents: 510 })
  })
})
