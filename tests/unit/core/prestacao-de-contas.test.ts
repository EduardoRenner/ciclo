import { describe, expect, it } from 'vitest'

import { JANELA_DE_ESPERA_DIAS, MINIMO_PARA_AFIRMAR, prestacaoDeContas, TOLERANCIA_DIAS } from '@/core/cycle/prestacao-de-contas'

const HOJE = '2026-09-06'

const prevista = (predictedOn: string, actualReturnOn: string | null = null) => ({ predictedOn, actualReturnOn })

/** Oito previsões certeiras — o piso para o percentual poder ser afirmado. */
function oitoAcertos() {
  return Array.from({ length: 8 }, (_, i) => prevista('2026-08-01', `2026-08-0${(i % 5) + 1}`))
}

describe('prestacaoDeContas', () => {
  it('voltar dentro da tolerância é acerto', () => {
    const r = prestacaoDeContas(oitoAcertos(), HOJE)
    expect(r.conferidas).toBe(8)
    expect(r.acertos).toBe(8)
    expect(r.acertoBps).toBe(10_000)
  })

  it('voltar muito antes e muito depois são erros, e de lados diferentes', () => {
    const r = prestacaoDeContas(
      [prevista('2026-08-20', '2026-08-01'), prevista('2026-08-01', '2026-08-20'), prevista('2026-08-01', '2026-08-03')],
      HOJE,
    )
    expect(r.detalhe.voltouAntes).toBe(1)
    expect(r.detalhe.voltouDepois).toBe(1)
    expect(r.detalhe.voltouNaJanela).toBe(1)
  })

  it(`a tolerância é de ${TOLERANCIA_DIAS} dias para cada lado, e o limite conta como acerto`, () => {
    const r = prestacaoDeContas([prevista('2026-08-01', '2026-08-08'), prevista('2026-08-01', '2026-08-09')], HOJE)
    expect(r.detalhe.voltouNaJanela).toBe(1)
    expect(r.detalhe.voltouDepois).toBe(1)
  })

  /**
   * O viés de sobrevivência que este módulo existe para não ter. `resolved_at` só é preenchido
   * quando a pessoa VOLTA: contar só as resolvidas faria a taxa de acerto subir quanto pior o
   * Motor fosse — quem nunca voltou nunca viraria erro.
   */
  it('previsão vencida e ainda em aberto conta como ERRO, não como "ainda pode"', () => {
    const vencidas = Array.from({ length: 8 }, () => prevista('2026-06-01', null)) // 97 dias atrás
    const r = prestacaoDeContas([...oitoAcertos(), ...vencidas], HOJE)
    expect(r.detalhe.naoVoltou).toBe(8)
    expect(r.conferidas).toBe(16)
    expect(r.acertoBps, 'metade acertou').toBe(5_000)
  })

  it(`previsão que passou da data há menos de ${JANELA_DE_ESPERA_DIAS} dias fica em aberto, sem contar para lado nenhum`, () => {
    const r = prestacaoDeContas([...oitoAcertos(), prevista('2026-09-01', null)], HOJE)
    expect(r.emAberto).toBe(1)
    expect(r.conferidas).toBe(8)
    expect(r.acertoBps).toBe(10_000)
  })

  it('previsão para o futuro também fica em aberto', () => {
    const r = prestacaoDeContas([prevista('2026-12-01', null)], HOJE)
    expect(r.emAberto).toBe(1)
    expect(r.conferidas).toBe(0)
  })

  /**
   * `null` não é zero: zero se lê como "o Motor erra sempre". Enquanto não há amostra, a tela tem
   * que dizer que ainda está aprendendo — a mesma regra da procedência da régua e do ritmo.
   */
  it(`abaixo de ${MINIMO_PARA_AFIRMAR} conferidas, não afirma percentual`, () => {
    const r = prestacaoDeContas([prevista('2026-08-01', '2026-08-02')], HOJE)
    expect(r.conferidas).toBe(1)
    expect(r.acertoBps).toBeNull()
    expect(r.erroMedianoDias).toBeNull()
  })

  it('o erro mediano tem sinal: negativo quer dizer que as pessoas voltam ANTES do previsto', () => {
    const cedo = Array.from({ length: 8 }, () => prevista('2026-08-20', '2026-08-10'))
    expect(prestacaoDeContas(cedo, HOJE).erroMedianoDias).toBe(-10)

    const tarde = Array.from({ length: 8 }, () => prevista('2026-08-10', '2026-08-20'))
    expect(prestacaoDeContas(tarde, HOJE).erroMedianoDias).toBe(10)
  })

  /**
   * Quem não voltou não tem "erro em dias". Usar a distância até hoje faria a mediana crescer
   * sozinha todo dia, sem ninguém mexer em nada.
   */
  it('quem não voltou não entra no erro mediano', () => {
    const r = prestacaoDeContas([...oitoAcertos(), ...Array.from({ length: 20 }, () => prevista('2026-01-01', null))], HOJE)
    expect(r.detalhe.naoVoltou).toBe(20)
    expect(r.erroMedianoDias, 'a mediana passou a contar quem nunca voltou').toBeLessThanOrEqual(TOLERANCIA_DIAS)
  })

  it('sem previsão nenhuma, tudo zero e nada afirmado', () => {
    const r = prestacaoDeContas([], HOJE)
    expect(r).toMatchObject({ conferidas: 0, acertos: 0, acertoBps: null, emAberto: 0, erroMedianoDias: null })
  })
})
