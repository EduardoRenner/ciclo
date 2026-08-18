/**
 * `01-ESPEC-TECNICA §5.4` — v1: regras, não ML. Cada peso é literal da
 * especificação; o resultado e as features usadas ficam gravados em
 * `appointments.no_show_score`/`risk_features` para um dia treinar o
 * modelo de verdade com dado real, não descartados.
 */
export type EntradaScoreRisco = {
  faltasAnteriores: number
  primeiraVisita: boolean
  antecedenciaDias: number
  confirmouAte12hAntes: boolean
  /** Hora local do início do atendimento (0–23) e se cai num sábado. */
  horaLocal: number
  sabado: boolean
  pagouSinal: boolean
  assinanteDoClube: boolean
  atendimentosSemFalta: number
}

export type ResultadoScoreRisco = {
  score: number
  features: EntradaScoreRisco
}

const BASE = 0.1
const PESO_POR_FALTA_ADICIONAL = 0.15
const TETO_FALTA_ADICIONAL = 0.3
const CLAMP_MIN = 0.02
const CLAMP_MAX = 0.95

export function computeNoShowScore(entrada: EntradaScoreRisco): ResultadoScoreRisco {
  let score = BASE

  if (entrada.faltasAnteriores > 0) {
    score += 0.25
    // "+0,15 por falta adicional (máx +0,30)" — a primeira falta já entrou
    // nos 0,25 acima; a partir da segunda é que soma o adicional.
    score += Math.min(TETO_FALTA_ADICIONAL, (entrada.faltasAnteriores - 1) * PESO_POR_FALTA_ADICIONAL)
  }

  if (entrada.primeiraVisita) score += 0.15
  if (entrada.antecedenciaDias > 14) score += 0.1
  if (!entrada.confirmouAte12hAntes) score += 0.1
  if (entrada.horaLocal >= 18 || entrada.sabado) score += 0.1
  if (entrada.pagouSinal) score -= 0.2
  if (entrada.assinanteDoClube) score -= 0.15
  if (entrada.atendimentosSemFalta >= 5) score -= 0.1

  score = Math.min(CLAMP_MAX, Math.max(CLAMP_MIN, score))

  return { score, features: entrada }
}

/** §5.4: limiares de uso do score. */
export const LIMIAR_SINAL_OBRIGATORIO = 0.45
export const LIMIAR_ALERTA_AGENDA = 0.6
