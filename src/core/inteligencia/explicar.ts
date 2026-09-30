import { Temporal } from '@js-temporal/polyfill'

/**
 * MI-5 (docs/85 §2.3) — "por que caiu?" respondido com conta, não com opinião.
 *
 * Duas peças puras:
 *
 * 1. `janelasComparaveis`: o que comparar com o quê. A armadilha é comparar o mês CORRENTE (até
 *    hoje) com o mês anterior INTEIRO — setembro até o dia 29 contra agosto inteiro "cai" todo mês,
 *    e o dono conclui que está indo mal quando só está no meio do mês. Então compara os MESMOS
 *    dias: 1 a 29 de setembro contra 1 a 29 de agosto. Mês fechado compara com o mês anterior
 *    inteiro; mês anterior mais curto limita no último dia dele (31 de outubro → setembro inteiro).
 *
 * 2. `decomporVariacao`: faturamento = atendimentos × valor médio. A diferença entre dois períodos
 *    se divide EXATAMENTE entre os dois fatores (método do ponto médio): cada um recebe a sua parte
 *    em R$, e as duas partes somam a diferença até o centavo. A resposta nomeia o maior.
 */

export type Janela = { inicio: string; fimExclusivo: string; rotulo: string }
export type Comparacao = { agora: Janela; antes: Janela; parcial: boolean }

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

function rotulo(inicio: Temporal.PlainDate, fimExclusivo: Temporal.PlainDate, mesInteiro: boolean): string {
  const nome = MESES[inicio.month - 1]
  if (mesInteiro) return `${nome} de ${inicio.year}`
  const ultimo = fimExclusivo.subtract({ days: 1 })
  return ultimo.day === 1 ? `1º de ${nome}` : `1 a ${ultimo.day} de ${nome}`
}

/** `null` quando o mês pedido ainda não começou — não há o que explicar sobre o futuro. */
export function janelasComparaveis(mes: string, hoje: Temporal.PlainDate): Comparacao | null {
  const m = Temporal.PlainYearMonth.from(mes)
  const inicioM = m.toPlainDate({ day: 1 })
  if (Temporal.PlainDate.compare(inicioM, hoje) > 0) return null

  const corrente = m.year === hoje.year && m.month === hoje.month
  const fimAgora = corrente ? hoje.add({ days: 1 }) : m.add({ months: 1 }).toPlainDate({ day: 1 })
  const dias = inicioM.until(fimAgora, { largestUnit: 'days' }).days

  const p = m.subtract({ months: 1 })
  const inicioP = p.toPlainDate({ day: 1 })
  const fimP = inicioP.add({ days: Math.min(dias, p.daysInMonth) })
  const antesInteiro = fimP.day === 1 && Temporal.PlainDate.compare(fimP, inicioP) > 0 && !corrente

  return {
    agora: { inicio: inicioM.toString(), fimExclusivo: fimAgora.toString(), rotulo: rotulo(inicioM, fimAgora, !corrente) },
    antes: { inicio: inicioP.toString(), fimExclusivo: fimP.toString(), rotulo: rotulo(inicioP, fimP, antesInteiro) },
    parcial: corrente,
  }
}

export type Recorte = { atendimentos: number; receitaCents: number }

export type Decomposicao = {
  deltaCents: number
  /** Variação percentual em basis points; `null` quando o período anterior não teve receita. */
  deltaBps: number | null
  efeitoAtendimentosCents: number
  efeitoValorMedioCents: number
  valorMedioAntesCents: number
  valorMedioAgoraCents: number
}

export function decomporVariacao(antes: Recorte, agora: Recorte): Decomposicao {
  const valorMedio = (r: Recorte) => (r.atendimentos > 0 ? r.receitaCents / r.atendimentos : 0)
  const va = valorMedio(antes)
  const vb = valorMedio(agora)
  const deltaCents = agora.receitaCents - antes.receitaCents
  // Ponto médio: a parte do volume usa o valor médio dos dois períodos; a do valor médio é o que
  // sobra — assim as duas somam a diferença EXATA, sem centavo perdido no arredondamento.
  const efeitoAtendimentosCents = Math.round((agora.atendimentos - antes.atendimentos) * ((va + vb) / 2))
  return {
    deltaCents,
    deltaBps: antes.receitaCents > 0 ? Math.round((deltaCents / antes.receitaCents) * 10_000) : null,
    efeitoAtendimentosCents,
    efeitoValorMedioCents: deltaCents - efeitoAtendimentosCents,
    valorMedioAntesCents: Math.round(va),
    valorMedioAgoraCents: Math.round(vb),
  }
}
