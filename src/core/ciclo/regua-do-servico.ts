import { diasDesde } from '@/core/tempo/dia'

/**
 * O que a tela diz sobre a régua de um serviço — a configurada, a medida, e a diferença.
 *
 * O produto passou a ter dois números para a mesma coisa (`migration 0065`): `cycle_days`, que é
 * palpite de catálogo, e `cycle_days_observado`, que é a cadência que a clientela daquele salão de
 * fato tem. Mostrar só o segundo faria o número mudar sozinho na cara do dono — o defeito que esta
 * base persegue desde o `docs/21`. Mostrar só o primeiro joga fora o mecanismo inteiro.
 *
 * Então a tela mostra **o que está em uso** e, quando há medição, **de onde ela veio**. A
 * procedência (quantas voltas) não é enfeite: é o que separa "medi com 8 voltas" de "medi com 400",
 * e sem ela o dono não tem como calibrar a própria confiança no número.
 *
 * O que esta função nunca faz: inventar medição quando não há, e sumir com a linha quando a
 * amostra é pequena. "Ainda estou aprendendo" é uma informação; ausência silenciosa não é.
 */

/**
 * A régua que o Motor USA: a medida quando existe, a configurada quando não.
 *
 * Existe como função — e não como `a ?? b` repetido — porque a repetição já divergiu. O
 * `recomputarCiclosDoTenant` (job noturno) preferia a medida desde a `0065`; o
 * `recomputarCicloDeUmAtendimento`, que roda ao concluir um atendimento, continuava lendo só
 * `cycle_days`. As duas escrevem a MESMA linha de `client_cycles`: concluir um atendimento
 * revertia a previsão para o palpite de catálogo, e a madrugada seguinte a trazia de volta. O
 * número da tela oscilava sozinho, sem nada ficar vermelho — os dois caminhos estavam "certos"
 * cada um por si.
 */
export function reguaEfetivaDias(cycleDays: number, observado: number | null): number {
  return observado ?? cycleDays
}

export type ReguaDoServico = {
  /** O número que o Motor usa hoje. É este que vai na linha da lista. */
  diasEmUso: number
  /** A frase de procedência, ou `null` quando não há medição para explicar. */
  procedencia: string | null
}

/** Também usada por `ritmo-do-cliente.ts` — exportada para não duplicar a mesma frase duas vezes. */
export function voltas(quantas: number): string {
  return quantas === 1 ? '1 volta' : `${quantas} voltas`
}

/**
 * `services.cycle_days_observado_em` (migration 0065): "8 voltas na semana passada" e "8 voltas em
 * um ano" são confiança bem diferente, e a coluna existia desde a 0065 sem NUNCA ter sido lida —
 * achado em 2026-09-18, varredura de coluna sem leitor. `null` acontece com dado anterior a este
 * conserto; a frase de procedência funciona sem a recência, só mais curta.
 */
function recencia(quando: string | null, agora: Date): string {
  if (!quando) return ''
  const dias = diasDesde(quando, agora)
  return dias === 0 ? ' hoje' : ` há ${dias === 1 ? '1 dia' : `${dias} dias`}`
}

/**
 * `observado`/`amostra`/`observadoEm` vêm de `services.cycle_days_observado*`, e são nulos até
 * haver base.
 *
 * `amostra` ausente com `observado` presente não deveria acontecer — as três colunas são escritas
 * juntas — mas dado torto não pode virar frase quebrada na tela de quem paga: sem a amostra, a
 * medição é usada e a procedência fica de fora, porque afirmar "medido em N voltas" sem saber o N
 * seria pior que não afirmar nada.
 */
export function reguaDoServico(
  cycleDays: number,
  observado: number | null,
  amostra: number | null,
  observadoEm: string | null = null,
  agora: Date = new Date(),
): ReguaDoServico {
  if (observado === null) return { diasEmUso: cycleDays, procedencia: null }
  if (amostra === null || amostra <= 0) return { diasEmUso: observado, procedencia: null }

  const quando = recencia(observadoEm, agora)

  if (observado === cycleDays) {
    // A medição confirmou o palpite. Vale dizer: é a única vez em que o dono descobre que o
    // número que ele nunca escolheu está certo.
    return { diasEmUso: observado, procedencia: `confirmado por ${voltas(amostra)}${quando}` }
  }

  const direcao = observado > cycleDays ? 'mais espaçado' : 'mais curto'
  return {
    diasEmUso: observado,
    procedencia: `medido em ${voltas(amostra)}${quando} · ${direcao} que os ${cycleDays}d configurados`,
  }
}
