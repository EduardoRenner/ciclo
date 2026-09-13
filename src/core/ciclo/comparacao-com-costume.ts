/**
 * docs/62 Fase B: "R$ 240 hoje é bom ou ruim?" não tinha resposta — a tela mostrava o número do
 * dia sem nenhuma referência. Compara com a MÉDIA do mesmo dia da semana (domingo com domingos,
 * não com a semana toda), porque um salão fechado às segundas não pode comparar "hoje" com uma
 * média que inclui os dias que ele nem abre.
 *
 * Pura, sem I/O: a consulta ao banco (que dias da semana passados e quanto renderam) mora em
 * `resumo-hoje.ts`; aqui só a conta e a régua de quando ela é honesta o bastante pra mostrar.
 */

const PISO_DE_AMOSTRA = 2

export type ComparacaoComCostume = {
  /** `Math.round`, positivo = acima do costume, negativo = abaixo. */
  percentual: number
}

/**
 * `null` quando a amostra é pequena demais pra significar algo — mostrar "23% acima do costume"
 * com 1 dia de histórico é o tipo de número que engana mais do que ajuda (a régua desta casa,
 * `guarda-que-varre-passa-vazia`: o piso é o positivo conhecido, não a contagem bruta).
 */
export function compararComCostume(receitasPassadasCents: readonly number[], receitaHojeCents: number): ComparacaoComCostume | null {
  if (receitasPassadasCents.length < PISO_DE_AMOSTRA) return null

  const somaPassada = receitasPassadasCents.reduce((soma, v) => soma + v, 0)
  const mediaCents = somaPassada / receitasPassadasCents.length

  // Média zerada (salão sempre fechou no zero nesse dia da semana) não tem "% acima/abaixo" que
  // faça sentido — dividir por zero é `Infinity`/`NaN`, os dois piores números pra mostrar.
  if (mediaCents <= 0) return null

  const percentual = Math.round(((receitaHojeCents - mediaCents) / mediaCents) * 100)
  return { percentual }
}
