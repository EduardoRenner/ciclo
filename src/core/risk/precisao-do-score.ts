import { LIMIAR_ALERTA_AGENDA } from '@/core/risk/no-show-score'

/**
 * `computeNoShowScore` (`no-show-score.ts`) é "v1: regras, não ML" — pesos escolhidos à mão,
 * nunca medidos contra falta de verdade. O próprio docstring do arquivo já avisa o motivo de
 * `no_show_score`/`risk_features` serem gravados em `appointments`: *"para um dia treinar o
 * modelo de verdade com dado real, não descartados"*. O "um dia" nunca chegou — é o mesmo formato
 * de buraco que `PROBABILIDADE_POR_ESTADO` tinha no Motor de Ciclo antes do `docs/73`.
 *
 * Este arquivo NÃO recalibra os pesos da fórmula — isso seria treinar um modelo de verdade
 * (regressão logística ou parecido), e a régua explícita do `docs/73` ("não propõe IA/ML em lugar
 * do algoritmo determinístico") vale aqui também. O que este arquivo faz é a metade mais barata e
 * mais honesta: PROVAR se o score, do jeito que está, separa quem falta de quem não falta. Se um
 * agendamento marcado como alto risco falta na mesma taxa que um de baixo risco, o score não está
 * cumprindo a promessa que `LIMIAR_SINAL_OBRIGATORIO`/`LIMIAR_ALERTA_AGENDA` fazem — e antes de
 * mexer em peso nenhum, vale saber se o problema existe de verdade.
 *
 * Mesmo espírito de `core/cycle/prestacao-de-contas.ts` (C5, `docs/48`): a prova, não a promessa.
 */

export type DesfechoDoScore = {
  /** `appointments.no_show_score` no momento em que o agendamento foi criado. */
  score: number
  /** `status === 'no_show'` — só agendamentos já resolvidos (done ou no_show) entram aqui. */
  houveFalta: boolean
}

/** Mesmo piso de `MINIMO_PARA_AFIRMAR` (`prestacao-de-contas.ts`) — abaixo disso, o percentual
 *  descreve o acaso, não o comportamento real de quem agenda. */
export const MINIMO_PARA_AFIRMAR = 8

export type PrecisaoDoScore = {
  /** Quantos agendamentos, marcados de ALTO risco, entraram na conta. */
  altoRiscoConferidos: number
  /** Taxa de falta entre os de alto risco, em basis points. `null` sem amostra suficiente. */
  taxaDeFaltaAltoRiscoBps: number | null
  /** Quantos agendamentos, marcados de BAIXO risco, entraram na conta. */
  baixoRiscoConferidos: number
  /** Taxa de falta entre os de baixo risco, em basis points. `null` sem amostra suficiente. */
  taxaDeFaltaBaixoRiscoBps: number | null
}

/**
 * `desfechos` são agendamentos JÁ RESOLVIDOS (`done` ou `no_show` — nunca `pending`/`confirmed`,
 * que ainda não têm desfecho para medir). O corte entre "alto" e "baixo" risco é o MESMO limiar
 * que já decide o alerta visual na agenda (`LIMIAR_ALERTA_AGENDA`) — não um novo corte inventado
 * só para esta medição, porque a pergunta é exatamente "o alerta que já existe está certo?".
 */
export function precisaoDoScore(desfechos: readonly DesfechoDoScore[]): PrecisaoDoScore {
  let altoTotal = 0
  let altoFaltas = 0
  let baixoTotal = 0
  let baixoFaltas = 0

  for (const d of desfechos) {
    if (d.score >= LIMIAR_ALERTA_AGENDA) {
      altoTotal += 1
      if (d.houveFalta) altoFaltas += 1
    } else {
      baixoTotal += 1
      if (d.houveFalta) baixoFaltas += 1
    }
  }

  return {
    altoRiscoConferidos: altoTotal,
    taxaDeFaltaAltoRiscoBps: altoTotal >= MINIMO_PARA_AFIRMAR ? Math.round((altoFaltas / altoTotal) * 10_000) : null,
    baixoRiscoConferidos: baixoTotal,
    taxaDeFaltaBaixoRiscoBps: baixoTotal >= MINIMO_PARA_AFIRMAR ? Math.round((baixoFaltas / baixoTotal) * 10_000) : null,
  }
}

/**
 * `true` quando as duas taxas têm amostra suficiente E a de alto risco é REALMENTE maior — a
 * única forma de "o score está funcionando" que não exige a pessoa interpretar dois percentuais.
 * `null` quando não há amostra dos dois lados para responder a pergunta.
 */
export function scoreSeparaQuemFalta(precisao: PrecisaoDoScore): boolean | null {
  if (precisao.taxaDeFaltaAltoRiscoBps === null || precisao.taxaDeFaltaBaixoRiscoBps === null) return null
  return precisao.taxaDeFaltaAltoRiscoBps > precisao.taxaDeFaltaBaixoRiscoBps
}
