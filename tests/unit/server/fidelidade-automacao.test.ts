import { describe, expect, it } from 'vitest'

import { lerConfigFidelidade, pontuarAtendimentoConcluido } from '@/server/services/fidelidade'

/**
 * A fidelidade automática é o módulo `loyalty` — e era o único pedaço dele que nenhuma trava de
 * rota alcançava.
 *
 * As travas de `exigirModulo` vivem nas rotas de escrita, mas `pontuarAtendimentoConcluido` não é
 * chamada por rota nenhuma de fidelidade: ela roda de dentro de `concluirAgendamento`, que é ação
 * do plano grátis. E não bastava travar `PATCH /tenant/loyalty-config` ("é lá que a automação é
 * ligada"), porque **ela já nasce ligada**: `CONFIG_PADRAO.pointsPerReal` é 1, e
 * `lerConfigFidelidade` entrega esse padrão a quem nunca gravou `settings.loyalty`.
 *
 * Medido em produção em 2026-08-26: nenhum dos 11 tenants tinha `settings.loyalty`, e mesmo assim
 * `dom-rocha` acumulou 9 lançamentos em 263 atendimentos concluídos. A rota de config nunca havia
 * sido chamada por ninguém.
 *
 * Este arquivo é unitário de propósito, pelo mesmo motivo escrito em `planos-limite.test.ts`:
 * `.env.local` aponta para produção, e um teste de integração aqui gravaria `tenants.plan` na base
 * real.
 */

const T = '11111111-1111-4111-8111-111111111111'
const CLIENTE = '22222222-2222-4222-8222-222222222222'

/**
 * Encena só a superfície que o caminho exercitado toca. `tenants` é consultado DUAS vezes com
 * `select` diferentes — `contextoDePlano` pede plano/eixos com `.single()`, e a pontuação pede
 * `settings` com `.maybeSingle()` — então a linha devolvida carrega os dois conjuntos de campos.
 */
function bancoFalso(opcoes: { plano: string; settingsLoyalty?: unknown; desligados?: string[] }) {
  const inseridos: Record<string, unknown>[] = []

  const linhaTenant = {
    plan: opcoes.plano,
    onde: 'no_local',
    cobranca: 'fixo',
    inicio: null,
    ritmo: 'avulso',
    settings: opcoes.settingsLoyalty === undefined ? {} : { loyalty: opcoes.settingsLoyalty },
  }

  const construtor = (tabela: string) => {
    const encadeavel = {
      select: () => encadeavel,
      eq: () => encadeavel,
      is: () => encadeavel,
      single: async () => ({ data: linhaTenant, error: null }),
      maybeSingle: async () =>
        tabela === 'clients'
          ? { data: { referred_by: null, visits_count: 3 }, error: null }
          : { data: linhaTenant, error: null },
      insert: async (linhas: Record<string, unknown>[]) => {
        inseridos.push(...linhas)
        return { error: null }
      },
      then: (resolver: (v: unknown) => unknown) =>
        Promise.resolve(
          tabela === 'tenant_modules'
            ? { data: (opcoes.desligados ?? []).map((m) => ({ modulo: m, ligado: false, origem: 'dono' })), error: null }
            : { count: 0, error: null },
        ).then(resolver),
    }
    return encadeavel
  }

  return { db: { from: (tabela: string) => construtor(tabela) } as never, inseridos }
}

const ATENDIMENTO = { appointmentId: '33333333-3333-4333-8333-333333333333', clientId: CLIENTE, priceCents: 10_000 }

