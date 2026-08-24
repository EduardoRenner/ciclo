import { describe, expect, it, vi } from 'vitest'

import { AppError } from '@/server/http/errors'
import { contextoDePlano, exigirCapacidade, exigirLimite, normalizarPlano } from '@/server/services/planos'

/**
 * Cliente falso com a superfície exata que `planos.ts` usa. Deliberadamente NÃO é teste de
 * integração: `.env.local` aponta para o Supabase de produção, então cada `test:integration`
 * cria tenant e usuário lá — foi assim que os cinco tenants órfãos (`health-*`, `recuperar-*`
 * e companhia) foram parar na base. Um teste de limite de plano precisaria ainda por cima
 * escrever em `tenants.plan` de produção. Aqui a regra é pura e o banco é encenação.
 */
function bancoFalso(opcoes: {
  plano: string
  profissionais?: number
  clientes?: number
  onde?: string | null
  desligados?: string[]
}) {
  const contagens: Record<string, number> = {
    professionals: opcoes.profissionais ?? 0,
    clients: opcoes.clientes ?? 0,
  }

  const construtor = (tabela: string) => {
    const encadeavel = {
      select: () => encadeavel,
      eq: () => encadeavel,
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
      // `tenant_modules` resolve como lista; a contagem resolve com `count`.
      then: (resolver: (v: unknown) => unknown) =>
        Promise.resolve(
          tabela === 'tenant_modules'
            ? { data: (opcoes.desligados ?? []).map((m) => ({ modulo: m, ligado: false, origem: 'dono' })), error: null }
            : { count: contagens[tabela] ?? 0, error: null },
        ).then(resolver),
    }
    return encadeavel
  }

  return { from: (tabela: string) => construtor(tabela) } as never
}

const T = '11111111-1111-4111-8111-111111111111'

describe('normalizarPlano', () => {
  it('aceita os nomes atuais', () => {
    expect(normalizarPlano('gratis')).toBe('gratis')
    expect(normalizarPlano('equipe')).toBe('equipe')
  })

  it('traduz os nomes anteriores à migration 0040', () => {
    // Janela entre o deploy do código e o `db push`: o banco ainda responde o nome velho.
    expect(normalizarPlano('pro')).toBe('essencial')
    expect(normalizarPlano('profissional')).toBe('equipe')
  })

  it('valor desconhecido cai para o degrau MAIS restrito, não para o mais permissivo', () => {
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(normalizarPlano('plano_que_nao_existe')).toBe('gratis')
    expect(aviso).toHaveBeenCalled()
    aviso.mockRestore()
  })
})

describe('contextoDePlano', () => {
  it('lê plano, eixos e o que o dono desligou', async () => {
    const ctx = await contextoDePlano(bancoFalso({ plano: 'equipe', onde: 'vai_ate', desligados: ['loyalty'] }), T)
    expect(ctx.plano).toBe('equipe')
    expect(ctx.eixos.onde).toBe('vai_ate')
    expect(ctx.desligadosPeloDono).toEqual(['loyalty'])
  })
})

describe('exigirLimite — o limite vale no servidor (§L.1)', () => {
  it('deixa passar quando ainda cabe', async () => {
    await expect(exigirLimite(bancoFalso({ plano: 'gratis', profissionais: 0 }), T, 'profissionais')).resolves
      .toBeUndefined()
  })

  it('recusa o segundo profissional no grátis, com 402 e o degrau que resolve', async () => {
    const erro = await exigirLimite(bancoFalso({ plano: 'gratis', profissionais: 1 }), T, 'profissionais').catch(
      (e: unknown) => e,
    )
    expect(erro).toBeInstanceOf(AppError)
    const app = erro as AppError
    expect(app.code).toBe('PLAN_LIMIT')
    expect(app.status).toBe(402)
    expect(app.details).toMatchObject({ recurso: 'profissionais', limite: 1, usoAtual: 1, precisaDo: 'equipe' })
    // A mensagem tem que dizer o degrau, não só "faça upgrade".
    expect(app.publicMessage).toContain('Equipe')
  })

  it('concorda em singular e plural', async () => {
    const erro = (await exigirLimite(bancoFalso({ plano: 'gratis', profissionais: 1 }), T, 'profissionais').catch(
      (e: unknown) => e,
    )) as AppError
    expect(erro.publicMessage).toContain('1 profissional')
    expect(erro.publicMessage).not.toContain('1 profissionais')
  })

  it('no Equipe o sexto profissional é recusado e aponta o Avançado', async () => {
    const erro = (await exigirLimite(bancoFalso({ plano: 'equipe', profissionais: 5 }), T, 'profissionais').catch(
      (e: unknown) => e,
    )) as AppError
    expect(erro.details).toMatchObject({ precisaDo: 'avancado' })
  })

  it('degrau sem teto não recusa nunca', async () => {
    await expect(
      exigirLimite(bancoFalso({ plano: 'avancado', profissionais: 900 }), T, 'profissionais'),
    ).resolves.toBeUndefined()
  })

  it('cliente é limite SUAVE: estourado, ainda assim deixa passar', async () => {
    // Travar cadastro de cliente no meio do atendimento é o jeito mais rápido de o salão largar
    // o sistema. O aviso é da tela; o servidor não recusa.
    await expect(exigirLimite(bancoFalso({ plano: 'gratis', clientes: 90 }), T, 'clientes')).resolves.toBeUndefined()
  })

  it('plano com nome antigo é avaliado pelo teto novo, não crasha', async () => {
    // 'profissional' -> 'equipe', teto de 5.
    await expect(
      exigirLimite(bancoFalso({ plano: 'profissional', profissionais: 4 }), T, 'profissionais'),
    ).resolves.toBeUndefined()
  })
})

describe('exigirCapacidade', () => {
  it('envio em lote no grátis é recusado e aponta o Essencial', async () => {
    const erro = (await exigirCapacidade(bancoFalso({ plano: 'gratis' }), T, 'envio_em_lote').catch(
      (e: unknown) => e,
    )) as AppError
    expect(erro.code).toBe('PLAN_LIMIT')
    expect(erro.details).toMatchObject({ precisaDo: 'essencial' })
  })

  it('no Essencial passa', async () => {
    await expect(exigirCapacidade(bancoFalso({ plano: 'essencial' }), T, 'envio_em_lote')).resolves.toBeUndefined()
  })
})
