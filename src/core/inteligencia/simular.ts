/**
 * MI-6 (docs/84 Aposta A, docs/85 §2.3) — "e se...?", com a premissa na cara.
 *
 * Regras que valem para as duas contas:
 * - Nunca um número fingindo certeza: preço sai em TRÊS cenários (ninguém deixa de vir, 1 em cada
 *   10, 2 em cada 10) e o ponto de empate. Quem escolhe em qual acreditar é o dono — até existir
 *   dado agregado de negócios que mudaram preço (docs/84 §2.4), a premissa é dele.
 * - Veto de preço: nada aqui sugere preço. A conta é sobre o preço que o DONO disse.
 * - Só números do próprio negócio, do período dito na frase.
 */

/**
 * `perda` negativa é GANHO: na redução de preço, os cenários são de gente a mais vindo.
 * `unidade`: em cada 10 (volume de 10 ou mais) ou em PESSOAS (volume menor) — medido no navegador
 * em 29/09: com 5 atendimentos, "1 em cada 10" e "2 em cada 10" davam o mesmo número, e "1 em cada
 * 10 a mais" sobre 3 manicures não somava ninguém. Pessoa não se divide.
 */
export type CenarioDePreco = { perda: number; unidade: 'em_dez' | 'pessoas'; atendimentos: number; receitaCents: number; diferencaCents: number }

export type SimulacaoDePreco = {
  receitaHojeCents: number
  cenarios: CenarioDePreco[]
  /**
   * Quantos em cada 100 podem deixar de vir antes de a receita ficar MENOR que hoje (aumento), ou
   * quantos a mais em cada 100 precisam vir para empatar (redução). Inteiro, arredondado a favor da
   * cautela: para baixo no aumento, para cima na redução.
   */
  empateEmCem: number
  aumento: boolean
}

export function simularPreco(o: { precoAtualCents: number; precoNovoCents: number; atendimentos: number }): SimulacaoDePreco | null {
  const { precoAtualCents: p0, precoNovoCents: p1, atendimentos: n } = o
  if (p0 <= 0 || p1 <= 0 || p1 === p0) return null
  const receitaHojeCents = p0 * n
  // Aumento: e se gente DEIXAR de vir? Redução: e se vier gente A MAIS? Perda num corte de preço é
  // um cenário que ninguém considera — e ganho num aumento, otimismo que ninguém deveria.
  const unidade = n >= 10 ? 'em_dez' : 'pessoas'
  const passos = (p1 > p0 ? [0, 1, 2] : [0, -1, -2]).filter((perda) => unidade === 'em_dez' || perda <= n)
  const vistos = new Set<number>()
  const cenarios: CenarioDePreco[] = []
  for (const perda of passos) {
    // Em cada 10, arredonda o volume restante para baixo — o cenário não pode ser otimista.
    const atendimentos = unidade === 'em_dez' ? Math.floor((n * (10 - perda)) / 10) : n - perda
    if (vistos.has(atendimentos)) continue // cenário repetido não é cenário
    vistos.add(atendimentos)
    const receitaCents = atendimentos * p1
    cenarios.push({ perda, unidade, atendimentos, receitaCents, diferencaCents: receitaCents - receitaHojeCents })
  }
  const aumento = p1 > p0
  // Empate: n' × p1 = n × p0 → fração que pode sair = 1 − p0/p1 (aumento); fração que precisa
  // entrar = p0/p1 − 1 (redução).
  // Em inteiros: `1 − p0/p1` em ponto flutuante dá 20.000000000000004% e o `ceil` viraria 21.
  const empateEmCem = aumento ? Math.floor(((p1 - p0) * 100) / p1) : Math.ceil(((p0 - p1) * 100) / p1)
  return { receitaHojeCents, cenarios, empateEmCem, aumento }
}

/** Preço novo a partir de "10% a mais", sempre em centavos inteiros. */
export function precoComPercentual(precoAtualCents: number, percentualBps: number, aumento: boolean): number {
  return Math.round(precoAtualCents * (1 + ((aumento ? 1 : -1) * percentualBps) / 10_000))
}

export type SimulacaoDeContratacao = {
  sobraPorAtendimentoCents: number
  /** Atendimentos por mês que a contratação precisa trazer para se pagar. */
  atendimentosParaSePagar: number
  atendimentosHojePorMes: number
}

/**
 * Quanto a pessoa nova precisa atender para se pagar, pelo que SOBRA por atendimento hoje
 * (receita − material − taxa − comissão − aluguel, o "Sobrou" do caixa), nos últimos `dias`.
 * `null` quando não sobra nada por atendimento: aí nenhum volume paga a contratação, e a resposta
 * tem que dizer isso — não um "precisa de infinitos atendimentos".
 */
export function simularContratacao(o: { custoMensalCents: number; atendimentos: number; sobraCents: number; dias: number }): SimulacaoDeContratacao | null {
  if (o.atendimentos <= 0 || o.sobraCents <= 0 || o.custoMensalCents <= 0 || o.dias <= 0) return null
  const sobraPorAtendimentoCents = Math.round(o.sobraCents / o.atendimentos)
  return {
    sobraPorAtendimentoCents,
    atendimentosParaSePagar: Math.ceil(o.custoMensalCents / sobraPorAtendimentoCents),
    atendimentosHojePorMes: Math.round((o.atendimentos * 30) / o.dias),
  }
}
