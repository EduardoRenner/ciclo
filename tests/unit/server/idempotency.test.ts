import { randomUUID } from 'node:crypto'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { withTenant } from '@/server/db/with-tenant'
import { comIdempotencia } from '@/server/http/idempotency'

vi.mock('@/server/db/with-tenant', () => ({ withTenant: vi.fn() }))

const TENANT_A = '11111111-1111-4111-8111-111111111111'
const TENANT_B = '22222222-2222-4222-8222-222222222222'

type Linha = {
  key: string
  tenant_id: string
  request_hash: string
  response_status: number | null
  response_body: unknown
}

/**
 * Postgres de mentira com a mesma regra que importa: `key` é chave primária
 * **global**, então uma linha do tenant A ocupa a chave para todo mundo. É
 * assim que o teste de vazamento entre tenants tem o que provar.
 */
function bancoFalso(tabela = new Map<string, Linha>()) {
  vi.mocked(withTenant).mockImplementation(async (tenantId, fn) => {
    const db = {
      from: () => {
        const filtros: Record<string, string> = {}
        const construtor = {
          insert: (linha: Linha) => ({
            select: () => ({
              maybeSingle: async () => {
                if (tabela.has(linha.key)) return { data: null, error: { code: '23505' } }
                tabela.set(linha.key, { ...linha, response_status: null, response_body: null })
                return { data: { key: linha.key }, error: null }
              },
            }),
          }),
          select: () => construtor,
          update: (campos: Partial<Linha>) => ({
            eq: (c: string, v: string) => {
              filtros[c] = v
              return {
                eq: async (c2: string, v2: string) => {
                  filtros[c2] = v2
                  const linha = tabela.get(String(filtros.key))
                  if (linha && linha.tenant_id === filtros.tenant_id) Object.assign(linha, campos)
                  return { error: null }
                },
              }
            },
          }),
          delete: () => ({
            eq: (c: string, v: string) => {
              filtros[c] = v
              return {
                eq: async (c2: string, v2: string) => {
                  filtros[c2] = v2
                  const linha = tabela.get(String(filtros.key))
                  if (linha && linha.tenant_id === filtros.tenant_id) tabela.delete(String(filtros.key))
                  return { error: null }
                },
              }
            },
          }),
          eq: (coluna: string, valor: string) => {
            filtros[coluna] = valor
            return construtor
          },
          maybeSingle: async () => {
            const linha = tabela.get(String(filtros.key))
            if (!linha || (filtros.tenant_id && linha.tenant_id !== filtros.tenant_id)) {
              return { data: null, error: null }
            }
            return { data: linha, error: null }
          },
        }
        return construtor
      },
    }
    return fn(db as never, tenantId)
  })

  return tabela
}

function post(chave: string | null, corpo: unknown): Request {
  return new Request('https://app.ciclo.test/api/v1/appointments', {
    method: 'POST',
    headers: chave ? { 'idempotency-key': chave } : {},
    body: JSON.stringify(corpo),
  })
}

const ROTA = { tenantId: TENANT_A, endpoint: '/api/v1/appointments' }

