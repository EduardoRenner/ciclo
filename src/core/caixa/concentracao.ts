/**
 * `docs/48` C7 — *"62% do seu lucro depende do Rafa"*.
 *
 * ## A decisão cara que ninguém instrumenta
 *
 * `docs/47` D-E e P07: *"um barbeiro bom pede as contas — e leva metade da clientela junto… o
 * cliente era 'do' barbeiro, não da barbearia"*. A pesquisa não achou **nenhum** sistema do setor
 * que meça concentração por profissional; o que existe é conteúdo vendendo a ideia de que "o
 * cliente é da barbearia", que é posicionamento, não medida. O dono descobre o tamanho da
 * dependência no dia da demissão.
 *
 * ## Por que rateio, e por que a partir do lucro CONGELADO
 *
 * `tickets.profit_cents` é o número que o caixa mostra e que o fechamento congelou. Recalcular o
 * lucro por item aqui produziria um segundo total, que não bateria com a tela do lado — a
 * armadilha de "duas fontes da mesma verdade" que esta base já pagou no livro-caixa. Então o
 * lucro da comanda é distribuído entre os profissionais dos itens dela, por peso de receita, e a
 * soma das partes é exatamente o todo: a sobra do arredondamento vai para a maior fatia, em vez
 * de sumir.
 *
 * Comanda de um profissional só — a esmagadora maioria — cai no caso trivial: ele leva tudo.
 */

export type ItemDoRateio = {
  /** `ticket_items.professional_id`. Nulo existe: item lançado sem vínculo. */
  professionalId: string | null
  totalCents: number
}

/**
 * Distribui o lucro de UMA comanda entre os profissionais dos itens dela.
 *
 * Receita total zero devolve mapa vazio, e isso é a resposta honesta: sem peso não há critério de
 * rateio, e escolher um (o primeiro item, o mais recente) seria inventar atribuição. Comanda 100%
 * de cortesia não diz nada sobre dependência de ninguém.
 */
export function ratearLucroDaComanda(profitCents: number, itens: readonly ItemDoRateio[]): Map<string | null, number> {
  const porProfissional = new Map<string | null, number>()
  for (const item of itens) {
    porProfissional.set(item.professionalId, (porProfissional.get(item.professionalId) ?? 0) + item.totalCents)
  }

  const receitaTotal = [...porProfissional.values()].reduce((soma, peso) => soma + peso, 0)
  if (receitaTotal <= 0) return new Map()

  const fatias = new Map<string | null, number>()
  let distribuido = 0
  let maiorPeso = -Infinity
  let donoDaSobra: string | null = null

  for (const [profissional, peso] of porProfissional) {
    const fatia = Math.round((profitCents * peso) / receitaTotal)
    fatias.set(profissional, fatia)
    distribuido += fatia
    if (peso > maiorPeso) {
      maiorPeso = peso
      donoDaSobra = profissional
    }
  }

  // A sobra de arredondamento (centavos) vai para quem tem a maior fatia de receita. Sem isto a
  // soma das partes não bate com o "Sobrou" do caixa, e a tela do lado vira uma contradição.
  const sobra = profitCents - distribuido
  if (sobra !== 0) fatias.set(donoDaSobra, (fatias.get(donoDaSobra) ?? 0) + sobra)

  return fatias
}

export type FatiaDoProfissional = {
  professionalId: string | null
  lucroCents: number
  /** Participação no lucro total do período, em basis points. */
  participacaoBps: number
}

export type Concentracao = {
  fatias: FatiaDoProfissional[]
  lucroTotalCents: number
  /** A maior fatia. `null` quando não há o que concentrar. */
  maior: FatiaDoProfissional | null
  /**
   * Falso quando a medida não significa nada: um profissional só (o dono, quase sempre) dá 100% e
   * não é sinal de risco nenhum. `docs/47` D-E é sobre o barbeiro que sai levando a clientela —
   * ninguém sai de si mesmo.
   */
  vaiADizerAlgo: boolean
}

/** Agrega as fatias de várias comandas e ordena da maior para a menor. */
export function concentracaoDeLucro(porComanda: readonly Map<string | null, number>[]): Concentracao {
  const somado = new Map<string | null, number>()
  for (const comanda of porComanda) {
    for (const [profissional, lucro] of comanda) {
      somado.set(profissional, (somado.get(profissional) ?? 0) + lucro)
    }
  }

  const lucroTotalCents = [...somado.values()].reduce((soma, v) => soma + v, 0)

  const fatias: FatiaDoProfissional[] = [...somado]
    .map(([professionalId, lucroCents]) => ({
      professionalId,
      lucroCents,
      // Lucro total zero ou negativo não tem percentual que signifique alguma coisa: "300% do
      // prejuízo é do Rafa" é uma frase que não ajuda ninguém a decidir nada.
      participacaoBps: lucroTotalCents > 0 ? Math.round((lucroCents / lucroTotalCents) * 10_000) : 0,
    }))
    .sort((a, b) => b.lucroCents - a.lucroCents)

  const comLucro = fatias.filter((f) => f.lucroCents > 0)

  return {
    fatias,
    lucroTotalCents,
    maior: fatias[0] ?? null,
    vaiADizerAlgo: lucroTotalCents > 0 && comLucro.length >= 2,
  }
}
