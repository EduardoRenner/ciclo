/**
 * `docs/73` F3/T6 — o primeiro passo que o `docs/46` Fase 3 já pedia e nunca foi construído:
 * "amortecimento entre recalibrações sucessivas" só se justifica SE a régua efetiva
 * (`services.cycle_days_observado`, via `reguaEfetivaDias`) de fato pular de um valor para outro
 * de uma calibração para a seguinte. Até hoje isso era um risco lido no código, não medido.
 *
 * `cycle_predictions` (append-only desde a `0064`) já grava `default_cycle_days` — a régua efetiva
 * no momento de CADA previsão — junto com `predicted_at`. Não faltava dado, faltava a função que
 * olha essa série no tempo e diz se ela oscilou. Este arquivo é essa função: puro, sem I/O, para
 * poder ser testado sem banco (regra 5 do `CLAUDE.md`) — quem lê `cycle_predictions` de verdade é
 * `oscilacaoDaReguaDoTenant` (`server/services/previsao.ts`).
 *
 * Devolve o número cru, sem "é grave" embutido: o `docs/46` já rejeitou construir suavização sem
 * sintoma medido (mesmo motivo do candidato A ser rejeitado — mecanismo bonito sem problema real
 * por trás), e decidir aqui o que conta como "oscilação preocupante" antes de ver um único tenant
 * real seria a mesma aposta.
 */

export type PontoDeRegua = {
  /** `cycle_predictions.predicted_at` — quando o Motor registrou aquela previsão, não a data prevista. */
  predictedAt: string
  /** `cycle_predictions.default_cycle_days` — a régua efetiva naquele momento. */
  defaultCycleDays: number
}

export type OscilacaoDaRegua = {
  /** Quantas previsões entraram na medição (antes de comprimir valores repetidos). */
  amostras: number
  /** Quantos valores DIFERENTES a régua assumiu, na ordem em que apareceram. */
  valoresDistintos: number
  menorDias: number
  maiorDias: number
  /** O maior salto entre duas mudanças CONSECUTIVAS — o número que decide se F3 vale a pena. */
  maiorSaltoDias: number
  /** Quantas vezes a régua efetiva mudou de valor, no período coberto pela amostra. */
  trocas: number
}

/**
 * `null` sem amostra nenhuma — não há o que medir, e não é o mesmo que "não oscilou".
 *
 * Comprime valores repetidos ANTES de medir salto: `recomputarCiclosDoTenant` roda toda noite e
 * grava uma previsão por (cliente, serviço) com visita nova, então uma noite comum contribui
 * várias linhas com o MESMO `defaultCycleDays` — sem comprimir, "trocas" contaria ruído de volume
 * de agendamento, não mudança de régua.
 */
export function medirOscilacaoDaRegua(pontos: readonly PontoDeRegua[]): OscilacaoDaRegua | null {
  if (pontos.length === 0) return null

  const ordenados = [...pontos].sort((a, b) => a.predictedAt.localeCompare(b.predictedAt))

  const serie: number[] = [ordenados[0]!.defaultCycleDays]
  for (const ponto of ordenados.slice(1)) {
    if (ponto.defaultCycleDays !== serie[serie.length - 1]) serie.push(ponto.defaultCycleDays)
  }

  let maiorSaltoDias = 0
  for (let i = 1; i < serie.length; i++) {
    maiorSaltoDias = Math.max(maiorSaltoDias, Math.abs(serie[i]! - serie[i - 1]!))
  }

  return {
    amostras: ordenados.length,
    valoresDistintos: new Set(serie).size,
    menorDias: Math.min(...serie),
    maiorDias: Math.max(...serie),
    maiorSaltoDias,
    trocas: serie.length - 1,
  }
}
