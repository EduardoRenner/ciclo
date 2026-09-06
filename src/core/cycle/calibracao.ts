/**
 * O Motor corrige o próprio palpite a partir do erro que ele mesmo cometeu.
 *
 * `services.cycle_days` nunca foi uma escolha do dono: nasce 21 por padrão da coluna, ou do que o
 * pack da profissão semeou. É um palpite de catálogo aplicado a todo salão do Brasil. E é ele que
 * decide, para quem tem pouco histórico, quando a pessoa "devia ter voltado" — ou seja, quem
 * aparece na lista de recuperação e quanto dinheiro o produto diz que está em risco.
 *
 * A pesquisa (`docs/45` §1.4) mediu que o setor inteiro trabalha com uma constante — *"se um
 * cliente não agenda há 45 dias"* — e admite no próprio material que o certo *"depende do tipo de
 * corte e da frequência de cada cliente"*. Todo mundo sabe que a régua fixa está errada e ninguém
 * troca de régua.
 *
 * Esta função é a troca de régua: com as previsões já RESOLVIDAS (`cycle_predictions`), ela olha o
 * intervalo real entre a visita que originou a previsão e a volta que de fato aconteceu, e devolve
 * a cadência medida daquele serviço naquele salão.
 *
 * ## Por que mediana e não média
 *
 * Uma cliente que sumiu por oito meses e voltou é um dado real e não pode dominar a régua de todo
 * mundo. A mediana absorve o caso extremo sem precisar decidir arbitrariamente o que é "extremo" —
 * o mesmo motivo pelo qual `computeCycle` já usa mediana no ciclo pessoal.
 *
 * ## Os três freios, e o que cada um evita
 *
 * Não são conservadorismo genérico; cada um evita um defeito concreto:
 *
 * 1. **`MINIMO_DE_AMOSTRA`** — com poucas observações, uma volta atrasada move a mediana inteira e
 *    o produto reescreve a régua do salão com base em uma pessoa.
 * 2. **`DESVIO_MINIMO_DIAS`** — sem ele, a régua oscilaria um ou dois dias toda semana. Número que
 *    muda sozinho e sem consequência visível ensina o dono a não olhar para ele.
 * 3. **A faixa `[1, 365]`** — é o `check` da coluna. Devolver fora dela derrubaria a escrita, e um
 *    job que estoura é pior que um job que não corrige.
 */

/** Uma previsão já resolvida: a visita que a originou e a volta que de fato aconteceu. */
export type PrevisaoResolvida = {
  /** `YYYY-MM-DD` da visita que originou a previsão. */
  lastVisitOn: string
  /** `YYYY-MM-DD` da volta que aconteceu. */
  actualReturnOn: string
}

export type Calibracao = {
  /** A cadência medida, em dias. `null` quando não há base para afirmar nada. */
  diasMedidos: number | null
  /** Quantas voltas entraram na conta. */
  amostra: number
  /** Por que não calibrou — para a tela dizer a verdade em vez de sumir. */
  motivo: 'ok' | 'amostra_insuficiente' | 'diferenca_irrelevante'
}

/**
 * Oito voltas observadas.
 *
 * Abaixo disso, uma única cliente que voltou fora do padrão desloca a mediana em vários dias — e a
 * régua de todo mundo com ela. Oito é o menor número em que a mediana precisa de DUAS observações
 * atípicas para se mover de posição, o que já não é acidente.
 */
export const MINIMO_DE_AMOSTRA = 8

/**
 * Três dias.
 *
 * Abaixo disso, a diferença não muda quem aparece na lista de recuperação (as faixas de
 * `estadoPorAtraso` têm largura de 10 e 30 dias), e mexer no número sem consequência visível
 * treina o dono a ignorá-lo.
 */
export const DESVIO_MINIMO_DIAS = 3

const CICLO_MINIMO = 1
const CICLO_MAXIMO = 365

function mediana(valores: number[]): number {
  const ordenados = [...valores].sort((a, b) => a - b)
  const meio = Math.floor(ordenados.length / 2)
  if (ordenados.length % 2 === 0) return (ordenados[meio - 1]! + ordenados[meio]!) / 2
  return ordenados[meio]!
}

function diasEntre(de: string, ate: string): number {
  // Datas puras (`YYYY-MM-DD`) em UTC: sem hora, não há fuso nem horário de verão para errar.
  return Math.round((Date.parse(`${ate}T12:00:00Z`) - Date.parse(`${de}T12:00:00Z`)) / 86_400_000)
}

/**
 * `cicloAtual` é o que o serviço usa hoje. Devolver `diasMedidos: null` quer dizer "continue com o
 * que você tem" — nunca "não sei nada", que é diferente e a tela precisa distinguir.
 */
export function calibrarCiclo(resolvidas: readonly PrevisaoResolvida[], cicloAtual: number): Calibracao {
  const intervalos = resolvidas
    .map((p) => diasEntre(p.lastVisitOn, p.actualReturnOn))
    // Volta no mesmo dia não é retorno (corte e barba no mesmo atendimento). Intervalo negativo é
    // dado corrompido. Nenhum dos dois descreve cadência.
    .filter((dias) => dias > 0)

  if (intervalos.length < MINIMO_DE_AMOSTRA) {
    return { diasMedidos: null, amostra: intervalos.length, motivo: 'amostra_insuficiente' }
  }

  const medido = Math.round(mediana(intervalos))
  const dentroDaFaixa = Math.min(Math.max(medido, CICLO_MINIMO), CICLO_MAXIMO)

  if (Math.abs(dentroDaFaixa - cicloAtual) < DESVIO_MINIMO_DIAS) {
    return { diasMedidos: null, amostra: intervalos.length, motivo: 'diferenca_irrelevante' }
  }

  return { diasMedidos: dentroDaFaixa, amostra: intervalos.length, motivo: 'ok' }
}