describe('comIdempotencia', () => {
  afterEach(() => vi.restoreAllMocks())

  it('exige o header, que a documentação marca como obrigatório em POST', async () => {
    bancoFalso()
    await expect(comIdempotencia(post(null, { a: 1 }), ROTA, async () => ({ id: 'x' }))).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    })
  })

  it('recusa chave que não é uuid v4', async () => {
    bancoFalso()
    await expect(comIdempotencia(post('chave-do-cliente', { a: 1 }), ROTA, async () => ({ id: 'x' }))).rejects.toMatchObject(
      { code: 'VALIDATION_ERROR' },
    )
  })

  it('o mesmo POST duas vezes executa uma vez só', async () => {
    bancoFalso()
    const chave = randomUUID()
    const corpo = { serviceId: 's-1', startsAt: '2026-08-20T18:00:00Z' }
    const executar = vi.fn(async () => ({ id: 'ag-1' }))

    const primeira = await comIdempotencia(post(chave, corpo), ROTA, executar)
    const segunda = await comIdempotencia(post(chave, corpo), ROTA, executar)

    expect(executar).toHaveBeenCalledTimes(1)
    expect(primeira).toEqual({ id: 'ag-1' })
    expect(segunda).toEqual({ id: 'ag-1' })
  })

  it('mesma chave com payload diferente devolve IDEMPOTENCY_KEY_REUSED', async () => {
    bancoFalso()
    const chave = randomUUID()
    const executar = vi.fn(async () => ({ id: 'ag-1' }))

    await comIdempotencia(post(chave, { startsAt: '18:00' }), ROTA, executar)

    await expect(comIdempotencia(post(chave, { startsAt: '19:00' }), ROTA, executar)).rejects.toMatchObject({
      code: 'IDEMPOTENCY_KEY_REUSED',
      status: 422,
    })
    expect(executar).toHaveBeenCalledTimes(1)
  })

  it('chave de outro tenant não devolve a resposta guardada', async () => {
    // O ataque: B manda a mesma Idempotency-Key e o mesmo corpo que A usou. Com
    // `key` sendo PK global e sem prefixo por tenant, B receberia o agendamento
    // do A de volta.
    const tabela = bancoFalso()
    const chave = randomUUID()
    const corpo = { serviceId: 's-1' }

    await comIdempotencia(post(chave, corpo), ROTA, async () => ({ id: 'agendamento-do-A' }))

    const doB = await comIdempotencia(
      post(chave, corpo),
      { tenantId: TENANT_B, endpoint: '/api/v1/appointments' },
      async () => ({ id: 'agendamento-do-B' }),
    )

    expect(doB).toEqual({ id: 'agendamento-do-B' })
    expect([...tabela.keys()]).toEqual([`${TENANT_A}:${chave}`, `${TENANT_B}:${chave}`])
  })

  it('a mesma chave em rota diferente conta como pedido diferente', async () => {
    bancoFalso()
    const chave = randomUUID()

    await comIdempotencia(post(chave, { a: 1 }), ROTA, async () => ({ id: 'ag-1' }))

    await expect(
      comIdempotencia(post(chave, { a: 1 }), { tenantId: TENANT_A, endpoint: '/api/v1/tickets' }, async () => ({
        id: 't-1',
      })),
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_KEY_REUSED' })
  })

  it('erro na operação solta a reserva, para a fila offline poder reenviar', async () => {
    const tabela = bancoFalso()
    const chave = randomUUID()
    const corpo = { serviceId: 's-1' }

    await expect(
      comIdempotencia(post(chave, corpo), ROTA, async () => {
        throw new Error('banco caiu no meio')
      }),
    ).rejects.toThrow('banco caiu no meio')

    expect(tabela.size).toBe(0)

    const depois = await comIdempotencia(post(chave, corpo), ROTA, async () => ({ id: 'ag-1' }))
    expect(depois).toEqual({ id: 'ag-1' })
  })

  it('enquanto a primeira tentativa roda, a segunda é mandada esperar', async () => {
    const tabela = bancoFalso()
    const chave = randomUUID()
    const corpo = { serviceId: 's-1' }

    let liberar = () => {}
    const travada = new Promise<void>((r) => {
      liberar = r
    })

    const primeira = comIdempotencia(post(chave, corpo), ROTA, async () => {
      await travada
      return { id: 'ag-1' }
    })

    // Espera a reserva aparecer: ela é gravada depois de alguns awaits, e
    // assumir uma ordem de microtasks deixaria o teste instável.
    await vi.waitFor(() => {
      expect(tabela.has(`${TENANT_A}:${chave}`)).toBe(true)
    })
    // Reserva feita, resposta ainda não — é este estado que manda esperar.
    expect(tabela.get(`${TENANT_A}:${chave}`)?.response_status).toBeNull()

    await expect(comIdempotencia(post(chave, corpo), ROTA, async () => ({ id: 'duplicata' }))).rejects.toMatchObject({
      code: 'RATE_LIMITED',
    })

    liberar()
    expect(await primeira).toEqual({ id: 'ag-1' })
  })
})
