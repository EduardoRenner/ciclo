import { describe, expect, it } from 'vitest'

import { registrarPrevisoes, resolverPrevisoes, type PrevisaoParaRegistrar } from '@/server/services/previsao'

/**
 * O único ativo do produto que o tempo protege (`docs/45` §1.6) é a previsão guardada ANTES do
 * resultado — um concorrente com anos de histórico de agendamento deriva `personal_cycle_days` e
 * `predicted_on` em batch, mas não reconstrói o que um motor teria previsto e se teria acertado.
 *
 * Estes casos guardam as duas propriedades que fazem a série valer alguma coisa. Se qualquer uma
 * cair, a tabela continua enchendo e passa a mentir, que é pior que estar vazia:
 *
 * 1. **a primeira gravação é a única** — reescrever a previsão com informação que na época não
 *    existia é a mesma coisa que não registrar nada;
 * 2. **só fecha o que realmente aconteceu** — previsão sem retorno conhecido fica em aberto, nunca
 *    vira "não voltou".
 */

type Upsert = { linhas: Record<string, unknown>[]; opcoes: { onConflict?: string; ignoreDuplicates?: boolean } }
type Update = { valores: Record<string, unknown>; filtros: [string, unknown][]; exigiuEmAberto: boolean }

/** Fake do client: registra o que foi pedido, para o teste medir a INTENÇÃO da chamada. */
function fakeDb(abertas: { id: string; client_id: string; service_id: string; last_visit_on: string }[]) {
  const upserts: Upsert[] = []
  const updates: Update[] = []

  function cadeiaDeUpdate(valores: Record<string, unknown>): Update & Record<string, unknown> {
    const registro: Update = { valores, filtros: [], exigiuEmAberto: false }
    updates.push(registro)
    const cadeia = {
      eq: (coluna: string, valor: unknown) => {
        registro.filtros.push([coluna, valor])
        return cadeia
      },
      is: (coluna: string, valor: unknown) => {
        if (coluna === 'resolved_at' && valor === null) registro.exigiuEmAberto = true
        return cadeia
      },
      // Pedir as linhas de volta é o que distingue "fechei" de "alguém fechou antes de mim".
      select: () => Promise.resolve({ data: [{ id: 'p-1' }], error: null }),
    }
    return cadeia as unknown as Update & Record<string, unknown>
  }

  const leitura = {
    select: () => leitura,
    eq: () => leitura,
    is: () => leitura,
    order: () => leitura,
    range: (de: number, ate: number) => Promise.resolve({ data: abertas.slice(de, ate + 1), error: null }),
  }

  const db = {
    from: () => ({
      ...leitura,
      upsert: (linhas: Record<string, unknown>[], opcoes: Upsert['opcoes']) => {
        upserts.push({ linhas, opcoes })
        return Promise.resolve({ error: null })
      },
      update: cadeiaDeUpdate,
    }),
  }

  return { db: db as unknown as Parameters<typeof registrarPrevisoes>[0], upserts, updates }
}

const UMA: PrevisaoParaRegistrar = {
  clientId: 'cli-1',
  serviceId: 'srv-1',
  lastVisitOn: '2026-01-10',
  predictedOn: '2026-01-31',
  personalCycleDays: 21,
  defaultCycleDays: 21,
}

describe('a previsão é registrada uma vez e nunca reescrita', () => {
  it('grava com `ignoreDuplicates` na chave da visita — o job diário não pode duplicar nem sobrescrever', async () => {
    const { db, upserts } = fakeDb([])

    await registrarPrevisoes(db, 'tenant-1', [UMA])

    expect(upserts).toHaveLength(1)
    /*
     * Sem `ignoreDuplicates`, o `recompute-cycles` — que roda todos os dias — reescreveria a
     * previsão de ontem com a de hoje. A linha sobreviveria e o VALOR dela viraria mentira: diria
     * que o Motor previu, no dia da visita, uma data que ele só calculou meses depois.
     */
    expect(upserts[0]!.opcoes.ignoreDuplicates).toBe(true)
    expect(upserts[0]!.opcoes.onConflict).toBe('tenant_id,client_id,service_id,last_visit_on')
  })

  it('carimba a versão do algoritmo em toda linha', async () => {
    const { db, upserts } = fakeDb([])

    await registrarPrevisoes(db, 'tenant-1', [UMA])

    // Sem a versão, a série mistura eras do Motor e a calibração atribui à clientela uma mudança
    // que foi nossa.
    expect(upserts[0]!.linhas[0]).toMatchObject({ algo_version: expect.any(Number) as unknown as number })
    expect(upserts[0]!.linhas[0]!.algo_version as number).toBeGreaterThan(0)
  })

  it('lista vazia não vira consulta', async () => {
    const { db, upserts } = fakeDb([])
    await expect(registrarPrevisoes(db, 'tenant-1', [])).resolves.toBe(0)
    expect(upserts).toHaveLength(0)
  })
})

