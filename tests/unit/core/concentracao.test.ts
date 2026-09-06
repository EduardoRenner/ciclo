import { describe, expect, it } from 'vitest'

import { concentracaoDeLucro, ratearLucroDaComanda } from '@/core/caixa/concentracao'

describe('ratearLucroDaComanda', () => {
  it('comanda de um profissional só: ele leva tudo', () => {
    const r = ratearLucroDaComanda(6_000, [{ professionalId: 'rafa', totalCents: 10_000 }])
    expect(r.get('rafa')).toBe(6_000)
    expect(r.size).toBe(1)
  })

  it('dois profissionais na mesma comanda dividem por peso de receita', () => {
    const r = ratearLucroDaComanda(
      6_000,
      [
        { professionalId: 'rafa', totalCents: 7_500 },
        { professionalId: 'bia', totalCents: 2_500 },
      ],
    )
    expect(r.get('rafa')).toBe(4_500)
    expect(r.get('bia')).toBe(1_500)
  })

  it('vários itens do mesmo profissional somam numa fatia só', () => {
    const r = ratearLucroDaComanda(
      1_000,
      [
        { professionalId: 'rafa', totalCents: 3_000 },
        { professionalId: 'rafa', totalCents: 2_000 },
        { professionalId: 'bia', totalCents: 5_000 },
      ],
    )
    expect(r.size).toBe(2)
    expect(r.get('rafa')).toBe(500)
  })

  /**
   * O caso que faz a soma bater com o "Sobrou" do caixa exibido ao lado. Sem a sobra de
   * arredondamento voltar para alguém, a tela mostraria duas somas diferentes do mesmo dinheiro —
   * a armadilha de "duas fontes da mesma verdade" que esta base já pagou no livro-caixa.
   */
  it('a soma das fatias é exatamente o lucro da comanda, mesmo com arredondamento', () => {
    for (const lucro of [1, 7, 999, 10_001, 33_333]) {
      const r = ratearLucroDaComanda(lucro, [
        { professionalId: 'a', totalCents: 3_333 },
        { professionalId: 'b', totalCents: 3_333 },
        { professionalId: 'c', totalCents: 3_334 },
      ])
      const soma = [...r.values()].reduce((s, v) => s + v, 0)
      expect(soma, `lucro ${lucro} não fechou`).toBe(lucro)
    }
  })

  it('prejuízo também é rateado, e a soma continua fechando', () => {
    const r = ratearLucroDaComanda(-501, [
      { professionalId: 'a', totalCents: 1_000 },
      { professionalId: 'b', totalCents: 2_000 },
    ])
    expect([...r.values()].reduce((s, v) => s + v, 0)).toBe(-501)
  })

  it('comanda 100% cortesia não atribui dependência a ninguém', () => {
    expect(ratearLucroDaComanda(0, [{ professionalId: 'rafa', totalCents: 0 }]).size).toBe(0)
  })

  it('item sem profissional vinculado não some — vira uma fatia própria', () => {
    const r = ratearLucroDaComanda(1_000, [{ professionalId: null, totalCents: 1_000 }])
    expect(r.get(null)).toBe(1_000)
  })
})

describe('concentracaoDeLucro', () => {
  const comandas = [
    ratearLucroDaComanda(6_200, [{ professionalId: 'rafa', totalCents: 10_000 }]),
    ratearLucroDaComanda(3_800, [{ professionalId: 'bia', totalCents: 6_000 }]),
  ]

  it('ordena da maior fatia para a menor e calcula a participação', () => {
    const c = concentracaoDeLucro(comandas)
    expect(c.lucroTotalCents).toBe(10_000)
    expect(c.fatias.map((f) => f.professionalId)).toEqual(['rafa', 'bia'])
    expect(c.maior?.participacaoBps).toBe(6_200) // 62%
    expect(c.vaiADizerAlgo).toBe(true)
  })

  /**
   * `docs/47` D-E é sobre o barbeiro que sai levando a clientela. Com um profissional só — o dono,
   * quase sempre — a resposta é 100% e não é risco nenhum: ninguém sai de si mesmo. Mostrar isso
   * como alerta seria o mesmo tipo de ruído que fez o quadro "Taxa" zerado sair do caixa.
   */
  it('com um profissional só, a medida não diz nada e avisa que não diz', () => {
    const c = concentracaoDeLucro([ratearLucroDaComanda(6_200, [{ professionalId: 'rafa', totalCents: 10_000 }])])
    expect(c.maior?.participacaoBps).toBe(10_000)
    expect(c.vaiADizerAlgo).toBe(false)
  })

  it('mês no prejuízo não produz percentual — "300% do prejuízo é do Rafa" não ajuda ninguém', () => {
    const c = concentracaoDeLucro([
      ratearLucroDaComanda(-5_000, [{ professionalId: 'rafa', totalCents: 10_000 }]),
      ratearLucroDaComanda(1_000, [{ professionalId: 'bia', totalCents: 2_000 }]),
    ])
    expect(c.lucroTotalCents).toBe(-4_000)
    expect(c.fatias.every((f) => f.participacaoBps === 0)).toBe(true)
    expect(c.vaiADizerAlgo).toBe(false)
  })

  it('sem comanda nenhuma, não há maior fatia', () => {
    const c = concentracaoDeLucro([])
    expect(c.maior).toBeNull()
    expect(c.vaiADizerAlgo).toBe(false)
  })
})
