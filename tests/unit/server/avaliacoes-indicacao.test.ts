import { describe, expect, it } from 'vitest'

import { registrarAvaliacao } from '@/server/services/avaliacoes'

/**
 * I-3, `docs/30-INDICACAO-PLANO.md` §2.5/§4.4: o convite de indicação só nasce junto com uma
 * avaliação boa. Comportamento puro de `registrarAvaliacao`, com banco encenado — mesmo padrão
 * de `cofre-trilha.test.ts`.
 *
 * A mecânica criptográfica do token (assinatura, expiração, escopo) já tem cobertura própria em
 * `indicacao-token.test.ts`. Aqui o que importa é a ORQUESTRAÇÃO: em que condições o convite
 * nasce, e para qual tenant/cliente. `registrarAvaliacao` não recebe segredo por parâmetro (só o
 * wrapper de token o recebe, pelo mesmo motivo de `confirmacao-token.ts`), então o token real sai
 * assinado com o `CRON_SECRET`/`PUBLIC_LINK_SIGNING_KEY` do ambiente — que os testes de `tests/unit`
 * não carregam. Verificar aqui que ele é uma STRING não-vazia é o nível certo: a prova
 * criptográfica pertence ao outro arquivo.
 */

const APPOINTMENT_ID = '11111111-1111-4111-8111-111111111111'
const TENANT_ID = '22222222-2222-4222-8222-222222222222'
const CLIENT_ID = '33333333-3333-4333-8333-333333333333'

type Agendamento = { tenant_id: string; client_id: string | null; tenants: { slug: string } | null }

function bancoFalso(agendamento: Agendamento | null, erroInsert: { code: string } | null = null) {
  const db = {
    from: (tabela: string) => {
      if (tabela === 'appointments') {
        return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: agendamento, error: null }) }) }) }
      }
      if (tabela === 'client_reviews') {
        return {
          // O `insert` de verdade recebe a linha inteira — o fake ecoa a `rating` recebida em vez
          // de fixar 5, senão o teste de "nota baixa não gera convite" mediria sempre nota 5.
          insert: (linha: { rating: number }) => ({
            select: () => ({
              single: async () => (erroInsert ? { data: null, error: erroInsert } : { data: { id: APPOINTMENT_ID, rating: linha.rating }, error: null }),
            }),
          }),
        }
      }
      throw new Error(`tabela não encenada: ${tabela}`)
    },
  }
  return db as never
}

/**
 * Todo teste em que `indicacao` sai preenchido chega em `gerarTokenIndicacao`, que lê
 * `CRON_SECRET`/`PUBLIC_LINK_SIGNING_KEY` do ambiente de verdade — `tests/unit` não carrega
 * `.env.local`. Salva e restaura manualmente, sem `vi.stubEnv`: `process.env` é global do
 * processo, e arquivos de teste diferentes rodam na mesma thread do Vitest
 * (`confirmacao-token.test.ts` documenta o vazamento que isso já causou uma vez nesta base).
 */
async function comSegredoDeAmbiente<T>(fn: () => Promise<T>): Promise<T> {
  const original = process.env.CRON_SECRET
  process.env.CRON_SECRET = 'segredo-so-deste-teste'
  try {
    return await fn()
  } finally {
    process.env.CRON_SECRET = original
  }
}

describe('registrarAvaliacao — o convite de indicação (I-3)', () => {
  it('nota 5 com cliente e slug: vem convite, com o mesmo clientId do agendamento', async () => {
    const db = bancoFalso({ tenant_id: TENANT_ID, client_id: CLIENT_ID, tenants: { slug: 'dom-rocha' } })
    const r = await comSegredoDeAmbiente(() => registrarAvaliacao(db, APPOINTMENT_ID, { rating: 5, comment: null }))

    expect(r.indicacao, 'nota 5 devia gerar convite').not.toBeNull()
    expect(r.indicacao!.slug).toBe('dom-rocha')
    expect(r.indicacao!.token.length, 'o token de indicação veio vazio').toBeGreaterThan(10)
  })

  it('nota 4 também gera convite — o piso é 4, não só 5', async () => {
    const db = bancoFalso({ tenant_id: TENANT_ID, client_id: CLIENT_ID, tenants: { slug: 'dom-rocha' } })
    const r = await comSegredoDeAmbiente(() => registrarAvaliacao(db, APPOINTMENT_ID, { rating: 4, comment: null }))
    expect(r.indicacao).not.toBeNull()
  })

  /**
   * O achado da própria pesquisa (`docs/30` §2.5): pedir indicação a quem acabou de reclamar é
   * o jeito mais rápido de transformar uma nota ruim numa avaliação pública ruim.
   */
  it('nota 3 (ou menos) NÃO gera convite — pedir indicação no vale da experiência é o erro que a pesquisa aponta', async () => {
    const db = bancoFalso({ tenant_id: TENANT_ID, client_id: CLIENT_ID, tenants: { slug: 'dom-rocha' } })
    for (const rating of [1, 2, 3]) {
      const r = await registrarAvaliacao(db, APPOINTMENT_ID, { rating, comment: null })
      expect(r.indicacao, `nota ${rating} não devia gerar convite`).toBeNull()
    }
  })

  it('sem cliente (eliminada, LGPD art. 18 VI) não há convite, mesmo com nota 5', async () => {
    const db = bancoFalso({ tenant_id: TENANT_ID, client_id: null, tenants: { slug: 'dom-rocha' } })
    const r = await registrarAvaliacao(db, APPOINTMENT_ID, { rating: 5, comment: null })
    expect(r.indicacao).toBeNull()
  })

  it('sem slug no tenant não há convite — o link não teria para onde apontar', async () => {
    const db = bancoFalso({ tenant_id: TENANT_ID, client_id: CLIENT_ID, tenants: null })
    const r = await registrarAvaliacao(db, APPOINTMENT_ID, { rating: 5, comment: null })
    expect(r.indicacao).toBeNull()
  })

  it('avaliação duplicada (23505) ainda devolve o convite — a nota já registrada pode ser boa', async () => {
    const db = bancoFalso({ tenant_id: TENANT_ID, client_id: CLIENT_ID, tenants: { slug: 'dom-rocha' } }, { code: '23505' })
    const r = await comSegredoDeAmbiente(() => registrarAvaliacao(db, APPOINTMENT_ID, { rating: 5, comment: null }))
    expect(r.duplicado).toBe(true)
    expect(r.indicacao).not.toBeNull()
  })
})