describe('fidelidade automática respeita o plano', () => {
  it('tenant pago SEM configuração nenhuma pontua — é o padrão que faz a automação valer', async () => {
    // O caminho feliz, e ao mesmo tempo a prova de que o padrão realmente pontua. Sem esta
    // asserção, o teste abaixo passaria por engano se `pontuarAtendimentoConcluido` parasse de
    // pontuar por qualquer outro motivo — o defeito nº 1 da tabela de guarda cega do CLAUDE.md.
    const { db, inseridos } = bancoFalso({ plano: 'equipe' })
    await pontuarAtendimentoConcluido(db, T, ATENDIMENTO)
    expect(inseridos).toHaveLength(1)
    expect(inseridos[0]).toMatchObject({ points: 100, reason: 'Pontos do atendimento' })
  })

  it('tenant grátis NÃO pontua, mesmo sem nunca ter tocado na configuração', async () => {
    // Exatamente o estado medido em produção: `settings.loyalty` ausente nos 11 tenants.
    const { db, inseridos } = bancoFalso({ plano: 'gratis' })
    await pontuarAtendimentoConcluido(db, T, ATENDIMENTO)
    expect(inseridos, 'tenant `gratis` acumulou ponto pela automação do degrau Equipe').toEqual([])
  })

  it('tenant pago que DESLIGOU fidelidade não pontua', async () => {
    const { db, inseridos } = bancoFalso({ plano: 'equipe', desligados: ['loyalty'] })
    await pontuarAtendimentoConcluido(db, T, ATENDIMENTO)
    expect(inseridos).toEqual([])
  })

  it('não derruba a conclusão do atendimento quando o plano não deixa', async () => {
    // O contrato da função é nunca lançar: quem chama está dentro de `concluirAgendamento`, e
    // bônus de ponto não pode desfazer um atendimento que já aconteceu. "Sem o módulo" é decisão,
    // não falha.
    const { db } = bancoFalso({ plano: 'gratis' })
    await expect(pontuarAtendimentoConcluido(db, T, ATENDIMENTO)).resolves.toBeUndefined()
  })
})

/**
 * O leitor da configuração, e o defeito que ele tinha: `safeParse` do objeto INTEIRO, caindo em
 * `CONFIG_PADRAO` na primeira invalidade.
 *
 * Medido antes do conserto: um tenant com `pointsPerReal: 0` — fidelidade desligada de propósito,
 * o que o comentário do próprio esquema chama de escolha legítima ("nem todo negócio quer
 * fidelidade ligada") — voltava para `1` se qualquer OUTRO campo do namespace ficasse inválido.
 *
 * Religar sozinho custa mais que os outros erros desta família: `pontuarAtendimentoConcluido`
 * grava em `loyalty_entries`, que é livro-razão (resgate é lançamento negativo, nunca `UPDATE`).
 * Ponto creditado por engano vira obrigação com a cliente, e desfazer é tirar da frente dela algo
 * que ela já viu.
 *
 * O conserto NÃO escolhe o lado oposto — cair para "desligado" teria o defeito espelhado, parando
 * de pontuar quem tinha ligado. Resgata campo a campo: o que dá para ler fica, só o inválido vira
 * padrão.
 */
describe('config de fidelidade: campo torto não derruba o vizinho', () => {
  const COMPLETO = { pointsPerReal: 0, referralBonusPoints: 20, rewardThreshold: 100 }

  it('quem nunca gravou nada continua no padrão', () => {
    expect(lerConfigFidelidade({}).pointsPerReal).toBe(1)
    expect(lerConfigFidelidade({ loyalty: {} }).pointsPerReal).toBe(1)
    expect(lerConfigFidelidade(null).rewardThreshold).toBe(100)
  })

  it('config válida é respeitada, inclusive o zero que DESLIGA', () => {
    expect(lerConfigFidelidade({ loyalty: COMPLETO }).pointsPerReal).toBe(0)
    expect(lerConfigFidelidade({ loyalty: { ...COMPLETO, pointsPerReal: 3 } }).pointsPerReal).toBe(3)
  })

  it('rótulo inválido não religa a pontuação de quem desligou', () => {
    // O caso medido: `rewardLabel` acima do máximo derrubava o objeto inteiro, e `pointsPerReal`
    // voltava de 0 para 1 — fidelidade ligada sozinha, gravando em livro-razão.
    const config = lerConfigFidelidade({ loyalty: { ...COMPLETO, rewardLabel: 'x'.repeat(200) } })
    expect(config.pointsPerReal).toBe(0)
    expect(config.rewardLabel, 'só o campo inválido vira padrão').toBe(null)
  })

  it('limiar fora da faixa e campo faltando também não religam', () => {
    expect(lerConfigFidelidade({ loyalty: { ...COMPLETO, rewardThreshold: 0 } }).pointsPerReal).toBe(0)
    expect(lerConfigFidelidade({ loyalty: { pointsPerReal: 0, referralBonusPoints: 20 } }).pointsPerReal).toBe(0)
  })

  it('o campo inválido cai no padrão, e só ele', () => {
    // O outro lado: resgatar não pode virar aceitar lixo. Limiar 0 é inválido (mínimo 1) e vira
    // 100; o resto do que estava certo continua de pé.
    const config = lerConfigFidelidade({ loyalty: { ...COMPLETO, pointsPerReal: 5, rewardThreshold: 0 } })
    expect(config.rewardThreshold).toBe(100)
    expect(config.pointsPerReal).toBe(5)
    expect(config.referralBonusPoints).toBe(20)
  })
})
