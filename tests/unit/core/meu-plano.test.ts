import { beforeAll, describe, expect, it } from 'vitest'

import { visaoDoMeuPlano } from '@/core/billing/meu-plano'
import { situacaoDaConta, type Cortesia } from '@/core/billing/prelancamento'

beforeAll(() => {
  process.env.TZ = 'Pacific/Kiritimati'
})

const LONGA: Cortesia = {
  plano: 'equipe',
  ate: '2027-01-11T03:00:00.000Z',
  origem: 'pre_lancamento',
  concedida_em: '2026-11-09T15:00:00.000Z',
  fundador: true,
}
const TESTE: Cortesia = { ...LONGA, ate: '2027-02-23T03:00:00.000Z', origem: 'teste', fundador: false }

/** `Intl` separa "R$" do número com espaço não-quebrável; a asserção normaliza para comparar com texto digitado. */
const plano = (v: ReturnType<typeof visaoDoMeuPlano>) => ({ ...v, preco: v.preco === null ? null : v.preco.replace(/ /g, ' ') })

const visao = (pago: 'gratis' | 'essencial' | 'equipe' | 'avancado', cortesia: Cortesia | null, agoraIso: string, prof = 1) => {
  const agora = new Date(agoraIso)
  return visaoDoMeuPlano(situacaoDaConta(pago, cortesia, agora), pago, prof)
}

describe('Meu plano — cada estado diz a verdade sobre o que a pessoa paga', () => {
  it('cortesia: não diz que está no Equipe nem mostra preço, e oferece Solo e Equipe (nunca o Avançado)', () => {
    const v = visao('gratis', LONGA, '2026-11-10T15:00:00Z')
    expect(v.nome).toBe('Cortesia de pré-lançamento')
    expect(v.preco, 'a cortesia não tem preço: mostrar R$ 99 é dizer que está pagando').toBeNull()
    expect(v.descricao).toBe('Tudo liberado, sem cobrança, até 10 de janeiro.')
    expect(v.explicacao).toBe('Você usa o CICLO inteiro até 10 de janeiro de 2027, sem cartão. Nada é cobrado sem você escolher um plano abaixo.')
    expect(v.opcoes.map((o) => o.tier)).toEqual(['essencial', 'equipe'])
    expect(v.cabecalho).toBe('Escolha seu plano')
    expect(v.descricao + (v.explicacao ?? '')).not.toMatch(/Avançado|Você está no/)
  })

  it('o teste de 21 dias se chama teste', () => {
    expect(visao('gratis', TESTE, '2027-02-03T15:00:00Z').nome).toBe('Teste grátis')
  })

  it('graça: diz até quando tudo funciona, e que depois pausa', () => {
    const v = visao('gratis', LONGA, '2027-01-12T15:00:00Z')
    expect(v.nome).toBe('Cortesia encerrada')
    expect(v.explicacao).toBe(
      'Tudo continua funcionando até 17 de janeiro de 2027. Depois a conta fica pausada: você vê e exporta tudo, mas não cria nada novo. Assinar um plano reativa na hora.',
    )
    expect(v.opcoes.map((o) => o.tier)).toEqual(['essencial', 'equipe'])
  })

  it('pausada: diz que ver e exportar continuam, quanto tempo os dados ficam, e que assinar reativa', () => {
    const v = visao('gratis', LONGA, '2027-01-18T12:00:00Z')
    expect(v.nome).toBe('Conta pausada')
    expect(v.preco).toBeNull()
    // 90 dias de pausa depois dos 7 de graça: 11/01 + 97 dias = 18/04, então o último dia é 17/04.
    expect(v.explicacao).toBe(
      'Você vê e exporta tudo, mas não cria nada novo. Seus dados ficam guardados até 17 de abril de 2027, e assinar um plano reativa tudo na hora.',
    )
    expect(v.opcoes.map((o) => o.tier)).toEqual(['essencial', 'equipe'])
  })

  it('quem paga o Solo vê o preço do Solo e só o Equipe como "mais"', () => {
    const v = plano(visao('essencial', null, '2026-11-10T15:00:00Z'))
    expect(v).toMatchObject({ nome: 'Solo', preco: 'R$ 49/mês', cabecalho: 'Se precisar de mais', noDegrauMaisAlto: false })
    expect(v.opcoes.map((o) => o.tier)).toEqual(['equipe'])
  })

  it('quem paga o Equipe já está no degrau mais alto à venda: nada a listar, e o Avançado não aparece', () => {
    const v = visao('equipe', null, '2026-11-10T15:00:00Z')
    expect(v).toMatchObject({ nome: 'Equipe', noDegrauMaisAlto: true })
    expect(v.opcoes).toEqual([])
  })

  it('o Avançado legado também só aponta para quem está acima do que paga, nunca para ele mesmo', () => {
    const v = visao('avancado', null, '2026-11-10T15:00:00Z')
    expect(v.nome).toBe('Avançado')
    expect(v.opcoes).toEqual([])
    expect(v.noDegrauMaisAlto).toBe(true)
  })

  it('conta anterior ao programa, no Grátis, continua no Grátis e vê as duas faixas à venda', () => {
    const v = plano(visao('gratis', null, '2026-11-10T15:00:00Z'))
    expect(v).toMatchObject({ nome: 'Grátis', preco: 'R$ 0', explicacao: null, cabecalho: 'Escolha seu plano' })
    expect(v.opcoes.map((o) => o.tier)).toEqual(['essencial', 'equipe'])
  })

  it('quem paga o degrau da cortesia ou mais já saiu da cortesia: vê o plano que paga', () => {
    expect(visao('equipe', LONGA, '2026-11-10T15:00:00Z').nome).toBe('Equipe')
  })
})

describe('Meu plano — o teto de profissionais decide se assinar faz sentido', () => {
  it('com 3 profissionais, o Solo avisa que não comporta e o Equipe cabe', () => {
    const v = visao('gratis', LONGA, '2026-11-10T15:00:00Z', 3)
    expect(v.opcoes).toEqual([
      { tier: 'essencial', excedeEm: 2 },
      { tier: 'equipe', excedeEm: 0 },
    ])
  })

  it('com exatamente 1, o Solo cabe; com 5, o Equipe cabe; com 6, nenhum cabe e a tela diz quanto passa', () => {
    expect(visao('gratis', LONGA, '2026-11-10T15:00:00Z', 1).opcoes.map((o) => o.excedeEm)).toEqual([0, 0])
    expect(visao('gratis', LONGA, '2026-11-10T15:00:00Z', 5).opcoes.map((o) => o.excedeEm)).toEqual([4, 0])
    expect(visao('gratis', LONGA, '2026-11-10T15:00:00Z', 6).opcoes.map((o) => o.excedeEm)).toEqual([5, 1])
  })
})

describe('Meu plano — texto', () => {
  it('nenhuma frase tem travessão', () => {
    const cenarios = [
      visao('gratis', LONGA, '2026-11-10T15:00:00Z'),
      visao('gratis', LONGA, '2027-01-12T15:00:00Z'),
      visao('gratis', LONGA, '2027-01-18T12:00:00Z'),
      visao('essencial', null, '2026-11-10T15:00:00Z'),
    ]
    for (const v of cenarios) expect(`${v.descricao} ${v.nome} ${v.explicacao ?? ''}`).not.toMatch(/[—–]/)
  })
})
