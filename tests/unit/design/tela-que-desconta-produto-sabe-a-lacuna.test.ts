import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { semComentarios } from '../../helpers/fonte'

/**
 * Quatro telas afirmam que o número que mostram já desconta o produto. Nenhuma delas sabe disso
 * sozinha — todas dependem de alguém ter registrado a compra do insumo.
 *
 * Até 2026-09-06 o `apply_vertical_pack` semeava um custo de catálogo, então as quatro exibiam um
 * número com cara de apurado, sustentado por um preço que o CICLO inventou no cadastro
 * (`docs/51` §2). A `0069` devolveu esse custo a zero, e a lacuna trocou de direção sem trocar de
 * natureza: agora o produto vale zero até a primeira compra, e o número sai otimista de novo.
 *
 * A promessa e a ressalva têm que viajar juntas. Esta guarda cobra que cada tela CARREGUE o sinal
 * da lacuna — não que a copy esteja escrita de um jeito, o que amarraria a redação para sempre.
 */

const TELAS: { arquivo: string; sinal: RegExp; oQuePromete: string }[] = [
  {
    /*
     * O sinal desta tela mudou de `servicosComProdutoSemCusto` (medido no catálogo de hoje) para
     * `material_incerto` (congelado no lançamento do item, `0070`) — e o sinal novo é mais forte,
     * não mais fraco: enquanto a lacuna era medida agora, ela sumia da comanda de agosto assim que
     * o dono registrasse a compra em outubro, com o `material_cost_cents` dela ainda em zero.
     */
    arquivo: 'src/app/admin/comanda/[id]/page.tsx',
    sinal: /material_incerto/,
    oQuePromete: 'o "Sobrou" daquele atendimento',
  },
  {
    arquivo: 'src/app/admin/caixa/caixa.tsx',
    sinal: /servicosSemMaterial/,
    oQuePromete: 'o quadro "Material" e a frase do "Sobrou" do dia',
  },
  {
    arquivo: 'src/app/admin/recuperar/recuperar.tsx',
    sinal: /servicosSemMaterial/,
    oQuePromete: '"o que sobra depois da comissão e do produto", que ORDENA a fila',
  },
  {
    arquivo: 'src/app/admin/config/planos/margem-do-clube.tsx',
    sinal: /visitasSemMaterialConfiavel/,
    oQuePromete: 'a margem por assinante do clube',
  },
]

describe('tela que desconta o produto sabe quando não descontou', () => {
  /**
   * O piso é a lista inteira, e não `> 0`: a guarda existe para as QUATRO telas, e uma varredura
   * que achasse três passaria calada justamente sobre a que sumiu do caminho.
   */
  it('as quatro telas continuam existindo e legíveis', () => {
    expect(TELAS).toHaveLength(4)
    for (const { arquivo } of TELAS) {
      expect(semComentarios(readFileSync(arquivo, 'utf8')).length, `${arquivo} veio vazio`).toBeGreaterThan(400)
    }
  })

  it.each(TELAS)('$arquivo carrega o sinal da lacuna do material', ({ arquivo, sinal, oQuePromete }) => {
    /*
     * Sem comentário, e por um motivo já pago três vezes nesta base: o bloco que EXPLICA a lacuna
     * cita o nome da variável, e a guarda casaria com a própria documentação depois de alguém
     * apagar o código que ela protege.
     */
    const fonte = semComentarios(readFileSync(arquivo, 'utf8'))
    expect(
      sinal.test(fonte),
      `${arquivo} anuncia ${oQuePromete} sem carregar a lacuna do material. Depois da 0069 o ` +
        'custo do insumo é zero até o dono registrar a compra, e um número que não avisa isso ' +
        'promete um desconto que não aconteceu.',
    ).toBe(true)
  })
})

/**
 * A quarta parcela, de 2026-09-06. O "Sobrou" era `receita − material − taxa − comissão`: margem
 * de contribuição com nome de lucro. Quem paga R$ 3.500 de aluguel lia "Sobrou R$ 24,00" num corte
 * de R$ 45 como o dinheiro que ficou.
 *
 * Ela tem a mesma armadilha da taxa, e a `0066` já a documentou uma coluna ao lado: R$ 0,00 num
 * quadro ao lado de outros números se lê como "hoje não teve", nunca como "ninguém respondeu".
 */
describe('tela que anuncia o "Sobrou" sabe quando o aluguel não entrou', () => {
  const TELAS: { arquivo: string; oQuePromete: string }[] = [
    { arquivo: 'src/app/admin/comanda/[id]/page.tsx', oQuePromete: 'o "Sobrou" daquele atendimento' },
    { arquivo: 'src/app/admin/caixa/caixa.tsx', oQuePromete: 'o "Sobrou" do dia' },
    { arquivo: 'src/app/admin/mes/resumo.tsx', oQuePromete: 'o "Sobrou" do mês' },
  ]

  it('as três telas continuam existindo', () => {
    expect(TELAS).toHaveLength(3)
  })

  it.each(TELAS)('$arquivo carrega a resposta do custo fixo', ({ arquivo, oQuePromete }) => {
    const fonte = semComentarios(readFileSync(arquivo, 'utf8'))
    expect(
      /custoFixoRespondido|custoFixoEstaConfigurado/.test(fonte),
      `${arquivo} anuncia ${oQuePromete} sem saber se o aluguel entrou na conta. Zero sem rótulo ` +
        'se lê como "hoje não teve aluguel" — o defeito que tirou o quadro "Taxa" do caixa em 28/08.',
    ).toBe(true)
  })
})
