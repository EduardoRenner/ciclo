import { describe, expect, it } from 'vitest'

import { AppError } from '@/server/http/errors'
import { definirModulo, listarModulos } from '@/server/services/modulos'

/**
 * Cliente falso que registra o que teria ido para `tenant_modules`. Unitário e não integração
 * pelo motivo já registrado em `docs/DECISOES.md`: o `.env.local` aponta para o Supabase de
 * produção, e um teste que escreve em `tenant_modules` escreveria lá.
 */
function bancoFalso(opcoes: { plano: string; onde?: string | null; desligados?: string[] }) {
  const operacoes: { tipo: 'delete' | 'upsert'; modulo?: string; linha?: Record<string, unknown> }[] = []

  const from = (tabela: string) => {
    const encadeavel = {
      select: () => encadeavel,
      eq: (coluna: string, valor: unknown) => {
        if (tabela === 'tenant_modules' && coluna === 'modulo') pendente.modulo = String(valor)
        return encadeavel
      },
      is: () => encadeavel,
      single: async () => ({
        data: {
          plan: opcoes.plano,
          onde: opcoes.onde ?? 'no_local',
          cobranca: 'fixo',
          inicio: null,
          ritmo: 'avulso',
        },
        error: null,
      }),
      delete: () => {
        pendente.tipo = 'delete'
        return encadeavel
      },
      upsert: async (linha: Record<string, unknown>) => {
        operacoes.push({ tipo: 'upsert', linha })
        return { error: null }
      },
      then: (resolver: (v: unknown) => unknown) => {
        if (pendente.tipo === 'delete') {
          operacoes.push({ tipo: 'delete', modulo: pendente.modulo })
          pendente.tipo = undefined
          return Promise.resolve({ error: null }).then(resolver)
        }
        return Promise.resolve({
          data: (opcoes.desligados ?? []).map((m) => ({ modulo: m, ligado: false, origem: 'dono' })),
          error: null,
        }).then(resolver)
      },
    }
    const pendente: { tipo?: 'delete'; modulo?: string } = {}
    return encadeavel
  }

  return { db: { from } as never, operacoes }
}

const T = '11111111-1111-4111-8111-111111111111'

describe('listarModulos', () => {
  it('esconde o que não faz sentido para o eixo do negócio (§D.5)', async () => {
    // Barbearia atende no local: "Deslocamento e rota" não aparece nem como oferta.
    const { db } = bancoFalso({ plano: 'avancado', onde: 'no_local' })
    const lista = await listarModulos(db, T)
    expect(lista.find((m) => m.key === 'routing')).toBeUndefined()
  })

  it('num negócio que se desloca, o mesmo módulo aparece', async () => {
    const { db } = bancoFalso({ plano: 'avancado', onde: 'vai_ate' })
    const lista = await listarModulos(db, T)
    expect(lista.find((m) => m.key === 'routing')?.veredito.estado).toBe('liberado')
  })

  it('o que o plano não libera aparece com o degrau que resolve, não some', async () => {
    const { db } = bancoFalso({ plano: 'gratis' })
    const lista = await listarModulos(db, T)
    const campanhas = lista.find((m) => m.key === 'campaigns')
    expect(campanhas?.veredito).toEqual({ estado: 'bloqueado_pelo_plano', precisaDo: 'essencial' })
    expect(campanhas?.ligado).toBe(false)
  })

  it('o que o dono desligou vem desligado e continua na lista', async () => {
    const { db } = bancoFalso({ plano: 'gratis', desligados: ['public_page'] })
    const lista = await listarModulos(db, T)
    const pagina = lista.find((m) => m.key === 'public_page')
    expect(pagina?.veredito.estado).toBe('desligado_pelo_dono')
    expect(pagina?.ligado).toBe(false)
  })
})

describe('definirModulo — o plano é teto, o dono só desliga (§L.2)', () => {
  it('desligar grava a escolha do dono', async () => {
    const { db, operacoes } = bancoFalso({ plano: 'gratis' })
    await definirModulo(db, T, { modulo: 'public_page', ligado: false })
    expect(operacoes).toContainEqual({
      tipo: 'upsert',
      linha: { tenant_id: T, modulo: 'public_page', ligado: false, origem: 'dono' },
    })
  })

  it('ligar de volta APAGA a escolha, em vez de gravar ligado=true', async () => {
    // Uma linha `ligado = true, origem = 'dono'` diria que o dono escolheu ter aquilo. No dia em
    // que ele caísse de degrau, essa linha entraria em conflito com o teto do plano.
    const { db, operacoes } = bancoFalso({ plano: 'gratis', desligados: ['public_page'] })
    await definirModulo(db, T, { modulo: 'public_page', ligado: true })
    expect(operacoes.map((o) => o.tipo)).toContain('delete')
    expect(operacoes.some((o) => o.tipo === 'upsert')).toBe(false)
  })

  it('ligar o que o plano não libera é recusado com 402', async () => {
    const { db } = bancoFalso({ plano: 'gratis' })
    const erro = (await definirModulo(db, T, { modulo: 'campaigns', ligado: true }).catch(
      (e: unknown) => e,
    )) as AppError
    expect(erro).toBeInstanceOf(AppError)
    expect(erro.code).toBe('PLAN_LIMIT')
    expect(erro.details).toMatchObject({ precisaDo: 'essencial' })
  })

  it('mas DESligar o que o plano não libera não quebra — já está desligado, e não é erro', async () => {
    const { db } = bancoFalso({ plano: 'gratis' })
    await expect(definirModulo(db, T, { modulo: 'campaigns', ligado: false })).resolves.toBeDefined()
  })

  it('a agenda e o Motor de Ciclo não desligam', async () => {
    const { db } = bancoFalso({ plano: 'avancado' })
    for (const modulo of ['agenda', 'cycle_engine'] as const) {
      const erro = (await definirModulo(db, T, { modulo, ligado: false }).catch((e: unknown) => e)) as AppError
      expect(erro.code).toBe('VALIDATION_ERROR')
    }
  })

  it('módulo fora do eixo é recusado, e SEM oferta de upgrade', async () => {
    const { db } = bancoFalso({ plano: 'gratis', onde: 'no_local' })
    const erro = (await definirModulo(db, T, { modulo: 'routing', ligado: true }).catch(
      (e: unknown) => e,
    )) as AppError
    // FORBIDDEN, não PLAN_LIMIT: pagar mais não resolve, então não insinue que resolve.
    expect(erro.code).toBe('FORBIDDEN')
  })
})
