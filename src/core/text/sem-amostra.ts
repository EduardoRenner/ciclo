/**
 * "Ainda não sei" e "é zero" são respostas diferentes, e a tela não pode confundi-las.
 *
 * Esta base já pagou o preço nas duas direções: o quadro "Taxa" mostrando R$ 0,00 por meses
 * porque ninguém escrevia `fee_cents` (lido como *"hoje não teve taxa"*, e retirado da tela em
 * 2026-08-28), e `taxaEstaConfigurada` existindo só para separar *"o dono respondeu zero"* de
 * *"o dono nunca respondeu"*.
 *
 * O caso mais caro é o do acerto do Motor: dizer *"o Motor acertou 0%"* a um salão que ainda não
 * teve nenhuma previsão conferida acusa o produto de um erro que ele não cometeu, e é o tipo de
 * número que o dono lembra.
 *
 * Mora em `core/` porque a alternativa — um ternário no JSX — já se provou impossível de guardar:
 * uma guarda que procurava `acertoBps === null` na tela passou VERDE com o defeito reintroduzido,
 * porque a mesma comparação aparecia noutra linha, no texto de apoio (2026-09-06).
 */

/** O traço, e não o zero, quando não há amostra. Um caractere só, e é o mesmo em toda a casa. */
export const SEM_AMOSTRA = '—'

/**
 * Percentual a partir de basis points, ou o traço quando não há o que afirmar.
 *
 * `null` é o único valor que vira traço. Zero de verdade — o Motor conferiu previsões e errou
 * todas — é `0%`, e tem que aparecer assim: esconder um zero medido é a outra metade do mesmo
 * defeito.
 */
export function percentualOuTraco(bps: number | null | undefined): string {
  if (bps === null || bps === undefined) return SEM_AMOSTRA
  return `${Math.round(bps / 100)}%`
}
