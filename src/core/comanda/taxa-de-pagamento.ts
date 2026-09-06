/**
 * A taxa da maquininha — a parte do `docs/48` §Fase 3 que o plano supunha pronta e não estava
 * (`docs/49`). Enquanto ninguém escrevia `tickets.fee_cents`, o "Sobrou" do caixa era
 * faturamento − material − comissão, e o dono que passa 60% no cartão fechava o mês achando que
 * sobrou mais do que sobrou.
 */

/**
 * O enum `payment_method` do banco tem oito valores; estes cinco são os que alguém escolhe no
 * fechamento de uma comanda. Os outros três (`club`, `package`, `voucher`) são dinheiro que
 * entrou antes, por outro caminho — quem os fechar aqui estaria contando duas vezes.
 */
export const FORMAS_DE_PAGAMENTO = ['cash', 'pix', 'debit', 'credit', 'other'] as const
export type FormaDePagamento = (typeof FORMAS_DE_PAGAMENTO)[number]

export const NOME_DA_FORMA: Record<FormaDePagamento, string> = {
  cash: 'Dinheiro',
  pix: 'Pix',
  debit: 'Cartão de débito',
  credit: 'Cartão de crédito',
  other: 'Outra forma',
}

export type TaxasDePagamento = Record<FormaDePagamento, number>

/**
 * Zero em tudo, e isso é uma decisão, não uma omissão. A taxa de cada máquina depende da
 * adquirente, do plano e às vezes do dia — semear 3,5% "porque é o de mercado" faria a tela
 * afirmar um número que o CICLO não tem como saber, que é a coisa que o `docs/48` §Fase 3 proíbe
 * em todas as letras: *estado incompleto honesto, nunca número inventado*.
 *
 * Quem separa "o dono respondeu zero" de "o dono nunca respondeu" é `taxaEstaConfigurada`, logo
 * abaixo — é ela que faz a tela dizer "você ainda não disse quanto a maquininha cobra" em vez de
 * mostrar R$ 0,00 como se fosse resultado.
 */
export const TAXAS_ZERADAS: TaxasDePagamento = { cash: 0, pix: 0, debit: 0, credit: 0, other: 0 }

/**
 * `Number(valor)` é a armadilha documentada em `configuracoes-agenda.ts`: `Number(null)` e
 * `Number('')` são **0**, e zero é valor legítimo aqui — então a coerção não cairia no padrão,
 * ela viraria "taxa zero configurada". `typeof === 'number'` fecha essa porta.
 */
function bpsOuZero(valor: unknown): number {
  if (typeof valor !== 'number' || !Number.isFinite(valor)) return 0
  if (valor < 0) return 0
  return Math.min(10_000, Math.round(valor))
}

export function lerTaxasDePagamento(settings: unknown): TaxasDePagamento {
  const raiz = settings && typeof settings === 'object' ? (settings as Record<string, unknown>).payment_fees_bps : null
  const obj = raiz && typeof raiz === 'object' ? (raiz as Record<string, unknown>) : {}
  return {
    cash: bpsOuZero(obj.cash),
    pix: bpsOuZero(obj.pix),
    debit: bpsOuZero(obj.debit),
    credit: bpsOuZero(obj.credit),
    other: bpsOuZero(obj.other),
  }
}

/**
 * "O dono já respondeu a essa pergunta?" — e não "a taxa é maior que zero". Um salão que só
 * recebe em dinheiro e Pix responde zero nas cinco formas de propósito, e para ele o quadro
 * "Taxa" com R$ 0,00 é a verdade, não uma promessa vazia.
 *
 * Por isso esta função só diz se há dinheiro em jogo; quem sabe se a pergunta foi respondida é
 * `taxaEstaConfigurada`.
 */
export function algumaTaxaCobrada(taxas: TaxasDePagamento): boolean {
  return FORMAS_DE_PAGAMENTO.some((forma) => taxas[forma] > 0)
}

/**
 * A presença da chave `payment_fees_bps` **é** o carimbo de que alguém abriu a tela e salvou. Não
 * existe um segundo campo "respondeu?" porque ele poderia divergir do primeiro; aqui os dois são
 * a mesma coisa por construção.
 */
export function taxaEstaConfigurada(settings: unknown): boolean {
  const raiz = settings && typeof settings === 'object' ? (settings as Record<string, unknown>).payment_fees_bps : null
  return Boolean(raiz) && typeof raiz === 'object'
}

export type EntradaTaxa = {
  /** O valor que a cliente efetivamente passou na máquina: subtotal − desconto + gorjeta. */
  totalCents: number
  feeBps: number
}

/**
 * A base é o `total_cents`, **gorjeta inclusa**, e isso não é descuido: a maquininha cobra sobre
 * o valor passado nela, e a gorjeta passa junto. Como `calcularSobraDaComanda` já tira a gorjeta
 * inteira da receita do salão (F84: ela é 100% do profissional), o salão de fato paga a taxa de um
 * dinheiro que não fica com ele. Fingir o contrário aqui esconderia justamente a parte cara.
 */
export function calcularTaxaDaMaquininha(entrada: EntradaTaxa): number {
  if (entrada.totalCents <= 0 || entrada.feeBps <= 0) return 0
  return Math.round((entrada.totalCents * entrada.feeBps) / 10_000)
}
