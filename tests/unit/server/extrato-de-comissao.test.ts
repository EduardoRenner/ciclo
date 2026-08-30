import { describe, expect, it } from 'vitest'

import { extratoDeComissao } from '@/server/services/comissao'

/**
 * Achado da auditoria de 2026-08-28. O extrato de comissão filtrava por
 * `closed_at >= '{desde}T00:00:00Z'` e `<= '{ate}T23:59:59Z'`. Três defeitos numa linha, e os
 * dois primeiros tiram dinheiro de quem trabalhou:
 *
 * 1. o dia era UTC, não o fuso do salão — em Brasília, comanda fechada depois das 21h caía no dia
 *    seguinte, sumindo do mês trabalhado. E o extrato aparece na MESMA TELA que o caixa, que já
 *    contava certo desde o TICKET-047: dois números do mesmo mês contando dias diferentes;
 * 2. `<= 23:59:59` deixava uma fresta de menos de um segundo sem dono nenhum;
 * 3. sem paginação, o PostgREST cortava no teto de linhas do projeto e o total vinha menor, sem
 *    nada avisar. O `caixa.ts` já paginava.
 *
 * Aqui a checagem é dos FILTROS e das PÁGINAS, com o banco encenado — o teste de integração
 * (`tests/integration/comissao.test.ts`) prova o comportamento contra o Postgres de verdade.
 */

type Consulta = { filtros: string[]; faixa: [number, number] | null }

function bancoFalso(paginas: Record<string, unknown>[][]) {
  const consultas: Consulta[] = []
  let rodada = 0

  const from = () => ({
    select: () => {
      const filtros: string[] = []
      const q = {
        eq: (c: string, v: unknown) => (filtros.push(`eq:${c}=${String(v)}`), q),
        in: (c: string, v: unknown[]) => (filtros.push(`in:${c}=${v.join(",")}`), q),
        gte: (c: string, v: string) => (filtros.push(`gte:${c}=${v}`), q),
        lte: (c: string, v: string) => (filtros.push(`lte:${c}=${v}`), q),
        lt: (c: string, v: string) => (filtros.push(`lt:${c}=${v}`), q),
        order: (c: string) => (filtros.push(`order:${c}`), q),
        range: (de: number, ate: number) => {
          consultas.push({ filtros, faixa: [de, ate] })
          const data = paginas[rodada] ?? []
          rodada++
          return Promise.resolve({ data, error: null })
        },
      }
      return q
    },
  })

  return { db: { from } as never, consultas }
}

function item(id: string, commission: number) {
  return {
    id,
    ticket_id: `t-${id}`,
    description: "Corte",
    total_cents: 10_000,
    commission_bps: 5_000,
    commission_cents: commission,
    tickets: { status: "closed", closed_at: "2026-03-10T01:30:00.000Z" },
  }
}

const TENANT = "11111111-1111-4111-8111-111111111111"
const PROF = "22222222-2222-4222-8222-222222222222"

describe("extratoDeComissao — o período é o do salão", () => {
  it("o dia começa e termina no fuso do tenant, não em UTC", async () => {
    const { db, consultas } = bancoFalso([[]])
    await extratoDeComissao(db, TENANT, PROF, "America/Sao_Paulo", "2026-03-10", "2026-03-10")

    // 2026-03-10 00:00 em São Paulo = 03:00 UTC. Com o filtro antigo (`T00:00:00Z`), as três
    // primeiras horas do dia UTC — que ainda são a noite do dia ANTERIOR no salão — entravam.
    expect(consultas[0]!.filtros).toContain("gte:tickets.closed_at=2026-03-10T03:00:00Z")
    // E o fim é a meia-noite do dia SEGUINTE, exclusiva.
    expect(consultas[0]!.filtros).toContain("lt:tickets.closed_at=2026-03-11T03:00:00Z")
  })

  it("nenhum filtro usa `lte` — intervalo semiaberto, como no caixa", () => {
    const { db, consultas } = bancoFalso([[]])
    return extratoDeComissao(db, TENANT, PROF, "America/Sao_Paulo", "2026-03-01", "2026-03-31").then(() => {
      const lte = consultas[0]!.filtros.filter((f) => f.startsWith("lte:"))
      expect(lte, "`lte 23:59:59` deixa uma fresta de menos de um segundo sem dono").toEqual([])
    })
  })

  it("outro fuso dá outro instante — a conta usa mesmo o parâmetro", async () => {
    // Guarda contra o próprio detector: um `America/Sao_Paulo` fixo dentro da função passaria no
    // primeiro teste e continuaria errado para quem está em Manaus.
    const { db, consultas } = bancoFalso([[]])
    await extratoDeComissao(db, TENANT, PROF, "America/Manaus", "2026-03-10", "2026-03-10")
    expect(consultas[0]!.filtros).toContain("gte:tickets.closed_at=2026-03-10T04:00:00Z")
  })

  it("só comanda fechada ou paga entra, e só a do profissional pedido", async () => {
    const { db, consultas } = bancoFalso([[]])
    await extratoDeComissao(db, TENANT, PROF, "America/Sao_Paulo", "2026-03-10", "2026-03-10")
    expect(consultas[0]!.filtros).toContain("in:tickets.status=closed,paid")
    expect(consultas[0]!.filtros).toContain(`eq:professional_id=${PROF}`)
    expect(consultas[0]!.filtros).toContain(`eq:tenant_id=${TENANT}`)
  })
})

describe("extratoDeComissao — o extrato não vem truncado", () => {
  it("página cheia puxa a próxima, e o total soma as duas", async () => {
    const cheia = Array.from({ length: 1_000 }, (_, i) => item(`a${i}`, 100))
    const { db, consultas } = bancoFalso([cheia, [item("b0", 700)]])

    const extrato = await extratoDeComissao(db, TENANT, PROF, "America/Sao_Paulo", "2026-03-01", "2026-03-31")

    expect(consultas, "parou na primeira página — é o truncamento silencioso de volta").toHaveLength(2)
    expect(consultas[0]!.faixa).toEqual([0, 999])
    expect(consultas[1]!.faixa).toEqual([1_000, 1_999])
    expect(extrato.items).toHaveLength(1_001)
    expect(extrato.totalCents).toBe(1_000 * 100 + 700)
  })

  it("página incompleta encerra — não fica pedindo página vazia para sempre", async () => {
    const { db, consultas } = bancoFalso([[item("a", 500)]])
    const extrato = await extratoDeComissao(db, TENANT, PROF, "America/Sao_Paulo", "2026-03-01", "2026-03-31")
    expect(consultas).toHaveLength(1)
    expect(extrato.totalCents).toBe(500)
  })

  it("o total é sempre a soma das linhas devolvidas — nunca uma conta à parte", async () => {
    const { db } = bancoFalso([[item("a", 300), item("b", 250)]])
    const extrato = await extratoDeComissao(db, TENANT, PROF, "America/Sao_Paulo", "2026-03-01", "2026-03-31")
    expect(extrato.totalCents).toBe(extrato.items.reduce((s, i) => s + i.commissionCents, 0))
    expect(extrato.totalCents).toBe(550)
  })
})