describe('só fecha a previsão cujo resultado realmente aconteceu', () => {
  const aberta = { id: 'p-1', client_id: 'cli-1', service_id: 'srv-1', last_visit_on: '2026-01-10' }

  it('fecha com a primeira visita DEPOIS da que originou a previsão', async () => {
    const { db, updates } = fakeDb([aberta])
    const historico = new Map([['cli-1:srv-1', ['2026-01-10', '2026-02-04', '2026-03-01']]])

    const fechadas = await resolverPrevisoes(db, 'tenant-1', historico)

    expect(fechadas).toBe(1)
    // A primeira seguinte, não a última: o retorno é 04/02, não 01/03.
    expect(updates[0]!.valores).toMatchObject({ actual_return_on: '2026-02-04' })
    // E o filtro `resolved_at is null` é o que torna rodar duas vezes idêntico a rodar uma.
    expect(updates[0]!.exigiuEmAberto).toBe(true)
  })

  it('sem visita posterior, continua em ABERTO — não vira "não voltou"', async () => {
    /*
     * A pessoa ainda pode voltar. Fechar aqui inventaria um fato, e o fato inventado entraria na
     * calibração como se fosse medição — o defeito mais caro que esta série pode ter.
     */
    const { db, updates } = fakeDb([aberta])
    const historico = new Map([['cli-1:srv-1', ['2026-01-10']]])

    const fechadas = await resolverPrevisoes(db, 'tenant-1', historico)

    expect(fechadas).toBe(0)
    expect(updates).toHaveLength(0)
  })

  it('duas visitas no MESMO dia não fecham uma à outra', async () => {
    // Corte e barba no mesmo atendimento são duas linhas com a mesma data. Isso não é retorno.
    const { db, updates } = fakeDb([aberta])
    const historico = new Map([['cli-1:srv-1', ['2026-01-10', '2026-01-10']]])

    expect(await resolverPrevisoes(db, 'tenant-1', historico)).toBe(0)
    expect(updates).toHaveLength(0)
  })

  it('combinação sem histórico carregado não é tocada', async () => {
    const { db, updates } = fakeDb([aberta])
    expect(await resolverPrevisoes(db, 'tenant-1', new Map())).toBe(0)
    expect(updates).toHaveLength(0)
  })

  it('nada em aberto não vira trabalho', async () => {
    const { db, updates } = fakeDb([])
    expect(await resolverPrevisoes(db, 'tenant-1', new Map([['cli-1:srv-1', ['2026-02-04']]]))).toBe(0)
    expect(updates).toHaveLength(0)
  })
})

describe('o registro anda junto com o recálculo, não num job à parte', () => {
  it('`recomputarCiclosDoTenant` chama as duas metades', async () => {
    /*
     * Guarda de fonte, e assumida como tal: o comportamento de ponta a ponta exige banco e vive em
     * `tests/integration`. O que esta linha protege é a COSTURA — um refactor que separasse o
     * registro do recálculo faria a série parar de crescer em silêncio, sem nenhum teste vermelho,
     * porque tudo que a tela mostra hoje continuaria funcionando.
     */
    const fonte = await import('node:fs').then((fs) => fs.readFileSync('src/server/services/ciclo.ts', 'utf8'))
    expect(fonte).toMatch(/await registrarPrevisoes\(db, tenantId, previsoes\)/)
    expect(fonte).toMatch(/await resolverPrevisoes\(db, tenantId, datasPorCombinacao\)/)
  })
})
